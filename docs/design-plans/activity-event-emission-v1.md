# Activity 事件生产者扩展点 v1

> 状态：implemented（how-to，记录现存代码路径，不提出新架构）。
> 范围：一个新 `Activity` 如何把自己的事件接入既有的目击/证词管线
> （`WorldEventLog` → `Perception` → `Belief`）。管线本身（W-1/W-4/W-5/W-7a）
> 已实施，见 `docs/design-plans/witness-memory-v1.md`；本文档只回答
> "要让 Chess/Stall/UseProp/WaitBus 这类还没接线的 Activity 也能发事件，
> 需要动哪些文件"。

## 现状

目击/证词管线目前只有一个事件生产者：`TalkActivity.js`。

- `TalkActivity.js:119`（`_startSubEvent`）：`emitEvent({ kind: type, actors: [this.a.id, this.b.id], x, y })`
  —— `type` 取自该次 sub-event 的类型（`push` / `give_item` / `handshake` / `point_at`）。
- `TalkActivity.js:170`：`emitEvent({ kind: 'push_land', actors: [this.a.id, this.b.id], x, y })`
  —— push 落地时补发的第二条事件。

`js/behavior/activities/` 下其余四个 Activity —— `ChessActivity.js`、
`StallActivity.js`、`UsePropActivity.js`、`WaitBusActivity.js` —— 目前
零 `emitEvent()` 调用，是内容瓶颈：玩家能审问出的"目击证词"只覆盖
talk 互动，覆盖不到下棋、摆摊、候车这些场景。

## 管线四步（既有代码，未改动）

```
EventDefs.js#EVENT_DEFS[kind]          声明 kind + actorRoles + category
        ↓
Activity 内 emitEvent({kind,actors,x,y})   WorldEventLog.js 唯一写入点
        ↓
BehaviorManager.js#update 帧序 1.5      drainNewEvents() 唯一消费点（W-7a）
        ↓
Belief.js#generateClaims                Perception.perceive() 判定目击者 →
                                         ClaimDecisionTables.js 按 q 填槽
        ↓
npc.mem('belief').claims                claimsToTestimony() 转人类可读证词
```

关键性质：**这条管线对 `kind` 是通用的**，`Belief.js#_fillClaim` /
`_actionFidelityValue` 不含任何 per-kind 分支——action 槽的 fine 粒度直接
用 `event.kind` 本身，coarse 粒度查 `EVENT_DEFS[kind].category`
（`Belief.js#_actionFidelityValue`）。新增一种事件类型不需要碰填槽逻辑，
只要 `EventDefs.js` 里的表项存在即可。

## 新增一个事件生产者要做的两件事

以给 `ChessActivity` 加一个假想的 `game_win` 事件为例：

1. **`EventDefs.js` 加一行**：

   ```js
   game_win: { actorRoles: ['winner', 'loser'], category: 'game' },
   ```

   `actorRoles` 纯文档性质（`WorldEventLog` 不校验下标顺序，只是给未来
   消费者提示 `actors[0]`/`actors[1]` 各自的语义）；`category` 是该 kind
   在 q 不足以给 fine 粒度时的退化值（`SIGHT_TABLE.medium.action` 等档位
   落到 `'coarse'` 时消费）。

2. **在 `ChessActivity.js` 里调一次 `emitEvent()`**：

   ```js
   import { emitEvent } from '../WorldEventLog.js';
   // ...
   emitEvent({ kind: 'game_win', actors: [winner.id, loser.id], x: table.x, y: table.y });
   ```

   调用点必须落在 `js/behavior/activities/` 目录下 —— `check-invariants.mjs`
   Rule 14 是静态门（`emitEvent() call sites confined to js/behavior/activities/`），
   写在别处直接 FAIL。

不需要改的文件：`WorldEventLog.js`、`Perception.js`、`Belief.js`、
`ClaimDecisionTables.js`、`BehaviorManager.js` —— 这五个文件已经是
kind-agnostic 的通用管线，`TalkActivity.js` 现有的五个 kind
（`push`/`push_land`/`give_item`/`handshake`/`point_at`）能跑通，新 kind
照同一套路径跑就行，无需 per-kind 特判代码。

## 不在本文档范围

- SIR 传播 / claim mutation（`witness-memory-v1.md` 第四节）仍未接线，
  与事件生产者数量无关，新增生产者不会激活它。
- `actorRoles` 目前无实际读取代码（"纯文档性质"，见 `EventDefs.js` 头注释）——
  加新 kind 时仍建议如实填写，供未来消费者引用，但不写不会报错也不影响管线。
