export const HELD_POSES = {
  phone_look: { joints: { l_elbow: [-9, -8],   r_elbow: [9, -8],   l_hand: [-4, -18], r_hand: [4,  -18] } },
  // phone.json（单手举至耳边）
  phone_call: { joints: { r_elbow: [-1, 1],    r_hand:  [6,  -54] } },
  // smoke.json
  smoke:      { joints: { r_elbow: [2, -2],    r_hand:  [-14, -60] } },
  // cross_arm.json（全骨架 animation 格式，手臂四关节相对 human 默认姿势的 delta）
  cross_arm:  { joints: { l_elbow: [6, 14], r_elbow: [-5, 13], l_hand: [42, -25], r_hand: [-41, -26] } },
  // 占位：用 stick-puppet 工具 held pose 模式导出后填入
  hands_in_pocket: { joints: { l_elbow: [0, 0], r_elbow: [0, 0], l_hand: [0, 0], r_hand: [0, 0] } },
};
