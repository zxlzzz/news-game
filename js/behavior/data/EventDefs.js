/**
 * EventDefs — 世界事件类型声明表（纯数据，无 import）
 *
 * key = event kind（emitEvent({kind}) 的合法取值；WorldEventLog 用它做存在性
 *   校验）。也是 docs/design-plans/witness-memory-v1.md claim.action 槽的
 *   fine 粒度取值来源——action 槽退化到 coarse 粒度时用 `category` 字段。
 *
 * actorRoles = actors[] 各下标的语义角色，纯文档性质（WorldEventLog 不做
 *   下标校验，写错顺序不会报错）。供未来消费者（belief 层）按下标取用，
 *   取代 TalkActivity.js 旧版直接挂 NPC 私有字段、用不同数组区分 a/b
 *   角色的做法（该私有字段已随 W-1 完全退役）。
 * category  = 粗粒度分类（claim.action 槽 quality 不足时的退化值）。
 */

export const EVENT_DEFS = {
  push:      { actorRoles: ['aggressor', 'victim'], category: 'conflict' },
  push_land: { actorRoles: ['aggressor', 'victim'], category: 'conflict' },
  give_item: { actorRoles: ['giver', 'receiver'],   category: 'social' },
  handshake: { actorRoles: ['a', 'b'],              category: 'social' },
  point_at:  { actorRoles: ['pointer', 'observer'], category: 'social' },
  // 下棋落子：双方合意、非对抗性的日常互动，同 give_item/handshake 归 'social'
  // 而非 'conflict'——'conflict' 专指有攻击/受害方向性的场面（push 系）。
  chess_move: { actorRoles: ['mover', 'opponent'], category: 'social' },
};
