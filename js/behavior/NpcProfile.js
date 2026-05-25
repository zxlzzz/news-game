/**
 * NpcProfile — NPC 行为档案（纯数据模块）
 *
 * 每个 profile 描述某类 NPC 允许的基础状态、状态转换权重、可用叠加动作、
 * 可参与的 Activity 类型，以及性格/镜头反应倾向。
 *
 * 设计：行为差异从代码搬到数据，BehaviorManager / BaseStateMachine /
 * OverlayLayer / SocialLayer 全部读 profile 决策，所有 NPC 共用同一套引擎。
 *
 * 批次 1：路人（pedestrian/businessman/tourist）扩展到完整日常行为集
 *   - 新增基础状态：squat / sit_ground / lean_wall / lie_bench / get_up
 *   - 新增 overlay：phone_call / smoke（需 smoker trait）/ hold_bag（持久特征）
 *   - 部分状态有环境前置（lean_wall 需靠墙、sit_ground 需附近无椅、lie_bench 需久坐）
 *     由 BaseStateMachine 在选中后检查，不满足则回退 stand。
 */

// 路人共用的状态转换表（方案 B：lean_wall 由 isNearWall 自然过滤，公园行人不触发）
const PED_TRANSITIONS = {
  walk:       { stand: 0.6, sit_bench: 0.2, run: 0.08, squat: 0.01, sit_ground: 0.02 },
  run:        { walk: 0.9, fall: 0.1 },
  stand:      { walk: 0.84, sit_bench: 0.1, sit_ground: 0.03, squat: 0.01, lean_wall: 0.05 },
  sit_bench:  { stand: 0.97, lie_bench: 0.03 },   // lie_bench 需 sit_bench 已持续 >12s
  squat:      { stand: 1.0 },
  sit_ground: { stand: 1.0 },
  fall:       { lie_ground: 1.0 },                // fall 由 animDone 驱动进 lie_ground
  lie_ground: { get_up: 1.0 },                    // lie_ground 计时结束 → 起身过渡
  get_up:     { stand: 1.0 },                     // get_up 由 animDone 驱动进 stand
  lie_bench:  { sit_bench: 1.0 },                 // 躺椅结束 → 短暂坐起
  lean_wall:  { stand: 1.0 },                     // lean_wall 需 isNearWall，否则回退 stand
};

const PED_ALLOWED = [
  'walk', 'run', 'stand', 'sit_bench', 'fall', 'lie_ground',
  'squat', 'sit_ground', 'get_up', 'lean_wall', 'lie_bench',
];

// 持久特征 hold_bag 的兼容状态（由 spawner 给 NPC 设 persistentOverlay 后生效）
const HOLD_BAG = { on: ['walk', 'run', 'stand'], persistent: true };
// 抽烟 overlay：需 smoker trait；靠墙时概率翻倍
const SMOKE = {
  on: ['stand', 'lean_wall', 'sit_bench'], chance: 0.002, dur: [15, 30],
  traitRequired: 'smoker', chanceMultiplier: { lean_wall: 2.0 },
};

const PEDESTRIAN = {
  name: 'pedestrian',
  initial: 'walk',
  allowedStates: PED_ALLOWED,
  transitions: PED_TRANSITIONS,
  overlays: {
    phone_look: { on: ['walk', 'stand'], chance: 0.004, dur: [5, 25] },
    phone_call: { on: ['walk', 'stand', 'sit_bench'], chance: 0.002, dur: [10, 20] },
    smoke:      SMOKE,
    hold_bag:   HOLD_BAG,
  },
  activities: ['talk'],
  traits: {},
  cameraReaction: 'neutral',
};

const BUSINESSMAN = {
  ...PEDESTRIAN,
  name: 'businessman',
  overlays: {
    phone_look: { on: ['walk', 'stand'], chance: 0.006, dur: [5, 25] },
    phone_call: { on: ['walk', 'stand', 'sit_bench', 'lean_wall'], chance: 0.004, dur: [10, 20] },
    smoke:      SMOKE,
    hold_bag:   HOLD_BAG,
  },
};

// 游客：蹲下看地图/坐地上休息概率稍高
const TOURIST = {
  ...PEDESTRIAN,
  name: 'tourist',
  transitions: {
    ...PED_TRANSITIONS,
    walk:  { stand: 0.55, sit_bench: 0.18, run: 0.06, squat: 0.02, sit_ground: 0.05, lean_wall: 0.01 },
    stand: { walk: 0.78, sit_bench: 0.08, sit_ground: 0.07, squat: 0.02, lean_wall: 0.05 },
  },
  overlays: {
    phone_look: { on: ['walk', 'stand', 'sit_ground', 'squat'], chance: 0.005, dur: [5, 25] },
    phone_call: { on: ['walk', 'stand'], chance: 0.002, dur: [10, 20] },
    smoke:      SMOKE,
    hold_bag:   HOLD_BAG,
  },
};

const CHESS_PLAYER = {
  name: 'chess_player',
  initial: 'walk',
  allowedStates: ['walk', 'stand', 'sit_bench'],
  transitions: { walk: { stand: 1.0 }, stand: { walk: 1.0 }, sit_bench: { stand: 1.0 } },
  overlays: {},
  activities: ['talk', 'chess'],
  traits: {},
  cameraReaction: 'neutral',
};

const CHESS_ONLOOKER = {
  name: 'chess_onlooker',
  initial: 'stand',
  allowedStates: ['walk', 'stand'],
  transitions: { walk: { stand: 1.0 }, stand: { walk: 1.0 } },
  overlays: {},
  activities: ['chess_watch'],
  traits: {},
  cameraReaction: 'neutral',
};

const DOG_OWNER = {
  name: 'dog_owner',
  initial: 'walk',
  allowedStates: ['walk', 'stand'],
  transitions: { walk: { stand: 1.0 }, stand: { walk: 1.0 } },
  overlays: {},
  activities: ['dog_walk'],
  traits: {},
  cameraReaction: 'neutral',
};

// 运动者：持续慢跑（transitions 为空 → 永不切换，复刻纯 jog 行为）
const ATHLETE = {
  name: 'athlete',
  initial: 'jog',
  allowedStates: ['walk', 'run', 'jog', 'stand'],
  transitions: {},
  overlays: {},
  activities: [],
  traits: {},
  cameraReaction: 'neutral',
};

export const PROFILES = {
  pedestrian:     PEDESTRIAN,
  businessman:    BUSINESSMAN,
  tourist:        TOURIST,
  chess_player:   CHESS_PLAYER,
  chess_onlooker: CHESS_ONLOOKER,
  dog_owner:      DOG_OWNER,
  athlete:        ATHLETE,
};

/** 取得指定 profile；缺失时回退到 pedestrian */
export function getProfile(name) {
  return PROFILES[name] || PROFILES.pedestrian;
}
