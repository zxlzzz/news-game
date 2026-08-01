/**
 * Belief — npc.mem('belief') 的唯一 owner（W-5）
 *
 * CONTRACT:
 *   OWNS:   npc.mem('belief').claims（数组）。
 *   WRITES: generateClaims() 是"witness"来源 claim 的唯一写入点。
 *           （W-6 的"suggested"来源写入是另一个函数，不共用本文件的写入路径——
 *           两种来源的 provenance 必须能各自单独追责，不合并成一个入口。）
 *   READS:  Perception.perceive()（W-4）判定目击通道/质量；EventDefs.js 的
 *           EVENT_DEFS 提供 action 槽的 fine/coarse 取值来源；
 *           ClaimDecisionTables.js 提供 q → 填槽概率表。
 *
 * 目击者数量目标 [2,4]（witness-memory-v1.md §5）：候选池不足 2 人时如实
 * 反映实际人数，不强行凑数；q < WITNESS_Q_THRESHOLD 的候选不计入候选池。
 * 静态分布验证见 scripts/check-witness-distribution.mjs。
 */

import { EVENT_DEFS } from './data/EventDefs.js';
import { SIGHT_TABLE, SOUND_TABLE, qBand } from './data/ClaimDecisionTables.js';
import { perceive } from './Perception.js';
import { getNavGrid, CELL, ZONE } from './nav/NavGrid.js';

export const WITNESS_Q_THRESHOLD = 0.20;
const WITNESS_COUNT_RANGE = [2, 4];

const ZONE_NAME = Object.fromEntries(Object.entries(ZONE).map(([k, v]) => [v, k]));

function _witnessCount(available) {
  const [min, max] = WITNESS_COUNT_RANGE;
  if (available < min) return available;
  const cap = Math.min(max, available);
  return min + Math.floor(Math.random() * (cap - min + 1));
}

/** candidates 中对 (eventX,eventY) 有效感知（q ≥ 阈值）的按 q 降序取 [2,4] 名 */
export function selectWitnesses(candidates, eventX, eventY) {
  const perceived = [];
  for (const npc of candidates) {
    const result = perceive(npc, eventX, eventY);
    if (result && result.q >= WITNESS_Q_THRESHOLD) {
      perceived.push({ npc, channel: result.channel, q: result.q });
    }
  }
  if (perceived.length === 0) return [];
  perceived.sort((a, b) => b.q - a.q);
  return perceived.slice(0, _witnessCount(perceived.length));
}

function _pick(entries) {
  const r = Math.random();
  let acc = 0;
  for (const [p, fidelity] of entries) {
    acc += p;
    if (r < acc) return fidelity;
  }
  return entries[entries.length - 1][1];
}

function _actorFidelityValue(npc, fidelity) {
  if (fidelity === 'fine') return npc.id;
  if (fidelity === 'tag')  return npc.npcType ?? [...npc.getTags()][0] ?? null;
  return null;
}

function _actionFidelityValue(kind, fidelity) {
  if (fidelity === 'fine')   return kind;
  if (fidelity === 'coarse') return EVENT_DEFS[kind]?.category ?? null;
  return null;
}

function _placeFidelityValue(x, y, fidelity) {
  if (fidelity === 'fine') return { x: Math.round(x), y: Math.round(y) };
  if (fidelity === 'coarse') {
    const grid = getNavGrid();
    if (!grid) return null;
    const z = grid.zone(Math.floor(x / CELL), Math.floor(y / CELL));
    return ZONE_NAME[z] ?? null;
  }
  return null;
}

/** actorNpcs = [event.actors[0], event.actors[1]] 对应的活体 Npc 引用（可含 null） */
function _fillClaim(event, actorNpcs, channel, q) {
  const band = qBand(q);
  if (!band) return null;
  const table = channel === 'sight' ? SIGHT_TABLE[band] : SOUND_TABLE[band];
  const [actorNpc, targetNpc] = actorNpcs;

  // sound 通道 actor 硬约束为 null——不进入加权抽样（见 ClaimDecisionTables.js 头注释）
  const actorValue = channel === 'sound' ? null : _actorFidelityValue(actorNpc, _pick(table.actor));

  return {
    actor:  actorNpc ? actorValue : null,
    action: _actionFidelityValue(event.kind, _pick(table.action)),
    target: targetNpc ? _actorFidelityValue(targetNpc, _pick(table.target)) : null,
    place:  _placeFidelityValue(event.x, event.y, _pick(table.place)),
    time:   event.t,
    q, channel, source: 'witness',
  };
}

/**
 * event: WorldEvent（{kind,x,y,t}，见 WorldEventLog.js）
 * actorNpcs: 与 event.actors[] 同序的活体 Npc 引用（供取 tag/id，事件本身只存 id）
 * candidateNpcs: 候选目击者池（通常是 bm.npcs）
 * 返回本次产出的 {witness, claim}[]（claim 已写入 witness.mem('belief').claims）
 */
export function generateClaims(event, actorNpcs, candidateNpcs) {
  const witnesses = selectWitnesses(candidateNpcs, event.x, event.y);
  const produced = [];
  for (const { npc, channel, q } of witnesses) {
    const claim = _fillClaim(event, actorNpcs, channel, q);
    if (!claim) continue;
    const mem = npc.mem('belief');
    if (!mem.claims) mem.claims = [];
    mem.claims.push(claim);
    produced.push({ witness: npc, claim });
  }
  return produced;
}

/**
 * injectSuggestion — 审问注入（W-6），claims 的第二个写入点。
 *
 * 与 generateClaims() 严格分开，不合并成一个入口：两种 provenance（亲眼
 * 目击 vs 被提问引导后"想起来"的）必须能各自单独追责，混进同一个写入函数
 * 会让"这条 claim 是不是被污染过"这个问题在代码里变得不可回答。
 *
 * 同一 (slot, value) 重复注入（复述）只增加 strength，不重复建 claim——
 * "反复问同一件事、得到同样的答案"应该强化信念而不是刷 claims 数组长度。
 * NPC 本身不会因为被注入而改变任何行为（"无自觉"）：本函数只写数据，
 * 不触发状态机/情绪/记忆巩固之类的副作用。
 */
export function injectSuggestion(npc, slot, value) {
  if (value == null) return null;
  const mem = npc.mem('belief');
  if (!mem.claims) mem.claims = [];
  const existing = mem.claims.find(c => c.source === 'suggested' && c[slot] === value);
  if (existing) {
    existing.strength = (existing.strength ?? 1) + 1;
    return existing;
  }
  const claim = {
    actor: null, action: null, target: null, place: null, time: null,
    q: null, channel: null, source: 'suggested', strength: 1,
  };
  claim[slot] = value;
  mem.claims.push(claim);
  return claim;
}

const SLOT_LABEL = { actor: '谁', action: '做了什么', target: '对象', place: '地点', time: '时间' };

/** claims → testimony[]（人类可读字符串），供 providers.text.compose({testimony}) 消费 */
export function claimsToTestimony(npc) {
  const claims = npc.mem('belief').claims ?? [];
  const lines = [];
  for (const claim of claims) {
    const parts = ['actor', 'action', 'target', 'place', 'time']
      .filter(slot => claim[slot] != null)
      .map(slot => `${SLOT_LABEL[slot]}=${claim[slot]}`);
    if (parts.length === 0) continue;
    const provenance = claim.source === 'suggested' ? '（未经证实）' : '（目击）';
    lines.push(`${parts.join('，')}${provenance}`);
  }
  return lines;
}
