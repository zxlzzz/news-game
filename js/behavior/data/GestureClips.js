/**
 * GESTURE_CLIPS — 手势动画片段（关键帧序列，播完自动移除）
 *
 * 关键帧为「扁平格式」（{dur, r_elbow:[x,y], r_hand:[x,y], ...}），关节值为
 * 【游戏坐标系】绝对局部坐标。由 stick-puppet 编辑器姿势经「角度重建」换算而来：
 * 保留各关节相对父节点的角度，用游戏骨长（single.json）锚定游戏 neck 重建，
 * 使姿势一致且幅度匹配，不会飞出画面。仅覆盖手臂（elbow/hand），躯干/头颈/腿不覆盖。
 * ModifierLayer 逐关键帧用 kfJoints(kf) 提取关节（剔除 dur）替换该帧关节位置。
 *
 * 数据来源 assets/animations/gesture/*.json（编辑器坐标系）。空占位 clip 立即结束。
 */
export const GESTURE_CLIPS = {
  // 看表（watch.json）
  check_watch: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [16, -12], r_hand: [24, 11] },
      { dur: 0.3, r_elbow: [12, -10], r_hand: [12, 15] },
      { dur: 0.3, r_elbow: [15, -12], r_hand: [-8, -2] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [18, -13], r_hand: [-7, -17] },
      { dur: 0.3, r_elbow: [15, -12], r_hand: [-8, -2] },
      { dur: 0.3, r_elbow: [11, -10], r_hand: [9, 15] },
      { dur: 0.3, r_elbow: [8, -8], r_hand: [18, 14] },
    ],
  },

  // 伸展（stretch.json）；仅手臂，头颈保持基准
  stretch: {
    type: 'gesture', activeJoints: ['l_elbow', 'l_hand', 'r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, l_elbow: [-20, -15], l_hand: [-27, 8], r_elbow: [19, -14], r_hand: [25, 10] },
      { dur: 0.3, l_elbow: [-18, -14], l_hand: [-25, 9], r_elbow: [17, -13], r_hand: [20, 12] },
      { dur: 0.3, l_elbow: [-17, -13], l_hand: [-9, -36], r_elbow: [16, -12], r_hand: [2, -33] },
      { dur: 0.3, l_elbow: [-15, -12], l_hand: [-8, -35], r_elbow: [14, -11], r_hand: [4, -34] },
      { dur: 0.3, l_elbow: [-25, -21], l_hand: [-21, -44], r_elbow: [24, -20], r_hand: [11, -41] },
      { dur: 0.3, l_elbow: [-31, -41], l_hand: [-29, -65], r_elbow: [17, -63], r_hand: [1, -82] },
      { dur: 0.3, l_elbow: [-26, -54], l_hand: [-27, -78], r_elbow: [4, -68], r_hand: [-14, -86] },
      { dur: 0.3, l_elbow: [-26, -54], l_hand: [-27, -78], r_elbow: [4, -68], r_hand: [-14, -86] },
      { dur: 0.3, l_elbow: [-26, -54], l_hand: [-27, -78], r_elbow: [4, -68], r_hand: [-14, -86] },
      { dur: 0.3, l_elbow: [-26, -54], l_hand: [-27, -78], r_elbow: [4, -68], r_hand: [-14, -86] },
      { dur: 0.3, l_elbow: [-26, -54], l_hand: [-27, -78], r_elbow: [4, -68], r_hand: [-14, -86] },
      { dur: 0.3, l_elbow: [-26, -54], l_hand: [-27, -78], r_elbow: [4, -68], r_hand: [-14, -86] },
      { dur: 0.3, l_elbow: [-26, -54], l_hand: [-27, -78], r_elbow: [4, -68], r_hand: [-14, -86] },
      { dur: 0.3, l_elbow: [-26, -54], l_hand: [-27, -78], r_elbow: [4, -68], r_hand: [-14, -86] },
      { dur: 0.3, l_elbow: [-26, -54], l_hand: [-27, -78], r_elbow: [4, -68], r_hand: [-14, -86] },
      { dur: 0.3, l_elbow: [-26, -54], l_hand: [-27, -78], r_elbow: [4, -68], r_hand: [-14, -86] },
      { dur: 0.3, l_elbow: [-29, -48], l_hand: [-32, -72], r_elbow: [11, -66], r_hand: [-10, -80] },
      { dur: 0.3, l_elbow: [-31, -39], l_hand: [-44, -60], r_elbow: [22, -59], r_hand: [-3, -61] },
      { dur: 0.3, l_elbow: [-29, -27], l_hand: [-46, -10], r_elbow: [29, -32], r_hand: [20, -8] },
      { dur: 0.3, l_elbow: [-25, -21], l_hand: [-34, 2], r_elbow: [23, -19], r_hand: [26, 6] },
      { dur: 0.3, l_elbow: [-20, -15], l_hand: [-27, 8], r_elbow: [19, -14], r_hand: [25, 10] },
    ],
  },

  // 挥手：保持空占位
  wave: { type: 'gesture', activeJoints: [], keyframes: [], loop: false },

  // 自动贩卖机操作（machine.json）
  use_vending: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [12, -10], r_hand: [19, 14] },
      { dur: 0.3, r_elbow: [13, -11], r_hand: [12, 14] },
      { dur: 0.3, r_elbow: [15, -11], r_hand: [-7, 1] },
      { dur: 0.3, r_elbow: [16, -12], r_hand: [-9, -18] },
      { dur: 0.3, r_elbow: [14, -11], r_hand: [-11, -13] },
      { dur: 0.3, r_elbow: [14, -11], r_hand: [-10, -19] },
      { dur: 0.3, r_elbow: [14, -11], r_hand: [-8, 1] },
      { dur: 0.3, r_elbow: [14, -11], r_hand: [15, 14] },
      { dur: 0.3, r_elbow: [14, -11], r_hand: [23, 12] },
    ],
  },

  // 投扔垃圾（trash.json）
  use_trash: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [18, -14], r_hand: [25, 10] },
      { dur: 0.3, r_elbow: [16, -12], r_hand: [17, 13] },
      { dur: 0.3, r_elbow: [13, -10], r_hand: [8, 14] },
      { dur: 0.3, r_elbow: [10, -9], r_hand: [0, 14] },
      { dur: 0.3, r_elbow: [13, -10], r_hand: [8, 14] },
      { dur: 0.3, r_elbow: [16, -12], r_hand: [17, 13] },
      { dur: 0.3, r_elbow: [18, -14], r_hand: [25, 10] },
    ],
  },
};
