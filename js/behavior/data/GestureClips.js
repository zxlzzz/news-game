/**
 * GESTURE_CLIPS — 手势动画片段（关键帧序列，播完自动移除）
 *
 * 每条结构：
 *   {
 *     type: 'gesture',
 *     activeJoints: ['r_elbow', 'r_hand', ...],   // 本片段会驱动的关节
 *     keyframes: [ { dur: 0.4, joints: { r_hand: [dx, dy], ... } }, ... ],
 *     loop: false,
 *   }
 *
 * 触发：由 ModifierLayer 按 NpcProfile.gesturePoses 配置的 on/chance/cooldown 随机触发，
 *       进入 modifiers 队列（kind:'gesture'）逐关键帧播放，播完自动移除。
 *
 * 占位条目 keyframes 为空（不产生位移、立即结束），用 anim-preview / stick-puppet 工具填入。
 */
// keyframe.joints 为关节的「绝对局部坐标」（与 HELD_POSES 同语义，替换该帧关节位置）。
// 基准帧 single F0：r_hand[-10,-18] r_elbow[14,-11]（前伸 = +x）。
export const GESTURE_CLIPS = {
  check_watch: { type: 'gesture', activeJoints: [], keyframes: [], loop: false },
  stretch:     { type: 'gesture', activeJoints: [], keyframes: [], loop: false },
  wave:        { type: 'gesture', activeJoints: [], keyframes: [], loop: false },

  // 自动贩卖机操作：手前伸 → 停顿取物 → 收回（约 2s）
  use_vending: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.6, joints: { r_elbow: [20, -12], r_hand: [38, -16] } },  // 前伸
      { dur: 0.9, joints: { r_elbow: [20, -12], r_hand: [38, -16] } },  // 停顿取物
      { dur: 0.5, joints: { r_elbow: [14, -11], r_hand: [-10, -18] } }, // 收回（回基准）
    ],
  },

  // 投扔垃圾：手臂上抬 → 前送投出 → 收回（约 1s）
  use_trash: {
    type: 'gesture', activeJoints: ['r_elbow', 'r_hand'], loop: false,
    keyframes: [
      { dur: 0.4, joints: { r_elbow: [12, -28], r_hand: [6, -46] } },   // 上抬
      { dur: 0.4, joints: { r_elbow: [20, -14], r_hand: [36, -20] } },  // 前送投出
      { dur: 0.3, joints: { r_elbow: [14, -11], r_hand: [-10, -18] } }, // 收回（回基准）
    ],
  },
};
