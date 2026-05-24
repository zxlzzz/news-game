/**
 * NpcProfile — NPC 行为档案（纯数据模块）
 *
 * 每个 profile 描述某类 NPC 允许的基础状态、状态转换权重、可用叠加动作、
 * 可参与的 Activity 类型，以及性格/镜头反应倾向（后者本次仅占位）。
 *
 * 设计目标：把"行为差异"从代码搬到数据，BehaviorManager / BaseStateMachine /
 * OverlayLayer / SocialLayer 全部读 profile 决策，从而所有 NPC 共用同一套引擎。
 *
 * 注意：本次权重/概率均复刻重构前的硬编码，保证行为表现不变。
 */

// 行人：当前普通行人的完整复刻
const PEDESTRIAN = {
  name: 'pedestrian',
  initial: 'walk',
  allowedStates: ['walk', 'run', 'stand', 'sit_bench', 'fall', 'lie_ground'],
  // 计时结束时按权重选下一状态；run/fall 为每帧极小概率（见 BaseStateMachine 特判）
  transitions: {
    walk:       { stand: 0.82, sit_bench: 0.18 },  // sit_bench 需附近有长椅，否则回退 stand
    run:        { walk: 1.0 },
    stand:      { walk: 1.0 },
    sit_bench:  { stand: 1.0 },
    lie_ground: { stand: 1.0 },
    // fall 无计时转换：动画播完自动进 lie_ground
  },
  overlays: {
    phone_look: { on: ['walk', 'stand'], chance: 0.004, dur: [5, 25] },
  },
  activities: ['talk'],
  traits: {},
  cameraReaction: 'neutral',
};

// 商务人士：同行人（视觉/标签差异由 spawner 的 npcType/tags 决定）
const BUSINESSMAN = {
  ...PEDESTRIAN,
  name: 'businessman',
};

// 游客：同行人
const TOURIST = {
  ...PEDESTRIAN,
  name: 'tourist',
};

// 棋手：平时坐着下棋（由 ChessActivity 接管）；被释放后可走/站/坐
const CHESS_PLAYER = {
  name: 'chess_player',
  initial: 'walk',
  allowedStates: ['walk', 'stand', 'sit_bench'],
  transitions: {
    walk:  { stand: 1.0 },
    stand: { walk: 1.0 },
    sit_bench: { stand: 1.0 },
  },
  overlays: {},
  activities: ['talk', 'chess'],
  traits: {},
  cameraReaction: 'neutral',
};

// 观棋者：站立观看（由 ChessActivity 接管）
const CHESS_ONLOOKER = {
  name: 'chess_onlooker',
  initial: 'stand',
  allowedStates: ['walk', 'stand'],
  transitions: {
    walk:  { stand: 1.0 },
    stand: { walk: 1.0 },
  },
  overlays: {},
  activities: ['chess_watch'],
  traits: {},
  cameraReaction: 'neutral',
};

// 遛狗者：走路遛狗（由 DogWalkActivity 接管）
const DOG_OWNER = {
  name: 'dog_owner',
  initial: 'walk',
  allowedStates: ['walk', 'stand'],
  transitions: {
    walk:  { stand: 1.0 },
    stand: { walk: 1.0 },
  },
  overlays: {},
  activities: ['dog_walk'],
  traits: {},
  cameraReaction: 'neutral',
};

// 运动者：持续慢跑（transitions 为空 → 永不切换，复刻重构前的纯 jog 行为）
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
