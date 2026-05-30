export const TRAIT_PROPS = {
  // hold.json（左手提物）；游戏坐标系绝对值
  hold_bag: { joints: { l_elbow: [-9, -14], l_hand: [-9, 7] } },
  walk_dog: { joints: { l_elbow: [-6, -12], l_hand: [-2, -6] } },
  // 占位：用 stick-puppet 工具 trait 模式（仅左侧关节）导出后填入
  backpack: { joints: { l_elbow: [0, 0], l_hand: [0, 0] } },
  umbrella: { joints: { l_elbow: [0, 0], l_hand: [0, 0] } },
};
