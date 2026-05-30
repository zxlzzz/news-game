/**
 * GESTURE_CLIPS — 手势动画片段（关键帧序列，播完自动移除）
 *
 * 关键帧为「扁平格式」（{dur, r_elbow:[x,y], r_hand:[x,y], ...}），
 * 关节值为【游戏坐标系】绝对局部坐标（已从 stick-puppet 编辑器坐标换算：
 * x×0.45、y×0.714+12，使幅度匹配 single.json 基准，不再飞出画面）。
 * 仅覆盖手臂关节（elbow/hand）；躯干/头颈/腿保持动画帧基准位置不覆盖。
 * ModifierLayer 逐关键帧用 kfJoints(kf) 提取关节（剔除 dur）替换该帧关节位置。
 *
 * 数据来源 assets/animations/gesture/*.json（stick-puppet 导出，编辑器坐标系）。
 * 空 keyframes 的占位 clip 立即结束、不产生位移。
 */
export const GESTURE_CLIPS = {
  // 看表（watch.json）
  check_watch: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [9, -17], r_hand: [13, 3] },
      { dur: 0.3, r_elbow: [7, -16], r_hand: [6, 5] },
      { dur: 0.3, r_elbow: [8, -17], r_hand: [-4, -9] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [9, -18], r_hand: [-3, -21] },
      { dur: 0.3, r_elbow: [8, -17], r_hand: [-4, -9] },
      { dur: 0.3, r_elbow: [6, -15], r_hand: [5, 6] },
      { dur: 0.3, r_elbow: [5, -14], r_hand: [10, 5] },
    ],
  },

  // 伸展（stretch.json）；仅手臂，头颈保持基准
  stretch: {
    type: 'gesture', activeJoints: ['r_elbow', 'l_hand', 'l_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [9, -7], l_hand: [-13, 21], l_elbow: [-9, -7], r_hand: [14, 21] },
      { dur: 0.3, r_elbow: [8, -7], l_hand: [-9, 3], l_elbow: [-8, -7], r_hand: [9, 3] },
      { dur: 0.3, r_elbow: [7, -6], l_hand: [-5, -14], l_elbow: [-7, -6], r_hand: [4, -14] },
      { dur: 0.3, r_elbow: [7, -5], l_hand: [-1, -32], l_elbow: [-6, -5], r_hand: [-1, -31] },
      { dur: 0.3, r_elbow: [4, -18], l_hand: [-6, -42], l_elbow: [-9, -14], r_hand: [-5, -42] },
      { dur: 0.3, r_elbow: [2, -31], l_hand: [-10, -53], l_elbow: [-12, -24], r_hand: [-9, -53] },
      { dur: 0.3, r_elbow: [-1, -44], l_hand: [-15, -63], l_elbow: [-14, -34], r_hand: [-14, -64] },
      { dur: 0.3, r_elbow: [-1, -44], l_hand: [-15, -63], l_elbow: [-14, -34], r_hand: [-14, -64] },
      { dur: 0.3, r_elbow: [-1, -44], l_hand: [-15, -63], l_elbow: [-14, -34], r_hand: [-14, -64] },
      { dur: 0.3, r_elbow: [-1, -44], l_hand: [-15, -63], l_elbow: [-14, -34], r_hand: [-14, -64] },
      { dur: 0.3, r_elbow: [-1, -44], l_hand: [-15, -63], l_elbow: [-14, -34], r_hand: [-14, -64] },
      { dur: 0.3, r_elbow: [-1, -44], l_hand: [-15, -63], l_elbow: [-14, -34], r_hand: [-14, -64] },
      { dur: 0.3, r_elbow: [-1, -44], l_hand: [-15, -63], l_elbow: [-14, -34], r_hand: [-14, -64] },
      { dur: 0.3, r_elbow: [-1, -44], l_hand: [-15, -63], l_elbow: [-14, -34], r_hand: [-14, -64] },
      { dur: 0.3, r_elbow: [-1, -44], l_hand: [-15, -63], l_elbow: [-14, -34], r_hand: [-14, -64] },
      { dur: 0.3, r_elbow: [-1, -44], l_hand: [-15, -63], l_elbow: [-14, -34], r_hand: [-14, -64] },
      { dur: 0.3, r_elbow: [1, -37], l_hand: [-14, -47], l_elbow: [-13, -29], r_hand: [-9, -47] },
      { dur: 0.3, r_elbow: [3, -29], l_hand: [-14, -29], l_elbow: [-12, -24], r_hand: [-3, -30] },
      { dur: 0.3, r_elbow: [5, -22], l_hand: [-14, -13], l_elbow: [-11, -18], r_hand: [3, -13] },
      { dur: 0.3, r_elbow: [7, -14], l_hand: [-14, 4], l_elbow: [-10, -13], r_hand: [8, 3] },
      { dur: 0.3, r_elbow: [9, -7], l_hand: [-13, 21], l_elbow: [-9, -7], r_hand: [14, 21] },
    ],
  },

  // 挥手：保持空占位
  wave: { type: 'gesture', activeJoints: [], keyframes: [], loop: false },

  // 自动贩卖机操作（machine.json）
  use_vending: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [9, -8], r_hand: [14, 16] },
      { dur: 0.3, r_elbow: [10, -8], r_hand: [9, 6] },
      { dur: 0.3, r_elbow: [11, -9], r_hand: [5, -4] },
      { dur: 0.3, r_elbow: [12, -9], r_hand: [1, -14] },
      { dur: 0.3, r_elbow: [10, -8], r_hand: [-1, -9] },
      { dur: 0.3, r_elbow: [10, -8], r_hand: [0, -14] },
      { dur: 0.3, r_elbow: [10, -9], r_hand: [5, -4] },
      { dur: 0.3, r_elbow: [10, -9], r_hand: [11, 5] },
      { dur: 0.3, r_elbow: [10, -9], r_hand: [16, 15] },
    ],
  },

  // 投扔垃圾（trash.json）
  use_trash: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [11, -17], r_hand: [14, 3] },
      { dur: 0.3, r_elbow: [9, -15], r_hand: [10, 4] },
      { dur: 0.3, r_elbow: [8, -14], r_hand: [5, 6] },
      { dur: 0.3, r_elbow: [6, -12], r_hand: [1, 6] },
      { dur: 0.3, r_elbow: [8, -14], r_hand: [5, 6] },
      { dur: 0.3, r_elbow: [9, -15], r_hand: [10, 4] },
      { dur: 0.3, r_elbow: [11, -17], r_hand: [14, 3] },
    ],
  },
};
