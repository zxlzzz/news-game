/**
 * BehaviorScripts — 链条行为脚本表（纯数据，零 import）
 *
 * schema:
 *   tier:          0=零成本 | 1=低成本（clip 须在 manifest 存在） | 2=高成本
 *   weight:        Agenda 抽取权重
 *   interruptible: true = SocialLayer 可劫持此链条
 *   steps:         [ { op, ...args } ]
 *
 * 六原语:
 *   attach  : { op:'attach', item }            item ∈ ATTACHMENT_DEFS
 *   detach  : { op:'detach', item }
 *   goto    : { op:'goto', aff }               aff = affordance kind
 *   pose    : { op:'pose', clip, dur }         dur = [min, max] 秒
 *   use     : { op:'use', task }               task ∈ USE_WHITELIST
 *   loop    : { op:'loop', from, times? }      from = 0-based 步序；无 times = 永循环
 */

export const BEHAVIOR_SCRIPTS = {

  eat_snack: {
    tier: 0,
    weight: 0.4,
    interruptible: true,
    steps: [
      { op: 'attach', item: 'snack' },
      { op: 'goto',   aff:  'use_trash' },
      { op: 'detach', item: 'snack' },
    ],
  },

  /*
  // sweep — tier 1，需要 sweep clip 入库后启用
  sweep: {
    tier: 1,
    interruptible: false,
    steps: [
      { op: 'attach', item: 'broom' },
      { op: 'goto',   aff:  'use_trash' },
      { op: 'pose',   clip: 'sweep', dur: [6, 10] },
      { op: 'loop',   from: 1 },
    ],
  },
  */

};
