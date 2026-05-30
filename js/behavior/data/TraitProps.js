export const TRAIT_PROPS = {
  // hold.json（左手提物）
  hold_bag: { joints: { l_elbow: [5, 3], l_hand: [13, 5] } },
  walk_dog: { joints: { l_elbow: [-6, -12], l_hand: [-2, -6] } },
  // 占位：用 stick-puppet 工具 trait 模式（仅左侧关节）导出后填入
  backpack: { joints: { l_elbow: [0, 0], l_hand: [0, 0] } },
  umbrella: { joints: { l_elbow: [0, 0], l_hand: [0, 0] } },
};
