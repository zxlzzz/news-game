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
// sit_bench 已从 walk/stand 行移除 — UseBenchTask（Agenda 驱动）负责落座
const PED_TRANSITIONS = {
  walk:       { stand: 0.6, run: 0.08, squat: 0.01, sit_ground: 0.02, loiter: 0.02 },
  run:        { walk: 0.9, fall: 0.001 },
  stand:      { walk: 0.77, sit_ground: 0.03, squat: 0.01, lean_wall: 0.05, loiter: 0.04 },
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
  on: ['stand', 'lean_wall', 'sit_bench', 'loiter'], chance: 0.0003, dur: [15, 30],
  traitRequired: 'smoker', chanceMultiplier: { lean_wall: 2.0 },
};
// 抱臂 held pose：stand 状态下偶尔交叉双臂；持包/遛狗者手已被占用，排除
const CROSS_ARM = {
  on: ['stand'], chance: 0.0004, dur: [8, 20],
  traitExcludes: ['hold_bag', 'walk_dog'],
};
// 兜手 held pose：站立/逗留时双手插兜；持物/遛狗者排除
const HANDS_IN_POCKET = {
  on: ['stand', 'lean_wall', 'loiter'], chance: 0.0003, dur: [10, 25],
  traitExcludes: ['hold_bag', 'walk_dog'],
};

// 路人共用的 gesture 触发表
//   chance 为每帧触发概率；dur 由 clip 关键帧累计决定，无需在此声明
const PED_GESTURES = {
  check_watch:    { on: ['stand', 'loiter'],         chance: 0.0003,  traitExcludes: ['hold_bag', 'walk_dog'] },
  stretch:        { on: ['stand', 'loiter'],         chance: 0.00008, traitExcludes: ['hold_bag', 'walk_dog'] },
  yawn:           { on: ['stand', 'loiter'],         chance: 0.0001 },
  look_around:    { on: ['stand', 'loiter'],         chance: 0.0002 },
  adjust_clothes: { on: ['stand', 'loiter'],         chance: 0.0001,  traitExcludes: ['hold_bag', 'walk_dog'] },
  wave:           { on: ['stand', 'loiter'],         chance: 0.0002 },
  // moving gesture：行走/奔跑中触发
  moving_check_watch: { on: ['walk', 'run'], chance: 0.0003, traitExcludes: ['hold_bag', 'walk_dog'] },
  moving_wipe_sweat:  { on: ['walk', 'run'], chance: 0.0003, traitExcludes: ['hold_bag', 'walk_dog'] },
};

const PEDESTRIAN = {
  name: 'pedestrian',
  initial: 'walk',
  allowedStates: PED_ALLOWED,
  transitions: PED_TRANSITIONS,
  heldPoses: {
    phone_look: { on: ['stand', 'loiter', 'sit_bench', 'lean_wall'], chance: 0.0004, dur: [8, 30] },
    phone_call: { on: ['stand', 'loiter', 'sit_bench', 'lean_wall'], chance: 0.0003, dur: [10, 25] },
    smoke:      SMOKE,
    cross_arm:  CROSS_ARM,
    hands_in_pocket: HANDS_IN_POCKET,
  },
  gesturePoses: PED_GESTURES,
  spawnTraits: ['hold_bag', 'umbrella'],
  activities: ['talk', 'chess', 'chess_onlooker', 'use_vending', 'use_trash', 'stall_buyer'],
  desires: ['rest', 'use_vending', 'use_trash'],
  traits: {},
  cameraReaction: 'neutral',
  socialWeights: { push: 0.04, give_item: 0.05, handshake: 0.06, point_at: 0.05 },
  loiterChance: 0.10,
  loiterDurationRange: [15, 45],
  jaywalkChance: 0.10,
  departure: { lifespanRange: [90, 210], preferExitType: null },
  speedRange: [20, 34],
};

const BUSINESSMAN = {
  ...PEDESTRIAN,
  name: 'businessman',
  desires: ['use_vending'],
  activities: ['talk', 'use_vending', 'stall_buyer'],
  heldPoses: {
    phone_look: { on: ['stand', 'loiter', 'sit_bench', 'lean_wall'], chance: 0.0006, dur: [8, 30] },
    phone_call: { on: ['stand', 'loiter', 'sit_bench', 'lean_wall'], chance: 0.0004, dur: [10, 25] },
    smoke:      SMOKE,
    cross_arm:  CROSS_ARM,
    hands_in_pocket: HANDS_IN_POCKET,
  },
  socialWeights: { push: 0.02, give_item: 0.05, handshake: 0.08, point_at: 0.05 },
  loiterChance: 0.06,
  loiterDurationRange: [15, 40],
  jaywalkChance: 0.20,
  departure: { lifespanRange: [90, 210], preferExitType: 'building' },
  speedRange: [28, 40],
};

const TOURIST = {
  ...PEDESTRIAN,
  name: 'tourist',
  desires: ['rest', 'use_vending'],
  transitions: {
    ...PED_TRANSITIONS,
    walk:  { stand: 0.55, run: 0.06, squat: 0.02, sit_ground: 0.05, lean_wall: 0.01 },
    stand: { walk: 0.68, sit_ground: 0.07, squat: 0.02, lean_wall: 0.05, loiter: 0.10 },
  },
  heldPoses: {
    phone_look: { on: ['stand', 'loiter', 'sit_bench', 'lean_wall'], chance: 0.0004, dur: [8, 30] },
    phone_call: { on: ['stand', 'loiter', 'sit_bench', 'lean_wall'], chance: 0.0003, dur: [10, 25] },
    smoke:      SMOKE,
    cross_arm:  CROSS_ARM,
    hands_in_pocket: HANDS_IN_POCKET,
  },
  activities: ['talk', 'chess', 'chess_onlooker', 'use_vending', 'use_trash', 'stall_buyer'],
  socialWeights: { push: 0.03, give_item: 0.06, handshake: 0.05, point_at: 0.06 },
  loiterChance: 0.18,
  loiterDurationRange: [20, 60],
  jaywalkChance: 0.15,
  departure: { lifespanRange: [90, 210], preferExitType: null },
  speedRange: [16, 26],
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
    phone_look: { on: ['stand', 'loiter', 'sit_bench', 'lean_wall'], chance: 0.0004, dur: [8, 25] },
    cross_arm:  CROSS_ARM,
  },
  activities: ['talk', 'chess_watch'],
  traits: {},
  cameraReaction: 'neutral',
  socialWeights: { push: 0.02, give_item: 0.04, handshake: 0.05, point_at: 0.04 },
};

// 摊主：从地图边缘入场 → 路由到 stall 的 seller 槽 → 常驻经营，无正常状态机转换
const STALL_SELLER = {
  name: 'stall_seller',
  initial: 'walk',
  allowedStates: ['walk', 'stand'],
  transitions: { walk: { stand: 1.0 }, stand: { stand: 1.0 } },
  heldPoses: {},
  activities: ['stall_seller'],
  traits: {},
  cameraReaction: 'neutral',
};

const DOG_OWNER = {
  name: 'dog_owner',
  initial: 'walk',
  allowedStates: ['walk', 'stand'],
  transitions: { walk: { stand: 1.0 }, stand: { walk: 1.0 } },
  heldPoses: {},
  activities: [],
  traits: {},
  cameraReaction: 'neutral',
};

const ATHLETE = {
  name: 'athlete',
  initial: 'jog',
  allowedStates: ['walk', 'run', 'jog', 'stand'],
  transitions: { walk: { jog: 1.0 }, run: { jog: 1.0 }, stand: { jog: 1.0 } },
  heldPoses: {},
  activities: [],
  traits: {},
  cameraReaction: 'neutral',
  agenda: false,   // 常驻布景：不挂 Agenda，path_follow 环线全权管理漫游
};

// 骑手：单态 ride，Motor._tickState 每帧写 mot.vel；不参与分离；不挂 Agenda
const CYCLIST = {
  name: 'cyclist',
  initial: 'ride',
  allowedStates: ['ride'],
  transitions: {},
  heldPoses: {},
  activities: [],
  traits: {},
  cameraReaction: 'neutral',
  agenda: false,    // 常驻布景，CyclistSpawner 全权管理密度
  separate: false,  // 不参与 BM._separate（骑手速度高，分离半径无意义）
};

export const PROFILES = {
  pedestrian:     PEDESTRIAN,
  businessman:    BUSINESSMAN,
  tourist:        TOURIST,
  chess_player:   CHESS_PLAYER,
  chess_onlooker: CHESS_ONLOOKER,
  stall_seller:   STALL_SELLER,
  dog_owner:      DOG_OWNER,
  athlete:        ATHLETE,
  cyclist:        CYCLIST,
};

/** 取得指定 profile；缺失时回退到 pedestrian */
export function getProfile(name) {
  return PROFILES[name] || PROFILES.pedestrian;
}
