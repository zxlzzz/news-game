// 参考帧（single.json F0）：
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
