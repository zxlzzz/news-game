/**
 * Belief — npc.mem('belief') 的唯一 owner（W-5/W-6/W-7c/P-6/P-7）
 *
 * CONTRACT:
 *   OWNS:   npc.mem('belief').claims（数组）。claim 无顶层 source 字段
 *           （W-7c 删除）——provenance 是槽级的：`claim.sources[slot]` ∈
 *           'witness' | 'suggested' | 'fabricated' | null（P-6 新增
 *           'fabricated'——见下方 WRITES 的 evolveMemory 一条），值为 null
 *           的槽其 sources 必为 null。claim 另有 `eventId`（P-7，产出时
 *           固定为 `event.id`）——不属于槽，不受任何写入点改写，是同一
 *           WorldEvent 的所有目击者共享的稳定关联键，供
 *           `js/news/NewsBackflow.js` 分组用；'suggested' 来源同样复用
 *           `injectSuggestion()`，不因触发方是审问还是报道发表而分叉。
 *   WRITES: generateClaims() 是新 claim 的唯一写入点（产出时所有槽标
 *           'witness'）。injectSuggestion() 是"suggested"来源的唯一写入
 *           点，但**不建新 claim**——只能把某条既有 claim 上 sources 为
 *           null 的槽填上；两者严格分开，不合并成一个入口（provenance 必须
 *           能各自单独追责）。evolveMemory()（P-6）是第三个写入点，按周期对
 *           每条 claim 的每个槽独立掷一次变异（遗忘/变形/转移/虚构之一或
 *           不变）——遗忘把槽退回 null（sources 同步退回 null，重新成为
 *           injectSuggestion 的注入口）；虚构把空槽自发填上一个值，标记
 *           'fabricated'（区别于 'witness'/'suggested'，是本批新增的第三种
 *           来源）；变形/转移只改槽值，不碰 sources/strength——NPC 对自己的
 *           记忆失真没有自觉，provenance 类别（这条信息最初怎么进来的）不
 *           因为内容漂移而改写。
 *   READS:  Perception.perceive()（W-4）判定目击通道/质量；EventDefs.js 的
 *           EVENT_DEFS 提供 action 槽的 fine/coarse 取值来源；
 *           ClaimDecisionTables.js 提供 q → 填槽概率表；
 *           MemoryMutationTables.js 提供变异概率表（P-6）。
 *
 * 目击者数量目标 [2,4]（witness-memory-v1.md §5）：候选池不足 2 人时如实
 * 反映实际人数，不强行凑数；q < WITNESS_Q_THRESHOLD 的候选不计入候选池。
 * 静态分布验证见 scripts/check-witness-distribution.mjs；记忆演化验证见
 * scripts/check-memory-mutation.mjs（P-6，五个静态门之一）。
 */

import { EVENT_DEFS } from './data/EventDefs.js';
import { SIGHT_TABLE, SOUND_TABLE, qBand } from './data/ClaimDecisionTables.js';
import { MUTATION_TABLE, FABRICATE_PROB, effectiveMutationProbs } from './data/MemoryMutationTables.js';
import { perceive } from './Perception.js';
import { getNavGrid, CELL, ZONE } from './nav/NavGrid.js';
import { gameClock } from '../core/GameClock.js';
import { PROFILES } from '../npc/NpcProfile.js';

export const WITNESS_Q_THRESHOLD = 0.20;
const WITNESS_COUNT_RANGE = [2, 4];

// P-8：导出供 js/debug/WitnessDebugPanel.js（一次性调试工具）现取槽位名，
// 不在面板文件里另抄一份字面量数组。这是 tasks.md P-8 唯一允许为了面板
// 改动 Belief.js 的地方（新增 export，不改行为）。
export const SLOTS = ['actor', 'action', 'target', 'place', 'time'];

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

/**
 * _describeSlotValue — 槽值序列化唯一住址（W-7d）。
 *
 * schema（witness-memory-v1.md 第一节）声明 actor/target/place 都是
 * `string | null`，但改造前 fine 粒度直接存了原始值：actor/target 存裸
 * `npc.id`（数字），place 存 `{x,y}` 对象——两者都不是字符串，喂进
 * `claimsToTestimony()` 拼出来的证词分别是 `谁=17`、`地点=[object Object]`，
 * 对玩家和 LLM 都不可读。这两处 bug 的修法收在同一个函数里，不散落成
 * 各自打补丁：claim 里存的就应该是这个函数的输出，不是待格式化的原始值。
 */
function _describeSlotValue(kind, raw) {
  if (kind === 'npc') {
    return `${raw.npcType ?? 'npc'}#${raw.id}`;
  }
  if (kind === 'place') {
    const { x, y, precise } = raw;
    const grid = getNavGrid();
    if (!grid) return null;
    const z = grid.zone(Math.floor(x / CELL), Math.floor(y / CELL));
    const zoneName = ZONE_NAME[z];
    if (!zoneName) return null;
    return precise ? `${zoneName}(${Math.round(x)},${Math.round(y)})` : zoneName;
  }
  return null;
}

function _actorFidelityValue(npc, fidelity) {
  if (fidelity === 'fine') return _describeSlotValue('npc', npc);
  if (fidelity === 'tag')  return npc.npcType ?? [...npc.getTags()][0] ?? null;
  return null;
}

function _actionFidelityValue(kind, fidelity) {
  if (fidelity === 'fine')   return kind;
  if (fidelity === 'coarse') return EVENT_DEFS[kind]?.category ?? null;
  return null;
}

function _placeFidelityValue(x, y, fidelity) {
  if (fidelity === 'fine')   return _describeSlotValue('place', { x, y, precise: true });
  if (fidelity === 'coarse') return _describeSlotValue('place', { x, y, precise: false });
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

  // eventId（P-7）：同一 WorldEvent 的所有目击者 claim 共享同一个值（event.id，
  // WorldEventLog.js#emitEvent 产出），供 NewsBackflow.js 把"同一事件的不同
  // 目击者"分组——不属于 SLOTS，不参与 claimsToTestimony/evolveMemory 的槽
  // 级遍历（两处都显式按 SLOTS 取值，新字段天然被跳过），是稳定的元数据，
  // 不会被记忆演化改写或退化。
  return { ...values, sources, strength: {}, q, channel, eventId: event.id, id: `claim_${++_claimIdSeq}` };
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
 * W-7d：按槽标注来源，不再整条打一个标签——一条 claim 完全可能 action 是
 * 目击、actor 是问出来的，"（未经证实）"只跟在被问出来的那个槽后面，
 * 不该盖住整条（那样会让真正目击到的部分也被读者当成道听途说）。
 * `providers.js` 的 live system prompt 明确认这个子串（"只能转述不能当
 * 确证事实"），字面量不能改。
 */
export function claimsToTestimony(npc) {
  const claims = npc.mem('belief').claims ?? [];
  const lines = [];
  for (const claim of claims) {
    const parts = SLOTS
      .filter(s => claim[s] != null)
      .map(s => `${SLOT_LABEL[s]}=${claim[s]}${claim.sources[s] === 'suggested' ? '（未经证实）' : ''}`);
    if (parts.length === 0) continue;
    lines.push(parts.join('，'));
  }
  return lines;
}

// ─── 记忆演化（P-6：复述使信念变强 / 记忆随时间失真）─────────────────────────

// 演化周期的具名住址（游戏分钟，不是实秒）。调用方（BehaviorManager 每帧）用
// GameClock 实际经过的游戏分钟数累加喂给 evolveMemory；P-8 调试面板的"时间
// 快进"直接把「N 分钟 ÷ 本常量」算成整数 ticks 传入，绕开真实帧循环、不触碰
// GameClock 本身——这正是"快进只推进记忆演化所需的时钟"的实现方式。
export const MEMORY_EVOLUTION_INTERVAL_MIN = 5;

// time 槽退化（fine→coarse）后的三档粗桶命名沿用 witness-memory-v1.md §1
// 的 time 行；分界阈值（游戏小时）是本批新增、文档未锁定的具体数值，按
// "半天内=常见记忆窗口"的直觉取值，不是设计冻结项，可按体验调整。
const TIME_BUCKET_HOURS = { justNow: 1, aWhileAgo: 4 };
const TIME_BUCKETS = ['just_now', 'a_while_ago', 'long_ago'];

function _timeToBucket(t) {
  const now = gameClock();
  let delta = now - t;
  if (delta < 0) delta += 24; // GameClock 24 小时回绕
  if (delta < TIME_BUCKET_HOURS.justNow) return 'just_now';
  if (delta < TIME_BUCKET_HOURS.aWhileAgo) return 'a_while_ago';
  return 'long_ago';
}

// 虚构值的取值池：actor/target 借用 NpcProfile.js 的 profile 名当"猜测的类别"
// （虚构从不产出 fine 粒度的具体身份——那是编造一个具体人物，比编造一个类别
// 更不可信，本批不做那么细）；action 借用 EVENT_DEFS 里出现过的 category 去重
// 集合；place 借用 ZONE 键（剔除 BLOCKED——不是可停留的语义地点）；time 直接
// 复用退化档的三个桶名，保持粒度一致。
const FABRICATE_ACTOR_POOL = Object.keys(PROFILES);
const FABRICATE_ACTION_POOL = [...new Set(Object.values(EVENT_DEFS).map(d => d.category))];
const FABRICATE_PLACE_POOL = Object.keys(ZONE).filter(k => k !== 'BLOCKED');

function _randOf(pool) { return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null; }

function _fabricatedValue(slot) {
  if (slot === 'actor' || slot === 'target') return _randOf(FABRICATE_ACTOR_POOL);
  if (slot === 'action') return _randOf(FABRICATE_ACTION_POOL);
  if (slot === 'place')  return _randOf(FABRICATE_PLACE_POOL);
  if (slot === 'time')   return _randOf(TIME_BUCKETS);
  return null;
}

/**
 * slotFidelity — 槽当前表征细度的纯字符串形状判定：'fine'（原始细粒度值）｜
 * 'coarse'（已退化，含 tag/category/zone/时间桶）｜'null'（无值）。唯一住址——
 * _distortSlot 用它判断"还能不能继续退化"，scripts/check-memory-mutation.mjs
 * 用它统计保真率，不在两处分别实现一套判定逻辑。
 */
export function slotFidelity(slot, value) {
  if (value == null) return 'null';
  if (slot === 'actor' || slot === 'target') return value.includes('#') ? 'fine' : 'coarse';
  if (slot === 'action') return EVENT_DEFS[value] ? 'fine' : 'coarse';
  if (slot === 'place')  return value.includes('(') ? 'fine' : 'coarse';
  if (slot === 'time')   return typeof value === 'number' ? 'fine' : 'coarse';
  return 'coarse';
}

/** 遗忘：槽退回 null，sources 同步退回 null，累计的 strength 一并清空
 *  （重新成为空槽，之后再被 injectSuggestion 填上时从 strength=1 重新计）。 */
function _forgetSlot(claim, slot) {
  claim[slot] = null;
  claim.sources[slot] = null;
  delete claim.strength[slot];
}

/** 变形：fine → coarse 退化一档；已经是 coarse（或该槽无退化阶梯可退）则本轮
 *  变异无效果——"遗忘"和"变形"是两种独立判定，不会因为已经退化到底就顺带遗忘。 */
function _distortSlot(claim, slot) {
  if (slotFidelity(slot, claim[slot]) !== 'fine') return;
  if (slot === 'actor' || slot === 'target') claim[slot] = claim[slot].split('#')[0];
  else if (slot === 'action') claim[slot] = EVENT_DEFS[claim[slot]].category;
  else if (slot === 'place')  claim[slot] = claim[slot].split('(')[0];
  else if (slot === 'time')   claim[slot] = _timeToBucket(claim[slot]);
}

/** 置换：槽值被替换成同一 NPC（allClaims 的作用域）别的 claim 里同槽的值；
 *  没有别的 claim 在这个槽上有值就放弃这轮（不是"没找到就遗忘"）。
 *  sources/strength 不改——provenance 类别不因内容被记混而改写（见文件头注释）。 */
function _transferSlot(claim, slot, allClaims) {
  const donors = allClaims.filter(c => c !== claim && c[slot] != null);
  if (donors.length === 0) return;
  claim[slot] = donors[Math.floor(Math.random() * donors.length)][slot];
}

/** 虚构：空槽（sources[slot]===null）自发填上一个值，标记来源 'fabricated'。 */
function _fabricateSlot(claim, slot) {
  const value = _fabricatedValue(slot);
  if (value == null) return;
  claim[slot] = value;
  claim.sources[slot] = 'fabricated';
}

function _pickOutcome(probs) {
  const r = Math.random();
  let acc = 0;
  for (const k of ['stay', 'distort', 'transfer', 'forget']) {
    acc += probs[k];
    if (r < acc) return k;
  }
  return 'stay';
}

/** 对单条 claim 的每个槽独立掷一次（一次演化 tick）。allClaims 是同一 NPC 的
 *  完整 claims 数组，供 _transferSlot 划定"只能取到自己其他 claim"的范围。 */
function _mutateClaim(claim, allClaims) {
  for (const slot of SLOTS) {
    if (claim.sources[slot] == null) {
      if (Math.random() < FABRICATE_PROB[slot]) _fabricateSlot(claim, slot);
      continue;
    }
    const outcome = _pickOutcome(effectiveMutationProbs(slot, claim.strength[slot] ?? 0));
    if (outcome === 'forget')   _forgetSlot(claim, slot);
    else if (outcome === 'distort')  _distortSlot(claim, slot);
    else if (outcome === 'transfer') _transferSlot(claim, slot, allClaims);
    // 'stay'：不动
  }
}

/**
 * evolveMemory — 记忆演化步骤唯一入口（P-6）。ticks 是离散的演化周期数
 * （每个周期 = MEMORY_EVOLUTION_INTERVAL_MIN 游戏分钟），不是时间本身——
 * 攒够一个周期才算一次 tick 是调用方（BehaviorManager）的职责，这里只管
 * "给定 N 个周期，把每个 NPC 的每条 claim 的每个槽独立按变异表滚一次"，
 * 纯粹、可重复调用、不持有任何计时状态，P-8 调试面板的"时间快进"和本文件
 * 自身都可以直接调用而不必先攒时间。
 */
export function evolveMemory(npcs, ticks = 1) {
  for (let i = 0; i < ticks; i++) {
    for (const npc of npcs) {
      const claims = npc.mem('belief').claims;
      if (!claims || claims.length === 0) continue;
      for (const claim of claims) _mutateClaim(claim, claims);
    }
  }
}
