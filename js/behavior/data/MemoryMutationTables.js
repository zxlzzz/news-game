/**
 * MemoryMutationTables — 记忆演化变异概率表（tasks.md P-6，纯数据，无 import）
 *
 * MUTATION_TABLE 数值照抄 docs/design-plans/witness-memory-v1.md 第四节
 * "Mutation 转移表"（2026-08-02 冻结的设计决策）——原表是为"复述传播"场景设计的
 * 每跳概率，P-6 复用同一份先验数值作为记忆随时间自然演化的基础概率（同一份数字，
 * 两种触发时机：原设计的"复述"触发点至今未接线，见该文档头部注记；P-6 先落地
 * "随时间演化"这一种，接线口在 Belief.js#evolveMemory）。四列 = 不变/退化/置换/
 * 丢失，对应本批 tasks.md 的叫法 stay/distort/transfer/forget；每行概率和为 1.0，
 * 改数值须同步改回文档表格，不要两处分别维护。
 *
 * STRENGTH_DECAY / STRENGTH_FLOOR：原表数值本身不含"strength 抗性"这个维度
 * （原设计是无状态的单跳复述模型），是 P-6 在此之上新加的一层——strength 每 +1，
 * "非不变"（distort+transfer+forget）的总概率乘 STRENGTH_DECAY，空出的概率并回
 * "不变"；STRENGTH_FLOOR 是衰减下限（乘数不会低于此值，strength 再高也不是完全
 * 免疫，只是显著更抗）。这是"复述使信念变强"机制的唯一落点。
 *
 * FABRICATE_PROB：原表没有这一档（"只对当前有值的槽生效，本来就是 null 不参与，
 * 不会凭空变出一个值"是原文档的明文约束）——P-6 新增，只对 sources[slot]===null
 * 的空槽生效，量级刻意显著低于"丢失"（虚构比遗忘更少见：遗忘是真实记忆的自然
 * 衰退，虚构是无中生有，认知负担更高）。不受 strength 影响——空槽从未被强化过
 * （strength 只在 injectSuggestion 时才写入，一个从未被注入过的空槽没有这个概念）。
 */

// 列序固定：[stay, distort, transfer, forget]，每行求和 = 1.0
export const MUTATION_TABLE = {
  actor:  [0.80, 0.10, 0.06, 0.04],
  action: [0.82, 0.12, 0.04, 0.02],
  target: [0.78, 0.10, 0.08, 0.04],
  place:  [0.75, 0.15, 0.05, 0.05],
  time:   [0.90, 0.07, 0.01, 0.02],
};

export const STRENGTH_DECAY = 0.65;
export const STRENGTH_FLOOR = 0.15;

export const FABRICATE_PROB = {
  actor: 0.01, action: 0.008, target: 0.01, place: 0.008, time: 0.004,
};

/**
 * 给定槽名和当前 strength（未强化过传 0），算出这一次演化的有效四选一概率
 * （strength 抗性已折算进去）。stay 概率 = 1 − 非 stay 总量；distort/transfer/
 * forget 三者按原表内部比例分摊剩余的非 stay 概率。
 */
export function effectiveMutationProbs(slot, strength = 0) {
  const [stay, distort, transfer, forget] = MUTATION_TABLE[slot];
  const nonStay = distort + transfer + forget;
  const mult = Math.max(STRENGTH_FLOOR, STRENGTH_DECAY ** strength);
  const scaledNonStay = nonStay * mult;
  const scale = nonStay > 0 ? scaledNonStay / nonStay : 0;
  return {
    stay:     1 - scaledNonStay,
    distort:  distort * scale,
    transfer: transfer * scale,
    forget:   forget * scale,
  };
}
