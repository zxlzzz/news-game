export const HELD_POSES = {
  phone_look: { joints: { l_elbow: [-9, -8],   r_elbow: [9, -8],   l_hand: [-4, -18], r_hand: [4,  -18] } },
  // phone.json（单手举至耳侧）；游戏坐标系绝对值
  phone_call: { joints: { r_elbow: [10, -16],  r_hand:  [17, -35] } },
  // smoke.json（手举至嘴边）；游戏坐标系绝对值
  smoke:      { joints: { r_elbow: [12, -18],  r_hand:  [8,  -39] } },
  // cross_arm.json（全骨架）手臂四关节 → 游戏坐标系绝对值，双手交叉胸前
  cross_arm:  { joints: { l_elbow: [-8, -7],   r_elbow: [9, -7],   l_hand: [5, -14],  r_hand: [-4, -15] } },
  // 占位：用 stick-puppet 工具 held pose 模式导出后填入
  hands_in_pocket: { joints: { l_elbow: [0, 0], r_elbow: [0, 0], l_hand: [0, 0], r_hand: [0, 0] } },
};
