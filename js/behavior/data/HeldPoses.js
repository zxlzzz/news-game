export const HELD_POSES = {
  phone_look: { joints: { l_elbow: [-9, -8],   r_elbow: [9, -8],   l_hand: [-4, -18], r_hand: [4,  -18] } },
  // phone.json（单手举至耳边）；绝对局部坐标
  phone_call: { joints: { r_elbow: [23, -39],  r_hand:  [38, -66] } },
  // smoke.json；绝对局部坐标
  smoke:      { joints: { r_elbow: [26, -42],  r_hand:  [18, -72] } },
  // cross_arm.json（全骨架 animation）手臂四关节绝对坐标 → 双手交叉胸前
  cross_arm:  { joints: { l_elbow: [-18, -26], r_elbow: [19, -27], l_hand: [10, -37], r_hand: [-9, -38] } },
  // 占位：用 stick-puppet 工具 held pose 模式导出后填入
  hands_in_pocket: { joints: { l_elbow: [0, 0], r_elbow: [0, 0], l_hand: [0, 0], r_hand: [0, 0] } },
};
