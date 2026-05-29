/**
 * NpcProfile — NPC 行为档案（纯数据模块）
 *
 * 每个 profile 描述某类 NPC 允许的基础状态、状态转换权重、可用 held 修饰器、
 * 可参与的 Activity 类型，以及性格/镜头反应倾向。
 *
 * 设计：行为差异从代码搬到数据，BehaviorManager / BaseStateMachine /
 * ModifierLayer / SocialLayer 全部读 profile 决策，所有 NPC 共用同一套引擎。
 *
 * heldPoses 中每条定义 pose 数据由 ModifierLayer 从 HeldPoses.js 查取，
 * profile 只声明触发条件（on / chance / dur / traitRequired）。
 */

// 路人共用的状态转换表
const PED_TRANSITIONS = {
  walk:       { stand: 0.6, sit_bench: 0.2, run: 0.08, squat: 0.01, sit_ground: 0.02 },
  run:        { walk: 0.9, fall: 0.1 },
  stand:      { walk: 0.77, sit_bench: 0.1, sit_ground: 0.03, squat: 0.01, lean_wall: 0.05, loiter: 0.07 },
  sit_bench:  { stand: 0.97, lie_bench: 0.03 },
  squat:      { stand: 1.0 },
  sit_ground: { stand: 1.0 },
  fall:       { lie_ground: 1.0 },
  lie_ground: { get_up: 1.0 },
  get_up:     { stand: 1.0 },
  lie_bench:  { sit_bench: 1.0 },
  lean_wall:  { stand: 1.0 },
};

const PED_ALLOWED = [
  'walk', 'run', 'stand', 'sit_bench', 'fall', 'lie_ground',
  'squat', 'sit_ground', 'get_up', 'lean_wall', 'lie_bench', 'loiter',
];

// 抽烟 held pose：需 smoker trait；靠墙时概率翻倍
const SMOKE = {
  on: ['stand', 'lean_wall', 'sit_bench', 'loiter'], chance: 0.0008, dur: [15, 30],
  traitRequired: 'smoker', chanceMultiplier: { lean_wall: 2.0 },
};
// 抱臂 held pose：stand 状态下偶尔交叉双臂；持包/遛狗者手已被占用，排除
const CROSS_ARM = {
  on: ['stand'], chance: 0.001, dur: [8, 20],
  traitExcludes: ['hold_bag', 'walk_dog'],
};

const PEDESTRIAN = {
  name: 'pedestrian',
  initial: 'walk',
  allowedStates: PED_ALLOWED,
  transitions: PED_TRANSITIONS,
  heldPoses: {
    phone_look: { on: ['walk', 'stand', 'loiter'], chance: 0.001, dur: [8, 30] },
    phone_call: { on: ['walk', 'stand', 'sit_bench', 'loiter'], chance: 0.0008, dur: [10, 25] },
    smoke:      SMOKE,
    cross_arm:  CROSS_ARM,
  },
  spawnTraits: ['hold_bag'],
  activities: ['talk', 'chess'],
  traits: {},
  cameraReaction: 'neutral',
  socialWeights: { push: 0.04, give_item: 0.05, handshake: 0.06, point_at: 0.05 },
  loiterChance: 0.25,
  loiterDurationRange: [15, 45],
  departure: { lifespanRange: [90, 210], preferExitType: null },
};

const BUSINESSMAN = {
  ...PEDESTRIAN,
  name: 'businessman',
  activities: ['talk'],
  heldPoses: {
    phone_look: { on: ['walk', 'stand', 'loiter'], chance: 0.0015, dur: [8, 30] },
    phone_call: { on: ['walk', 'stand', 'sit_bench', 'lean_wall', 'loiter'], chance: 0.001, dur: [10, 25] },
    smoke:      SMOKE,
    cross_arm:  CROSS_ARM,
  },
  socialWeights: { push: 0.02, give_item: 0.05, handshake: 0.08, point_at: 0.05 },
  loiterChance: 0.12,
  loiterDurationRange: [15, 40],
  departure: { lifespanRange: [90, 210], preferExitType: 'building' },
};

const TOURIST = {
  ...PEDESTRIAN,
  name: 'tourist',
  transitions: {
    ...PED_TRANSITIONS,
    walk:  { stand: 0.55, sit_bench: 0.18, run: 0.06, squat: 0.02, sit_ground: 0.05, lean_wall: 0.01 },
    stand: { walk: 0.68, sit_bench: 0.08, sit_ground: 0.07, squat: 0.02, lean_wall: 0.05, loiter: 0.10 },
  },
  heldPoses: {
    phone_look: { on: ['walk', 'stand', 'sit_ground', 'squat', 'loiter'], chance: 0.001, dur: [8, 30] },
    phone_call: { on: ['walk', 'stand', 'loiter'], chance: 0.0008, dur: [10, 25] },
    smoke:      SMOKE,
    cross_arm:  CROSS_ARM,
  },
  activities: ['talk', 'chess'],
  socialWeights: { push: 0.03, give_item: 0.06, handshake: 0.05, point_at: 0.06 },
  loiterChance: 0.40,
  loiterDurationRange: [20, 60],
  departure: { lifespanRange: [90, 210], preferExitType: null },
};

const CHESS_PLAYER = {
  name: 'chess_player',
  initial: 'walk',
  allowedStates: ['walk', 'stand', 'sit_bench'],
  transitions: { walk: { stand: 1.0 }, stand: { walk: 1.0 }, sit_bench: { stand: 1.0 } },
  heldPoses: {},
  activities: ['talk', 'chess'],
  traits: {},
  cameraReaction: 'neutral',
};

const CHESS_ONLOOKER = {
  name: 'chess_onlooker',
  initial: 'stand',
  allowedStates: ['stand', 'squat', 'sit_ground'],
  transitions: {
    stand:      { squat: 0.10, sit_ground: 0.06 },
    squat:      { stand: 1.0 },
    sit_ground: { stand: 1.0 },
  },
  heldPoses: {
    phone_look: { on: ['stand'], chance: 0.001, dur: [8, 25] },
    cross_arm:  CROSS_ARM,
  },
  activities: ['talk', 'chess_watch'],
  traits: {},
  cameraReaction: 'neutral',
  socialWeights: { push: 0.02, give_item: 0.04, handshake: 0.05, point_at: 0.04 },
};

const DOG_OWNER = {
  name: 'dog_owner',
  initial: 'walk',
  allowedStates: ['walk', 'stand'],
  transitions: { walk: { stand: 1.0 }, stand: { walk: 1.0 } },
  heldPoses: {},
  activities: ['dog_walk'],
  traits: {},
  cameraReaction: 'neutral',
};

const ATHLETE = {
  name: 'athlete',
  initial: 'jog',
  allowedStates: ['walk', 'run', 'jog', 'stand'],
  transitions: {},
  heldPoses: {},
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
