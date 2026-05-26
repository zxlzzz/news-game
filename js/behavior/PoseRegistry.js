/**
 * PoseRegistry — overlay / loiter / 社交子事件关节坐标（纯数据，无依赖）
 *
 * 本模块是游戏运行时与 anim-preview 调试工具共享的唯一 pose 数据源：
 *   NpcProfile.js     — import OVERLAY_POSES   （cross_arm pose）
 *   BaseStateMachine  — import LOITER_POSES    （loiter 微行为视觉）
 *   SocialLayer.js    — import SUB_EVENT_POSES （子事件 aDelta / bDelta）
 *   sth/anim-preview  — 直接 import，可实时编辑并导出回本文件
 *
 * 坐标系：与 single.json 一致；x 正向 = 面朝方向，y 正向 = 向下。
 */

// ─── Overlay 绝对关节坐标（single.json rest-frame 局部空间）─────────────────
export const OVERLAY_POSES = {
  phone_look: { l_elbow: [-9, -8],   r_elbow: [9, -8],   l_hand: [-4, -18], r_hand: [4,  -18] },
  phone_call: { r_elbow: [14, -5],   r_hand:  [14,  2]   },
  smoke:      { r_elbow: [12, -8],   r_hand:  [10, -18]  },
  cross_arm:  { l_elbow: [-14, -11], r_elbow: [14, -11],  l_hand: [9,  -19], r_hand: [-10, -18] },
  hold_bag:   { r_elbow: [16, -5],   r_hand:  [18,   5]  },
};

// ─── Loiter 微行为 pose（_applyLoiterVisuals 按阶段写入 npc.overlayPose）───
export const LOITER_POSES = {
  phone:  { l_elbow: [-9, -8],  r_elbow: [9, -8],  l_hand: [-4, -18], r_hand: [4,  -18] },
  bag_a:  { r_elbow: [12, -8],  r_hand:  [16,  -3] },
  bag_b:  { l_elbow: [-12, -8], l_hand:  [-16, -3] },
};

// ─── 社交子事件 delta pose（相对于 _captureBasePose 捕获值的偏移量）────────
// 参考帧（single.json F0 实测）：
//   r_hand[-10,-18]  l_hand[9,-19]  r_elbow[14,-11]  l_elbow[-14,-11]  head[-6,-55]
export const SUB_EVENT_POSES = {
  push: {
    aDelta: { r_hand: [55, -3], r_elbow: [8, -4], l_hand: [35, -2], l_elbow: [32, -4] },
    bDelta: null,
  },
  give_item: {
    aDelta: { r_hand: [50, -3], r_elbow: [8, -3] },
    bDelta: { l_hand: [35, -3], l_elbow: [20, -3] },
  },
  handshake: {
    aDelta: { r_hand: [40, -3], r_elbow: [6, -2] },
    bDelta: { l_hand: [30, -3], l_elbow: [15, -2] },
  },
  point_at: {
    aDelta: { r_hand: [60, -2], r_elbow: [10, -4] },
    bDelta: { head:  [-5,  2] },
  },
};
