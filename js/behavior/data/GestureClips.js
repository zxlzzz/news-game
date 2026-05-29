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
export const GESTURE_CLIPS = {
  check_watch: { type: 'gesture', activeJoints: [], keyframes: [], loop: false },
  stretch:     { type: 'gesture', activeJoints: [], keyframes: [], loop: false },
  wave:        { type: 'gesture', activeJoints: [], keyframes: [], loop: false },
};
