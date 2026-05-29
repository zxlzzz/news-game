export const HELD_POSES = {
  phone_look: { joints: { l_elbow: [-9, -8],   r_elbow: [9, -8],   l_hand: [-4, -18], r_hand: [4,  -18] } },
  phone_call: { joints: { r_elbow: [14, -30],   r_hand:  [14,  -50]   } },
  smoke:      { joints: { r_elbow: [12, -30],   r_hand:  [10, -50]  } },
  cross_arm:  { joints: { l_elbow: [-14, -11], r_elbow: [14, -11],  l_hand: [9,  -19], r_hand: [-10, -18] } },
  // 占位：用 stick-puppet 工具 held pose 模式导出后填入
  hands_in_pocket: { joints: { l_elbow: [0, 0], r_elbow: [0, 0], l_hand: [0, 0], r_hand: [0, 0] } },
};
