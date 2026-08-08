# Activity 事件生产者扩展点 v1

> 状态：implemented（how-to，记录现存代码路径，不提出新架构）。
> 范围：一个新 `Activity` 如何把自己的事件接入既有的目击/证词管线
> （`WorldEventLog` → `Perception` → `Belief`）。管线本身（W-1/W-4/W-5/W-7a）
> 已实施，见 `docs/design-plans/witness-memory-v1.md`；本文档只回答
> "要让 Chess/Stall 这类还没接线的 Activity 也能发事件，需要动哪些文件"。
>
> **注（Patch H/C 后更新）**：本节原举例里的 `UsePropActivity.js`（Patch A）、
> `WaitBusActivity.js`（Patch C）已先后不再是 Activity——分别内联进
> `UseSmartPropTask`/`WaitBusTask`，emitEvent 调用点被 `check-invariants.mjs`
> Rule 14 限定在 `js/behavior/activities/`，单人 Task 不适用本文档的扩展点，
> 已从下方候选列表中移除；`TalkActivity.js` 一节的行号/方法名也已因 Patch G
> （`push`/`give_item`/`handshake`/`point_at` 抽成 `ContactActivity`）漂移，
> 未在本次一并核对更新，读者自行以当前源码为准。
>
> **注（tasks.md P-3 后更新）**：下方"新增一个事件生产者"一节举的
> `game_win` 例子仍是假想的，未落地；`ChessActivity.js` 实际接入的
> kind 是 `chess_move`（回合切换/落子完成点，`CHESS_EVENT_PROB` 低概率
> 发出，见 `docs/roadmap.md` W-10），两者是同一扩展点的两种可能用法，
> 不冲突——真正接线的是 `chess_move` 一条，`game_win` 仍只是教学示例。

## 现状

目击/证词管线目前有三个事件生产者：`TalkActivity.js`（子事件掷骰命中后
`handoff('contact', ...)`）驱动的 `ContactActivity.js`（真正调用 `emitEvent`
的地方，见该文件；Patch G 抽离，行号已随之变化，此处不再列旧行号）；
`ChessActivity.js`（P-3 新增，回合切换点低概率发 `chess_move`）。

`js/behavior/activities/` 下的 `StallActivity.js` 目前仍是零 `emitEvent()`
调用，是内容瓶颈：玩家能审问出的"目击证词"覆盖不到摆摊交易（tasks.md P-4
待落地）。

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
