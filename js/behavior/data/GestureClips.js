/**
 * GESTURE_CLIPS — 手势动画片段（关键帧序列，播完自动移除）
 *
 * 关键帧为「扁平格式」（与 stick-puppet 工具导出一致，可直接粘贴）：
 *   { type: 'gesture', activeJoints: [...],
 *     keyframes: [ { dur: 0.3, r_elbow: [x, y], r_hand: [x, y], ... }, ... ],
 *     loop: false }
 *   每个 keyframe 除 dur 外的键即该帧驱动的关节（绝对局部坐标，替换该关节位置）。
 *
 * 触发：ModifierLayer 按 NpcProfile.gesturePoses 的 on/chance 随机触发，
 *       进 modifiers 队列（kind:'gesture'）逐关键帧播放，播完自动移除。
 * 空 keyframes 的占位 clip 立即结束、不产生位移。
 */
export const GESTURE_CLIPS = {
  // 看表（watch.json）
  check_watch: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [14, -24], r_hand: [28, 9] },
      { dur: 0.3, r_elbow: [18, -28], r_hand: [16, -8] },
      { dur: 0.3, r_elbow: [22, -32], r_hand: [4, -25] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [26, -36], r_hand: [-8, -41] },
      { dur: 0.3, r_elbow: [22, -32], r_hand: [4, -25] },
      { dur: 0.3, r_elbow: [18, -28], r_hand: [16, -8] },
      { dur: 0.3, r_elbow: [14, -24], r_hand: [28, 9] },
    ],
  },

  // 伸展（stretch.json）
  stretch: {
    type: 'gesture', activeJoints: ['r_elbow', 'l_hand', 'neck', 'l_elbow', 'r_hand', 'head'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [19, -27], l_hand: [-30, 12], neck: [0, -50], l_elbow: [-19, -27], r_hand: [30, 12], head: [0, -70] },
      { dur: 0.3, r_elbow: [17, -26], l_hand: [-21, -13], neck: [0, -50], l_elbow: [-17, -26], r_hand: [19, -12], head: [0, -70] },
      { dur: 0.3, r_elbow: [16, -25], l_hand: [-12, -37], neck: [0, -50], l_elbow: [-16, -25], r_hand: [9, -36], head: [0, -70] },
      { dur: 0.3, r_elbow: [15, -24], l_hand: [-3, -62], neck: [0, -50], l_elbow: [-14, -24], r_hand: [-2, -60], head: [0, -70] },
      { dur: 0.3, r_elbow: [9, -42], l_hand: [-13, -76], neck: [-2, -50], l_elbow: [-20, -37], r_hand: [-12, -75], head: [-3, -70] },
      { dur: 0.3, r_elbow: [4, -60], l_hand: [-23, -91], neck: [-4, -49], l_elbow: [-26, -51], r_hand: [-21, -91], head: [-6, -69] },
      { dur: 0.3, r_elbow: [-2, -78], l_hand: [-33, -105], neck: [-7, -49], l_elbow: [-32, -65], r_hand: [-31, -106], head: [-10, -69] },
      { dur: 0.3, r_elbow: [-2, -78], l_hand: [-33, -105], neck: [-7, -49], l_elbow: [-32, -65], r_hand: [-31, -106], head: [-10, -69] },
      { dur: 0.3, r_elbow: [-2, -78], l_hand: [-33, -105], neck: [-7, -49], l_elbow: [-32, -65], r_hand: [-31, -106], head: [-10, -69] },
      { dur: 0.3, r_elbow: [-2, -78], l_hand: [-33, -105], neck: [-7, -49], l_elbow: [-32, -65], r_hand: [-31, -106], head: [-10, -69] },
      { dur: 0.3, r_elbow: [-2, -78], l_hand: [-33, -105], neck: [-7, -49], l_elbow: [-32, -65], r_hand: [-31, -106], head: [-10, -69] },
      { dur: 0.3, r_elbow: [-2, -78], l_hand: [-33, -105], neck: [-7, -49], l_elbow: [-32, -65], r_hand: [-31, -106], head: [-10, -69] },
      { dur: 0.3, r_elbow: [-2, -78], l_hand: [-33, -105], neck: [-7, -49], l_elbow: [-32, -65], r_hand: [-31, -106], head: [-10, -69] },
      { dur: 0.3, r_elbow: [-2, -78], l_hand: [-33, -105], neck: [-7, -49], l_elbow: [-32, -65], r_hand: [-31, -106], head: [-10, -69] },
      { dur: 0.3, r_elbow: [-2, -78], l_hand: [-33, -105], neck: [-7, -49], l_elbow: [-32, -65], r_hand: [-31, -106], head: [-10, -69] },
      { dur: 0.3, r_elbow: [-2, -78], l_hand: [-33, -105], neck: [-7, -49], l_elbow: [-32, -65], r_hand: [-31, -106], head: [-10, -69] },
      { dur: 0.3, r_elbow: [2, -68], l_hand: [-32, -82], neck: [-6, -49], l_elbow: [-29, -57], r_hand: [-19, -82], head: [-8, -69] },
      { dur: 0.3, r_elbow: [6, -58], l_hand: [-32, -58], neck: [-4, -49], l_elbow: [-27, -50], r_hand: [-7, -59], head: [-6, -69] },
      { dur: 0.3, r_elbow: [11, -47], l_hand: [-31, -35], neck: [-3, -50], l_elbow: [-24, -42], r_hand: [6, -35], head: [-4, -70] },
      { dur: 0.3, r_elbow: [15, -37], l_hand: [-31, -11], neck: [-1, -50], l_elbow: [-22, -35], r_hand: [18, -12], head: [-2, -70] },
      { dur: 0.3, r_elbow: [19, -27], l_hand: [-30, 12], neck: [0, -50], l_elbow: [-19, -27], r_hand: [30, 12], head: [0, -70] },
    ],
  },

  // 挥手：保持空占位
  wave: { type: 'gesture', activeJoints: [], keyframes: [], loop: false },

  // 自动贩卖机操作（machine.json）
  use_vending: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [19, -27], r_hand: [28, 7] },
      { dur: 0.3, r_elbow: [18, -26], r_hand: [20, -4] },
      { dur: 0.3, r_elbow: [18, -26], r_hand: [11, -15] },
      { dur: 0.3, r_elbow: [17, -25], r_hand: [3, -26] },
      { dur: 0.3, r_elbow: [16, -25], r_hand: [-6, -37] },
      { dur: 0.3, r_elbow: [16, -25], r_hand: [-8, -31] },
      { dur: 0.3, r_elbow: [16, -25], r_hand: [-6, -37] },
      { dur: 0.3, r_elbow: [17, -25], r_hand: [3, -26] },
      { dur: 0.3, r_elbow: [18, -26], r_hand: [11, -15] },
      { dur: 0.3, r_elbow: [18, -26], r_hand: [20, -4] },
      { dur: 0.3, r_elbow: [19, -27], r_hand: [28, 7] },
    ],
  },

  // 投扔垃圾（trash.json）
  use_trash: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.3, r_elbow: [19, -27], r_hand: [28, 7] },
      { dur: 0.3, r_elbow: [17, -26], r_hand: [28, -8] },
      { dur: 0.3, r_elbow: [15, -24], r_hand: [28, -23] },
      { dur: 0.3, r_elbow: [13, -23], r_hand: [28, -38] },
      { dur: 0.3, r_elbow: [12, -22], r_hand: [28, -53] },
      { dur: 0.3, r_elbow: [20, -31], r_hand: [46, -44] },
      { dur: 0.3, r_elbow: [28, -40], r_hand: [63, -35] },
      { dur: 0.3, r_elbow: [25, -36], r_hand: [51, -21] },
      { dur: 0.3, r_elbow: [22, -31], r_hand: [40, -7] },
      { dur: 0.3, r_elbow: [19, -27], r_hand: [28, 7] },
    ],
  },
};
