/**
 * Belief — npc.mem('belief') 的唯一 owner（W-5/W-6/W-7c）
 *
 * CONTRACT:
 *   OWNS:   npc.mem('belief').claims（数组）。claim 无顶层 source 字段
 *           （W-7c 删除）——provenance 是槽级的：`claim.sources[slot]` ∈
 *           'witness' | 'suggested' | null，值为 null 的槽其 sources 必为 null。
 *   WRITES: generateClaims() 是新 claim 的唯一写入点（产出时所有槽标
 *           'witness'）。injectSuggestion() 是"suggested"来源的唯一写入
 *           点，但**不建新 claim**——只能把某条既有 claim 上 sources 为
 *           null 的槽填上；两者严格分开，不合并成一个入口（provenance 必须
 *           能各自单独追责）。
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

const SLOTS = ['actor', 'action', 'target', 'place', 'time'];

const ZONE_NAME = Object.fromEntries(Object.entries(ZONE).map(([k, v]) => [v, k]));

let _claimIdSeq = 0;

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

  const values = {
    actor:  actorNpc ? actorValue : null,
    action: _actionFidelityValue(event.kind, _pick(table.action)),
    target: targetNpc ? _actorFidelityValue(targetNpc, _pick(table.target)) : null,
    place:  _placeFidelityValue(event.x, event.y, _pick(table.place)),
    time:   event.t,
  };

  // provenance 是槽级的（W-7c）：产出时所有有值槽标 'witness'，无值槽的
  // sources 也是 null——不存在"这个槽是 witness 来源但值是 null"的状态。
  const sources = {};
  for (const slot of SLOTS) sources[slot] = values[slot] != null ? 'witness' : null;

  return { ...values, sources, strength: {}, q, channel, id: `claim_${++_claimIdSeq}` };
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
 * findFillableClaim — 在 npc 的 claims 里找一条 sources[slot] 为 null 的
 * claim（有这个槽可填），供审问 UI 决定 injectSuggestion() 该往哪条 claim
 * 写。找不到（没有任何 claim 留着这个槽等填）返回 null——审问 UI 据此
 * 判断"这个问题问了也没处安放"，不代表 LLM 解析失败。
 */
export function findFillableClaim(npc, slot) {
  const claims = npc.mem('belief').claims ?? [];
  return claims.find(c => c.sources[slot] === null) ?? null;
}

/**
 * injectSuggestion — 审问注入（W-6/W-7c），claims 的第二个写入点。
 *
 * 与 generateClaims() 严格分开，不合并成一个入口：两种 provenance（亲眼
 * 目击 vs 被提问引导后"想起来"的）必须能各自单独追责，混进同一个写入函数
 * 会让"这条 claim 是不是被污染过"这个问题在代码里变得不可回答。
 *
 * W-7c：provenance 收窄到槽级——只允许填某条既有 claim 上 sources 为 null
 * 的槽，不再新建 claim（"空槽就是注入口"这个设计支点要求 provenance 精确
 * 到槽，claim 级的 source 表达不了"action 是真看见的、actor 是被问出来的"
 * 这种混合状态）。同一 (claim, slot, value) 重复注入是"复述同一件事、得到
 * 同样答案"，只增 strength[slot] 不改写；同一槽换一个不同的值，或该槽本来
 * 就是 witness 来源，一律拒绝——已确立的 provenance 不允许被覆盖。
 * NPC 本身不会因为被注入而改变任何行为（"无自觉"）：本函数只写数据，
 * 不触发状态机/情绪/记忆巩固之类的副作用。
 *
 * 返回写入/强化后的 claim；无此 claim、该槽已有来源（且非同值复述）时
 * 返回 null 且不写入。
 */
export function injectSuggestion(npc, claimId, slot, value) {
  if (value == null) return null;
  const claims = npc.mem('belief').claims ?? [];
  const claim = claims.find(c => c.id === claimId);
  if (!claim) return null;

  if (claim.sources[slot] != null) {
    const isCorroboration = claim.sources[slot] === 'suggested' && claim[slot] === value;
    if (!isCorroboration) return null;
    claim.strength[slot] = (claim.strength[slot] ?? 1) + 1;
    return claim;
  }

  claim[slot] = value;
  claim.sources[slot] = 'suggested';
  claim.strength[slot] = 1;
  return claim;
}

const SLOT_LABEL = { actor: '谁', action: '做了什么', target: '对象', place: '地点', time: '时间' };

/**
 * claims → testimony[]（人类可读字符串），供 providers.text.compose({testimony}) 消费。
 *
 * W-7c 暂用"整条是否含任一 suggested 槽"这一粗粒度标注过渡——按槽级来源
 * 精确标注（"哪个字是问出来的"）是 W-7d「证词序列化收口」的范围，这里先
 * 保证 schema 迁移后不崩、语义不倒退（不会把 suggested 的内容误标成目击）。
 */
export function claimsToTestimony(npc) {
  const claims = npc.mem('belief').claims ?? [];
  const lines = [];
  for (const claim of claims) {
    const parts = SLOTS.filter(s => claim[s] != null).map(s => `${SLOT_LABEL[s]}=${claim[s]}`);
    if (parts.length === 0) continue;
    const anySuggested = SLOTS.some(s => claim.sources[s] === 'suggested');
    lines.push(`${parts.join('，')}${anySuggested ? '（部分未经证实）' : '（目击）'}`);
  }
  return lines;
}
