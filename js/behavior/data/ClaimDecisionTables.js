/**
 * ClaimDecisionTables — 目击质量 q → 填槽裁决表（纯数据，无 import）
 *
 * 数值照抄 docs/design-plans/witness-memory-v1.md 第三节，此文件是那份表的
 * 唯一代码住址——改数值改这里，改完同步更新文档表格，不要两处分别维护。
 *
 * 每个槽是 [probability, fidelity][]，同一 q 档内该槽所有条目概率和须为 1。
 * fidelity ∈ 'fine' | 'coarse' | 'tag' | 'null'（'tag' 只对 actor/target 有意义）。
 *
 * sound 通道刻意不给 `actor` 键——这是 witness-memory-v1.md 明确的硬约束
 * （"不是概率"），实现上用 Belief.js 里的无条件分支处理，不走本表的加权
 * 抽样，本表没有这一项就是防止有人把它加回来当成概率处理。
 */

export function qBand(q) {
  if (q >= 0.75) return 'clear';
  if (q >= 0.45) return 'medium';
  if (q >= 0.20) return 'vague';
  return null; // 阈下，不产出 claim
}

export const SIGHT_TABLE = {
  clear: {
    actor:  [[1, 'fine']],
    action: [[1, 'fine']],
    target: [[1, 'fine']],
    place:  [[1, 'fine']],
    time:   [[1, 'fine']],
  },
  medium: {
    actor:  [[0.9, 'fine'], [0.1, 'tag']],
    action: [[1, 'fine']],
    target: [[0.85, 'fine'], [0.15, 'tag']],
    place:  [[1, 'coarse']],
    time:   [[1, 'fine']],
  },
  vague: {
    actor:  [[0.3, 'fine'], [0.5, 'tag'], [0.2, 'null']],
    action: [[0.8, 'coarse'], [0.2, 'null']],
    target: [[0.3, 'tag'], [0.7, 'null']],
    place:  [[0.9, 'coarse'], [0.1, 'null']],
    time:   [[1, 'fine']],
  },
};

export const SOUND_TABLE = {
  clear: {
    action: [[0.8, 'coarse'], [0.2, 'null']],
    target: [[0.4, 'tag'], [0.6, 'null']],
    place:  [[0.7, 'coarse'], [0.3, 'null']],
    time:   [[1, 'fine']],
  },
  medium: {
    action: [[0.6, 'coarse'], [0.4, 'null']],
    target: [[0.15, 'tag'], [0.85, 'null']],
    place:  [[0.5, 'coarse'], [0.5, 'null']],
    time:   [[1, 'fine']],
  },
  vague: {
    action: [[0.25, 'coarse'], [0.75, 'null']],
    target: [[0.05, 'tag'], [0.95, 'null']],
    place:  [[0.25, 'coarse'], [0.75, 'null']],
    time:   [[1, 'fine']],
  },
};
