export const HELD_POSES = {
  phone_look: { joints: { l_elbow: [-9, -8],   r_elbow: [9, -8],   l_hand: [-4, -18], r_hand: [4,  -18] } },
  // phone.json（单手举至耳侧）；游戏坐标系，角度重建自编辑器姿势
  phone_call: { joints: { r_elbow: [17, -13], r_hand: [30, -35] } },
  // smoke.json（手举至嘴边）
  smoke:      { joints: { r_elbow: [20, -15], r_hand: [14, -40] } },
  // cross_arm.json（全骨架）→ 双手交叉胸前
  cross_arm:  { joints: { l_elbow: [-19, -14], l_hand: [4, -23], r_elbow: [19, -14], r_hand: [-5, -23] } },
  // 占位：用 stick-puppet 工具 held pose 模式导出后填入
  hands_in_pocket: { joints: { l_elbow: [0, 0], r_elbow: [0, 0], l_hand: [0, 0], r_hand: [0, 0] } },
};
