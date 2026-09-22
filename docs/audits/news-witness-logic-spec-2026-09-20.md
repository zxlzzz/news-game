# 新闻 / 目击 / 记忆变异逻辑说明书（2026-09-20）

> **status: snapshot** — 只读盘点，写完不再更新。后续变化以新文件替代。

目的：`js/` 已冻结（`CLAUDE.md:1`），将来用 Godot 重写。本文把这块逻辑写成与语言无关的
规格，使人不读 JS 也能照着重写。所有断言都带 `文件:行号`。

**本文不判断设计好坏，只如实转写代码**。代码与设计稿冲突处集中在最后一节。

## 范围与调用点普查

被规格化的文件：

| 文件 | 行数 |
|------|------|
| `js/news/NewsArchive.js` | 17 |
| `js/news/NewsBackflow.js` | 76 |
| `js/news/NewsUI.js` | 335 |
| `js/news/providers.js` | 232 |
| `js/behavior/Belief.js` | 390 |
| `js/behavior/Perception.js` | 86 |
| `js/behavior/WorldEventLog.js` | 51 |
| `js/behavior/data/ClaimDecisionTables.js` | 65 |
| `js/behavior/data/MemoryMutationTables.js` | 77 |
| `js/behavior/data/EventDefs.js` | 26 |
| `js/camera/Viewfinder.js` | 198 |

`js/` 里 import 上列模块的**全部**位置（`grep -rn "from '.*<module>.js'" js/`，穷举）：

| 被导入模块 | 导入方 : 行 | 导入的符号 |
|------------|-------------|------------|
| `WorldEventLog.js` | `js/behavior/activities/ChessActivity.js:5` | `emitEvent` |
| `WorldEventLog.js` | `js/behavior/activities/ContactActivity.js:22` | `emitEvent` |
| `WorldEventLog.js` | `js/behavior/activities/StallActivity.js:8` | `emitEvent` |
| `WorldEventLog.js` | `js/behavior/BehaviorManager.js:36` | `drainNewEvents` |
| `Belief.js` | `js/behavior/BehaviorManager.js:37` | `generateClaims`, `evolveMemory`, `MEMORY_EVOLUTION_INTERVAL_MIN` |
| `Belief.js` | `js/debug/WitnessDebugPanel.js:44` | `SLOTS`, `WITNESS_Q_THRESHOLD`, `evolveMemory`, `MEMORY_EVOLUTION_INTERVAL_MIN` |
| `Belief.js` | `js/news/NewsBackflow.js:21` | `injectSuggestion` |
| `Belief.js` | `js/news/NewsUI.js:7` | `injectSuggestion`, `findFillableClaim`, `claimsToTestimony` |
| `Perception.js` | `js/behavior/Belief.js:40` | `perceive` |
| `Perception.js` | `js/debug/WitnessDebugPanel.js:45` | `perceive` |
| `EventDefs.js` | `js/behavior/WorldEventLog.js:22` | `EVENT_DEFS` |
| `EventDefs.js` | `js/behavior/Belief.js:37` | `EVENT_DEFS` |
| `EventDefs.js` | `js/debug/WitnessDebugPanel.js:41` | `EVENT_DEFS` |
| `ClaimDecisionTables.js` | `js/behavior/Belief.js:38` | `SIGHT_TABLE`, `SOUND_TABLE`, `qBand` |
| `MemoryMutationTables.js` | `js/behavior/Belief.js:39` | `MUTATION_TABLE`, `FABRICATE_PROB`, `effectiveMutationProbs` |
| `MemoryMutationTables.js` | `js/news/NewsBackflow.js:22` | `NEWS_BACKFLOW` |
| `NewsBackflow.js` | `js/news/NewsUI.js:8` | `propagateArticleToWitnesses` |
| `NewsBackflow.js` | `js/debug/WitnessDebugPanel.js:47` | `getLastBackflowResult` |
| `Viewfinder.js` | `js/scenes/StreetScene.js:22` | `Viewfinder` |
| `providers.js` | `js/scenes/StreetScene.js:39` | `vision`, `text`, `interrogate`, `setLastSnapshot` |
| `NewsArchive.js` | `js/scenes/StreetScene.js:40` | `NewsArchive` |
| `NewsUI.js` | `js/scenes/StreetScene.js:41` | `NewsUI` |

`Belief.js` 另 import 三个范围外模块：`js/behavior/nav/NavGrid.js`（`getNavGrid`/`CELL`/`ZONE`，
`Belief.js:41`）、`js/core/GameClock.js`（`gameClock`，`Belief.js:42`）、`js/npc/NpcProfile.js`
（`PROFILES`，`Belief.js:43`）。`Perception.js` import `js/behavior/ModifierLayer.js` 的
`getHeldModifier`（`Perception.js:24`）。`WorldEventLog.js` import `GameClock.js` 的
`gameClock`（`WorldEventLog.js:23`）。以上就是 import 语句能证明的全部依赖，本文不据此
归纳任何"层"或"子系统"。

---

## 1. 世界事件流水账（`WorldEventLog.js`）

### 1.1 事件写入 `emitEvent`

- **谁触发**：三个 Activity，穷举如下（无第四处；`grep -rn 'emitEvent(' js/` 的其余命中全是注释）：

| 调用点 | 触发条件 | 发出的 kind | actors 顺序 | 事件坐标 |
|--------|----------|-------------|-------------|----------|
| `js/behavior/activities/ContactActivity.js:56` | ContactActivity 构造时（两名参与者已 admit）无条件发一条 | 构造参数 `clipType` | `[a.id, b.id]`（`:57`） | 两人中点 `((a.x+b.x)/2, (a.y+b.y)/2)`（`:58`） |
| `js/behavior/activities/ContactActivity.js:75` | `_onEject()` 被 `DuetStager` 回调、且 clip 声明了 `effect.emitKind` 时（`:74`） | `effect.emitKind`（来自 clip JSON 顶层 `ejectRole` 字段） | `[otherNpc.id, npc.id]`——被弹出者排第二（`:75`） | 被弹出者位置 `(npc.x, npc.y)` |
| `js/behavior/activities/ChessActivity.js:71` | 每次回合切换（等待计时 `waitMs ≥ CHESS_WAIT_MS=3500ms`，`ChessActivity.js:65`），再掷一次 `Math.random() < CHESS_EVENT_PROB`（`:68`），`CHESS_EVENT_PROB = 0.1`（`ChessActivity.js:13`） | `'chess_move'` | `[mover.id, opponent.id]`，mover = 切换前的 `this.active`（`:69-70`） | 落子方位置 `(mover.x, mover.y)` |
| `js/behavior/activities/StallActivity.js:90` | 买家与卖家两个 ClipPlayer 都播完 `'give'` 阶段那一帧（`StallActivity.js:86`），一场交易只发一次，无概率降频 | `'stall_trade'` | `[seller.id, buyer.id]`（`:91`） | 两人中点（`:92`） |

  ContactActivity 本身由 `TalkActivity` 的周期性掷骰触发：`TalkActivity.js:101` 每
  `SUB_EVENT_ROLL_INTERVAL = 3` 秒（`TalkActivity.js:24`）掷一轮，
  `_selectSubEvent()`（`TalkActivity.js:121-134`）按 `npc.mem('agenda').profile.socialWeights`
  做加权单次抽样——总权重 `total = Σw` 即本轮"发生接触"的概率（`:125-126`），命中后按
  权重比例抽具体类型。命中后 `_handoffContact()`（`:143`）还有一道距离否决：两人水平
  间距 `|b.x − a.x|` 超过 `cfg.designGap × 平均 scale × REACH_SLACK` 就放弃这轮
  （`TalkActivity.js:149-152`，`REACH_SLACK` 写死 2.5，`TalkActivity.js:15` 附近）。

- **校验**：`kind` 必须是 `EVENT_DEFS` 的键，否则抛 `Error`（`WorldEventLog.js:33`）。
- **写入的数据**：模块内数组 `_events`（`WorldEventLog.js:27`），追加一条
  `{id, kind, actors[], x, y, t}`（`:34`）。
  - `id` = `` `evt_${++_idSeq}` ``，`_idSeq` 是模块级自增计数器（`:28`、`:34`）。
  - `actors` 是传入数组的**浅拷贝**（`[...actors]`，`:34`），存的是 NPC 的 `id`，不是对象引用。
  - `t` = `gameClock()`，即十进制游戏小时（`:34`；`GameClock.js:25` 返回 `_hours`，
    起始 8.0，24 小时回绕，`GameClock.js:18`/`:22`）。
- **返回**：新建的事件对象（`:43`）。三个调用点都没有使用返回值。
- **容量上限**：`EVENT_LOG_CAP = 500`（`:25`）。超限时从数组头部 splice 掉溢出量
  （`:37-39`），同时 `_drainCursor -= overflow` 并钳到 0（`:40`），保证已读事件不被重读。

### 1.2 事件读取 `drainNewEvents`

- **谁触发**：唯一调用点 `js/behavior/BehaviorManager.js:116`（帧内步骤 1.5，在
  `socialLayer.update()` 之后，`BehaviorManager.js:113`）。
- **行为**：返回 `_events.slice(_drainCursor)`，然后把游标推到数组末尾（`:48-49`）。
  游标只推进、不回退（除 1.1 的裁剪同步平移外）。
- **消费**：对每条事件，把 `event.actors` 的每个 id 在 `this.npcs` 里反查成活体 NPC
  引用（查不到填 `null`，`BehaviorManager.js:117`），再调 `generateClaims(event, actorNpcs, this.npcs)`
  （`:118`）——候选目击者池就是**全部 NPC**，不做任何预筛。

### 1.3 EVENT_DEFS 表（完整转写，7 行，不省略）

来源 `js/behavior/data/EventDefs.js:15-26`。

| kind（= action 槽的 fine 值） | `actorRoles`（actors[] 各下标语义，纯文档，运行时不校验） | `category`（= action 槽的 coarse 值） | 声明行 |
|------------------------------|-----------------------------------------------------------|---------------------------------------|--------|
| `push` | `['aggressor', 'victim']` | `conflict` | `:16` |
| `push_land` | `['aggressor', 'victim']` | `conflict` | `:17` |
| `give_item` | `['giver', 'receiver']` | `social` | `:18` |
| `handshake` | `['a', 'b']` | `social` | `:19` |
| `point_at` | `['pointer', 'observer']` | `social` | `:20` |
| `chess_move` | `['mover', 'opponent']` | `social` | `:23` |
| `stall_trade` | `['seller', 'buyer']` | `social` | `:25` |

`actorRoles` 在运行时**没有任何读取代码**——`WorldEventLog.emitEvent` 不做下标校验
（`EventDefs.js:8-9` 自述），`Belief.js` 只按位置取 `actorNpcs[0]`/`[1]`（`Belief.js:137`）。
category 的去重集合 `{conflict, social}` 被 `Belief.js:285` 用作虚构 action 的取值池。

---

## 2. 感知裁决（`Perception.js`）

纯函数，无副作用，不写 `npc.mem`（`Perception.js:4-8` 自述）。

### 2.1 常量（全部住在本文件，不得在别处复制，`Perception.js:16-17` 自述）

| 常量 | 值 | 行 | 含义 |
|------|-----|----|------|
| `SIGHT_MAX_DIST` | 320 | `:27` | 视距硬截断（世界单位） |
| `SOUND_MAX_DIST` | 180 | `:28` | 听距硬截断 |
| `SIGHT_PERIPHERAL_FACTOR` | 0.35 | `:31` | 事件在背侧时的视觉乘数（非零＝余光） |
| `SIGHT_ATTENTION_FACTOR.phone_look` | 0.2 | `:36` | 盯屏幕时视觉乘数 |
| `SIGHT_ATTENTION_FACTOR.phone_call` | 0.7 | `:36` | 打电话时视觉乘数 |
| `SOUND_ATTENTION_FACTOR.phone_look` | 0.7 | `:37` | 盯屏幕时听觉乘数 |
| `SOUND_ATTENTION_FACTOR.phone_call` | 0.35 | `:37` | 打电话时听觉乘数 |

其余 held modifier id 一律取乘数 1（`:52`、`:56` 的 `?? 1`）。

### 2.2 计算流程 `perceive(witness, eventX, eventY)`（`:75-86`）

读取的数据：`witness.x` / `witness.y`（`:76-77`）、`witness.direction`（`:46`）、
`getHeldModifier(witness)?.id`（`:79`；该函数在 `ModifierLayer.js:37-39`，返回
`npc.modifiers` 里第一个 `kind==='held'` 且 id 不以 `_` 开头的 modifier）。**不写任何数据。**

1. `dx = eventX − witness.x`，`dy = eventY − witness.y`，`dist = hypot(dx, dy)`（`:76-78`）。
2. 距离因子（两通道共用公式，`_distFactor`，`:39-42`）：
   `dist ≥ maxDist → 0`（硬截断）；否则 `1 − dist/maxDist`（线性）。
3. 视觉质量（`_sightQuality`，`:59-63`）：
   `distF ≤ 0` 直接 0；否则 `distF × 朝向因子 × 视觉注意力因子`。
   朝向因子（`_sightFacingFactor`，`:45-49`）：`witness.direction >= 0` 视为面朝右，
   `dx >= 0` 视为事件在右；同侧取 1，异侧取 `SIGHT_PERIPHERAL_FACTOR`。
   **注意这是纯左右判定，不含视锥角度，`dy` 完全不参与朝向计算**（只经 `dist` 参与）。
4. 听觉质量（`_soundQuality`，`:65-69`）：`distF × 听觉注意力因子`，**无朝向项**。
5. 输出（`:84-85`）：两者都 ≤ 0 → `null`；否则返回 q 较大的那个通道，
   形如 `{channel: 'sight'|'sound', q}`。并列时优先 `sight`（`:85` 用 `>=`）。

本文件不设"能否感知"的布尔阈值——阈值由调用方（`Belief.js`）决定（`:10-12` 自述）。

---

## 3. 目击 claim 产出（`Belief.js`）

### 3.1 claim 数据结构

写入位置 `npc.mem('belief').claims`（数组，惰性创建，`Belief.js:175-177`）。
单条 claim 的字段（构造处 `Belief.js:160`）：

| 字段 | 类型 | 来源 | 行 |
|------|------|------|-----|
| `id` | string `` `claim_${n}` `` | 模块级自增 `_claimIdSeq` | `:55`、`:160` |
| `actor` | string \| null | 见 3.4 | `:143` |
| `action` | string \| null | 见 3.4 | `:144` |
| `target` | string \| null | 见 3.4 | `:145` |
| `place` | string \| null | 见 3.4 | `:146` |
| `time` | number \| null | 直接取 `event.t`（十进制游戏小时），产出时恒有值 | `:147` |
| `sources` | `{slot → 'witness'\|'suggested'\|'fabricated'\|null}` | 产出时：有值槽标 `'witness'`，无值槽标 `null` | `:152-153` |
| `strength` | `{slot → number}` | 产出时为空对象 `{}` | `:160` |
| `q` | number | 本次目击质量 | `:160` |
| `channel` | `'sight'\|'sound'` | 本次目击通道 | `:160` |
| `eventId` | string | 固定为 `event.id`，**任何写入点都不改写它** | `:160` |

槽名列表 `SLOTS = ['actor','action','target','place','time']`（`Belief.js:51`）。

### 3.2 目击者筛选 `selectWitnesses(candidates, eventX, eventY)`（`:65-76`）

- 阈值 `WITNESS_Q_THRESHOLD = 0.20`（`:45`）。
- 对候选池每个 NPC 跑 `perceive()`，`result && result.q >= 0.20` 才进候选（`:68-69`）。
- 候选为空 → 返回 `[]`（`:73`）。
- 否则按 q **降序**排序（`:74`），取前 `_witnessCount(n)` 名（`:75`）。
- `_witnessCount(available)`（`:57-62`）：`WITNESS_COUNT_RANGE = [2,4]`（`:46`）；
  `available < 2` 时返回 `available` 本身（不凑数）；否则在 `[2, min(4, available)]`
  之间**均匀随机**取整数：`2 + floor(random() × (cap − 2 + 1))`。

### 3.3 q 分档 `qBand(q)`（`ClaimDecisionTables.js:15-20`）

| q 范围 | 档名 |
|--------|------|
| `q ≥ 0.75` | `clear` |
| `0.45 ≤ q < 0.75` | `medium` |
| `0.20 ≤ q < 0.45` | `vague` |
| `q < 0.20` | `null`（不产出 claim，`Belief.js:135` 据此提前返回） |

### 3.4 填槽 `_fillClaim(event, actorNpcs, channel, q)`（`:133-161`）

按 channel 选表：`sight → SIGHT_TABLE[band]`，否则 `SOUND_TABLE[band]`（`:136`）。
`[actorNpc, targetNpc] = actorNpcs`（`:137`），即 `event.actors[0]` / `[1]` 反查到的活体。

每槽独立做一次加权抽样 `_pick(entries)`（`:78-86`）：抽一个 `r = random()`，
沿 `[probability, fidelity]` 列表累加，`r < acc` 时返回该 fidelity；遍历完返回最后一项
（浮点兜底）。抽到的 fidelity 再经各自的取值函数变成实际值：

- **actor**（`:140`、`:143`）：
  `channel === 'sound'` 时**无条件 null，不进抽样**（`:140` 三元表达式；这是全表唯一的
  非概率硬约束，`ClaimDecisionTables.js:10-12` 说明本表刻意不给 sound 通道 `actor` 键）。
  sight 通道走 `_actorFidelityValue(actorNpc, _pick(table.actor))`。
  另外 `actorNpc` 为 falsy 时整槽为 null（`:143`）。
- `_actorFidelityValue(npc, fidelity)`（`:114-118`）：
  `fine → _describeSlotValue('npc', npc)`；`tag → npc.npcType ?? [...npc.getTags()][0] ?? null`；
  其余（`'coarse'`/`'null'`）→ `null`。
- **action**（`:144`）：`_actionFidelityValue(kind, fidelity)`（`:120-124`）——
  `fine → event.kind` 原样；`coarse → EVENT_DEFS[kind].category`；其余 → null。
- **target**（`:145`）：`targetNpc` 存在时走同一个 `_actorFidelityValue`，否则 null。
  **sound 通道的 target 不受硬约束，照常抽样。**
- **place**（`:146`）：`_placeFidelityValue(x, y, fidelity)`（`:126-130`）——
  `fine → _describeSlotValue('place', {x,y,precise:true})`；`coarse → precise:false`；
  其余 → null。
- **time**（`:147`）：直接 `event.t`，不经表、不经抽样——产出时恒有值。

`_describeSlotValue(kind, raw)`（`:98-112`）是序列化的唯一住址：
- `kind==='npc'` → `` `${raw.npcType ?? 'npc'}#${raw.id}` ``（`:100`）。
- `kind==='place'` → 取 `getNavGrid()`；grid 不存在返回 `null`（`:104-105`，不抛错）；
  否则 `grid.zone(floor(x/CELL), floor(y/CELL))` 查 zone 数字（`:106`；`CELL = 53`，
  `NavGrid.js:43`），反查成名字（`ZONE_NAME`，`Belief.js:53`；ZONE 枚举见
  `NavGrid.js:46-52`：`BLOCKED:0, SIDEWALK:1, GRASS:2, ROAD:3, CROSSWALK:4`）。
  zone 名查不到返回 `null`（`:108`）。
  `precise` 为真 → `` `${zoneName}(${round(x)},${round(y)})` ``，否则只有 `zoneName`（`:109`）。

### 3.5 `generateClaims(event, actorNpcs, candidateNpcs)`（`:169-181`）

唯一的**新建 claim** 写入点。对 `selectWitnesses()` 选出的每名目击者跑一次 `_fillClaim`，
非 null 则 push 进该 NPC 的 `mem('belief').claims`（`:175-177`），并收集
`{witness, claim}` 返回（`:178`、`:180`）。**同一事件的不同目击者各自独立抽样**，
因此槽组合可以完全不同；它们共享同一个 `eventId`。

调用点只有 `BehaviorManager.js:118`（`check-invariants.mjs` Rule 15 守，
`CLAUDE.md` 行为系统一节自述）。

### 3.6 SIGHT_TABLE 完整转写（`ClaimDecisionTables.js:22-44`，15 个槽条目，不省略）

`[概率, fidelity]`，同一档内每槽概率和为 1。

| 档（q） | 槽 | 条目 | 行 |
|---------|-----|------|-----|
| `clear`（≥0.75） | actor | `1 → fine` | `:24` |
| `clear` | action | `1 → fine` | `:25` |
| `clear` | target | `1 → fine` | `:26` |
| `clear` | place | `1 → fine` | `:27` |
| `clear` | time | `1 → fine` | `:28` |
| `medium`（0.45–0.75） | actor | `0.9 → fine`；`0.1 → tag` | `:31` |
| `medium` | action | `1 → fine` | `:32` |
| `medium` | target | `0.85 → fine`；`0.15 → tag` | `:33` |
| `medium` | place | `1 → coarse` | `:34` |
| `medium` | time | `1 → fine` | `:35` |
| `vague`（0.20–0.45） | actor | `0.3 → fine`；`0.5 → tag`；`0.2 → null` | `:38` |
| `vague` | action | `0.8 → coarse`；`0.2 → null` | `:39` |
| `vague` | target | `0.3 → tag`；`0.7 → null` | `:40` |
| `vague` | place | `0.9 → coarse`；`0.1 → null` | `:41` |
| `vague` | time | `1 → fine` | `:42` |

### 3.7 SOUND_TABLE 完整转写（`ClaimDecisionTables.js:46-65`，12 个槽条目，不省略）

**本表没有 `actor` 键**——sound 通道的 actor 由 `Belief.js:140` 的无条件分支置 null，
刻意不放进表里以防被当成概率处理（`ClaimDecisionTables.js:10-12`）。

| 档（q） | 槽 | 条目 | 行 |
|---------|-----|------|-----|
| `clear`（≥0.75） | action | `0.8 → coarse`；`0.2 → null` | `:48` |
| `clear` | target | `0.4 → tag`；`0.6 → null` | `:49` |
| `clear` | place | `0.7 → coarse`；`0.3 → null` | `:50` |
| `clear` | time | `1 → fine` | `:51` |
| `medium`（0.45–0.75） | action | `0.6 → coarse`；`0.4 → null` | `:54` |
| `medium` | target | `0.15 → tag`；`0.85 → null` | `:55` |
| `medium` | place | `0.5 → coarse`；`0.5 → null` | `:56` |
| `medium` | time | `1 → fine` | `:57` |
| `vague`（0.20–0.45） | action | `0.25 → coarse`；`0.75 → null` | `:60` |
| `vague` | target | `0.05 → tag`；`0.95 → null` | `:61` |
| `vague` | place | `0.25 → coarse`；`0.75 → null` | `:62` |
| `vague` | time | `1 → fine` | `:63` |

---

## 4. 审问注入（`Belief.js#injectSuggestion` / `findFillableClaim`）

### 4.1 `findFillableClaim(npc, slot)`（`:189-192`）

在 `npc.mem('belief').claims` 里返回**第一条** `sources[slot] === null` 的 claim；
没有则 `null`（`:191`）。只读。

### 4.2 `injectSuggestion(npc, claimId, slot, value)`（`:213-230`）

"suggested" 来源的唯一写入点，**不新建 claim**。

| 条件（按代码顺序） | 结果 | 行 |
|--------------------|------|-----|
| `value == null` | 返回 `null`，不写 | `:214` |
| 按 `claimId` 找不到 claim | 返回 `null`，不写 | `:216-217` |
| `sources[slot] != null` 且（来源是 `'suggested'` 且现值 `=== value`） | **复述强化**：`strength[slot] = (strength[slot] ?? 1) + 1`，返回该 claim；槽值与 sources 不变 | `:219-223` |
| `sources[slot] != null` 且不满足上一行（换了值，或来源是 `'witness'`/`'fabricated'`） | 返回 `null`，不写 | `:219-221` |
| `sources[slot] == null`（空槽） | 写入：`claim[slot] = value`；`sources[slot] = 'suggested'`；`strength[slot] = 1`。返回该 claim | `:226-229` |

注意第三行的判定 `claim.sources[slot] === 'suggested' && claim[slot] === value`（`:220`）——
`'fabricated'` 来源的槽**不**享受复述强化，与 `'witness'` 一样被直接拒绝。

本函数只写数据，不触发状态机/情绪/任何 NPC 行为变化（`:207-208` 自述）。

### 4.3 两个调用方

| 调用点 | 触发 | 传入的 value 来自 |
|--------|------|-------------------|
| `js/news/NewsUI.js:137` | 玩家在成稿面板点"提问"按钮 | `providers.interrogate.ask()` 的解析结果 |
| `js/news/NewsBackflow.js:68` | 玩家点"发布存档" | 同一事件另一名目击者已确立的槽值 |

---

## 5. 记忆演化（`Belief.js#evolveMemory` + `MemoryMutationTables.js`）

### 5.1 触发

- **周期常量** `MEMORY_EVOLUTION_INTERVAL_MIN = 5`（游戏分钟，不是实秒，`Belief.js:262`）。
- **生产触发**：`BehaviorManager.js:125-135`（帧内步骤 1.6，紧接 1.5 之后）。
  每帧取 `gameClock()`，算与上帧的差 `dH`（负值加 24 处理午夜回绕，`:128`），
  累加 `_memEvoAccMin += dH × 60`（`:130`）；攒够一个周期时
  `ticks = floor(acc / 5)`，扣掉已用量，调 `evolveMemory(this.npcs, ticks)`（`:131-134`）。
- **调试触发**：`js/debug/WitnessDebugPanel.js:199`，把面板输入的分钟数折成
  `ticks = max(1, round(minutes / MEMORY_EVOLUTION_INTERVAL_MIN))`（`:198`）直接调用，
  不触碰 GameClock 本身。

### 5.2 `evolveMemory(npcs, ticks = 1)`（`:382-390`）

三重循环：`ticks` 次 × 每个 NPC × 每条 claim，对每条调 `_mutateClaim(claim, claims)`
（`:387`）。claims 为空的 NPC 跳过（`:386`）。函数本身不持有计时状态。

### 5.3 `_mutateClaim(claim, allClaims)`（`:360-372`）——每槽独立掷一次

对 `SLOTS` 的五个槽各走一次：

- **空槽分支**（`sources[slot] == null`，`:362-365`）：掷 `random() < FABRICATE_PROB[slot]`，
  命中则 `_fabricateSlot`，然后 `continue`——**空槽不参与四选一表**。
- **有值槽分支**（`:366-370`）：用 `effectiveMutationProbs(slot, strength[slot] ?? 0)`
  算出四选一概率，`_pickOutcome` 抽一个（`:348-356`，累加抽样，兜底 `'stay'`），
  按结果调 `_forgetSlot` / `_distortSlot` / `_transferSlot`；`'stay'` 不动。

### 5.4 MUTATION_TABLE 完整转写（`MemoryMutationTables.js:27-33`，5 行，不省略）

列序固定 `[stay, distort, transfer, forget]`，每行和为 1.0（`:26`）。

| 槽 | stay（不变） | distort（退化 fine→coarse） | transfer（置换） | forget（→null） | 行 |
|----|--------------|------------------------------|------------------|------------------|-----|
| `actor` | 0.80 | 0.10 | 0.06 | 0.04 | `:28` |
| `action` | 0.82 | 0.12 | 0.04 | 0.02 | `:29` |
| `target` | 0.78 | 0.10 | 0.08 | 0.04 | `:30` |
| `place` | 0.75 | 0.15 | 0.05 | 0.05 | `:31` |
| `time` | 0.90 | 0.07 | 0.01 | 0.02 | `:32` |

### 5.5 strength 抗性与 `effectiveMutationProbs`（`:47-59`）

常量：`STRENGTH_DECAY = 0.65`（`:35`）、`STRENGTH_FLOOR = 0.15`（`:36`）。

算法（逐行对应 `:48-58`）：
```
[stay, distort, transfer, forget] = MUTATION_TABLE[slot]
nonStay        = distort + transfer + forget
mult           = max(STRENGTH_FLOOR, STRENGTH_DECAY ^ strength)   // 0.65^s，下限 0.15
scaledNonStay  = nonStay × mult
scale          = nonStay > 0 ? scaledNonStay / nonStay : 0        // 数值上等于 mult
返回 { stay: 1 − scaledNonStay,
       distort: distort × scale,
       transfer: transfer × scale,
       forget:  forget × scale }
```
即：strength 每 +1，"非不变"三档的合计概率乘 0.65（不低于原值的 0.15 倍），
空出的概率全部并回 `stay`；三档之间的内部比例不变。

### 5.6 FABRICATE_PROB 完整转写（`MemoryMutationTables.js:38-40`，5 项，不省略）

| 槽 | 每 tick 虚构概率 | 行 |
|----|------------------|-----|
| `actor` | 0.01 | `:39` |
| `action` | 0.008 | `:39` |
| `target` | 0.01 | `:39` |
| `place` | 0.008 | `:39` |
| `time` | 0.004 | `:39` |

只对 `sources[slot] === null` 的空槽生效（`Belief.js:362`），**不受 strength 影响**
（`MemoryMutationTables.js:22-23` 自述：空槽从未被强化过）。

### 5.7 四种变异的具体行为

| 结果 | 行为 | 对 `sources` / `strength` 的影响 | 行 |
|------|------|-----------------------------------|-----|
| `forget` | `claim[slot] = null` | `sources[slot] = null`；`delete strength[slot]`（重新成为注入口） | `:315-319` |
| `distort` | 仅当 `slotFidelity` 判定当前是 `'fine'` 才生效，否则本轮无效果（`:324`）。actor/target：`value.split('#')[0]`；action：`EVENT_DEFS[value].category`；place：`value.split('(')[0]`；time：`_timeToBucket(value)` | **不改**（NPC 对自己的记忆失真无自觉） | `:323-329` |
| `transfer` | 从**同一 NPC** 的其他 claim（`allClaims.filter(c => c !== claim && c[slot] != null)`）里随机取一个同槽值；没有捐赠者则放弃本轮（不退化成 forget） | **不改** | `:334-338` |
| `fabricate` | 从取值池随机取一个值填入空槽 | `sources[slot] = 'fabricated'`；`strength` 不写 | `:341-346` |

`slotFidelity(slot, value)`（`:304-311`，导出供 `scripts/check-memory-mutation.mjs` 复用）：
`null → 'null'`；actor/target 含 `'#'` 为 `'fine'` 否则 `'coarse'`；action 是 `EVENT_DEFS`
的键为 `'fine'` 否则 `'coarse'`；place 含 `'('` 为 `'fine'` 否则 `'coarse'`；
time 是 `number` 为 `'fine'` 否则 `'coarse'`。

`_timeToBucket(t)`（`:270-277`）：`delta = gameClock() − t`，负值加 24；
`delta < 1` → `'just_now'`；`delta < 4` → `'a_while_ago'`；否则 `'long_ago'`。
阈值 `TIME_BUCKET_HOURS = {justNow: 1, aWhileAgo: 4}`（游戏小时，`:267`）。

虚构取值池（`:284-296`）：
- actor / target → `Object.keys(PROFILES)`（`:284`），即 `NpcProfile.js:256-267` 的十个
  profile 名：`pedestrian, businessman, tourist, child, chess_player, chess_onlooker,
  stall_seller, dog_owner, athlete, cyclist`。**虚构从不产出 fine 粒度身份**（`:279-281` 自述）。
- action → `EVENT_DEFS` 各 category 去重集合（`:285`），当前是 `['conflict', 'social']`。
- place → `Object.keys(ZONE)` 剔除 `BLOCKED`（`:286`），即
  `['SIDEWALK', 'GRASS', 'ROAD', 'CROSSWALK']`。
- time → `TIME_BUCKETS = ['just_now', 'a_while_ago', 'long_ago']`（`:268`、`:294`）。

---

## 6. 证词序列化（`Belief.js#claimsToTestimony`）

`claimsToTestimony(npc)`（`:243-254`）：对每条 claim，取 `SLOTS` 里**非 null** 的槽，
拼成 `` `${标签}=${值}` ``；若该槽 `sources[s] === 'suggested'` 则在值后追加字面量
`（未经证实）`（`:249`）。空 claim（无任何有值槽）跳过（`:250`）。各槽以 `，` 连接，
每条 claim 一行（`:251`）。

槽标签 `SLOT_LABEL`（`:232`）：`actor→谁`、`action→做了什么`、`target→对象`、
`place→地点`、`time→时间`。

`'fabricated'` 来源的槽**不带任何标注**——只有 `'suggested'` 被标注（`:249` 的等值判断）。

调用点两处：`NewsUI.js:103`（审问面板实时刷新单个目击者的证词）、
`NewsUI.js:218`（生成文章前把所有目击者的证词 flatMap 成一个数组）。

---

## 7. 取景与拍照（`Viewfinder.js` + `StreetScene.js`）

### 7.1 取景框状态

取景框是**屏幕像素坐标**的轴对齐矩形，浮在顶层，与相机 pan/zoom 完全无关
（`Viewfinder.js:5-11` 自述这是 2026-08-11 的改动）。

| 字段 | 默认值 | 行 |
|------|--------|-----|
| `x` / `y` | 130 / 130 | `:34-35` |
| `width` / `height` | 640 / 460 | `:36-37` |
| `minWidth` / `minHeight` | 200 / 150 | `:39-40` |
| `maxWidth` / `maxHeight` | 860 / 680 | `:41-42` |
| `handleSize` | 16 | `:53` |

交互：`pointerdown` 命中右下角 handle（`_isInHandle`，`:60-65`）进入 resize，否则命中
框内进入 drag（`:80-85`）；`pointermove` 时 resize 钳到 min/max（`:94-95`），drag 钳到
视口内（`:99-100`）；`pointerup` 清两个标志（`:103-106`）。

### 7.2 命中检测 `updateCapture(entities)`（`:109-123`）

对每个实体取 `e.getBounds()`，经注入的 `entityScreenRect` 换算成当前屏幕矩形（`:114`），
与取景框做 AABB 相交（`:115-120`），相交则进 `capturedEntities`。**每帧全量重算**
（调用点 `StreetScene.js:514`，传入 `entityManager.getAlive()`）。
本文件不做任何投影数学（`:18-22` 自述，换算函数由 `StreetScene` 注入）。

`getCapturedTags()`（`:190-197`）把命中实体的 `getTags()`（无此方法则 `e.tags`）
并成一个去重数组。

### 7.3 拍照流程 `StreetScene._takePhoto()`

| 步骤 | 行为 | 行 |
|------|------|-----|
| 1 | 取景框矩形直接取整即为截图矩形，**不 clamp、不经投影换算** | `StreetScene.js:433-436` |
| 2 | 隐藏取景框图形 | `:439` |
| 3 | `extract.canvas(stage, PIXI.Rectangle)` → `toDataURL('image/png')` | `:442-444` |
| 4 | 恢复取景框图形 | `:447` |
| 5 | 闪光反馈 | `:450-451` |
| 6 | 构造 `entitySnapshot`，`setLastSnapshot()` 存给 providers 的 mock 用 | `:454-455` |
| 7 | 并行发起 `vision.describe(photoRef)`，**不 await** | `:456` |
| 8 | 筛目击者 / 筛"入镜但没看见的人" | `:465-470` |
| 9 | `openComposer({photoRef, entitySnapshot, visionPromise, witnesses, hasUnwitnessingNpc})` | `:473` |

第 8 步的两个筛选条件（**这是"入镜"与"目击"分离的关键**）：
- `witnesses` = 命中实体中 `typeof e.mem === 'function' && e.mem('belief').claims?.length > 0`
  （`:465-467`）——**只看 claims 非空，不在拍照这一刻重跑任何感知裁决**（`:458-462` 自述）。
- `hasUnwitnessingNpc` = 命中实体中存在有 `mem` 但 claims 为空者（`:468-470`），
  用于 UI 区分"框里没人"和"框里有人但谁都没看见"。

`entitySnapshot` 结构（`_buildEntitySnapshot`，`:476-486`）：
`{entities: [{id, tags}], rect: {x,y,w,h}, timestamp}`。
`id = e.id ?? e.propType ?? 'unknown'`（`:478`）；
`rect` 是**屏幕像素坐标**（`:483` 行内注释明确）。

---

## 8. Provider 层：对外部模型的调用（`providers.js`）

三个 provider 共用一个降级模式：读 localStorage 的 key，**key 为空直接走 mock**
（不发请求）；否则 try live，任何异常（含非 2xx）catch 后 `console.warn` 并降级 mock。

| 入口 | 无 key 分支 | live 分支 | catch 降级 |
|------|-------------|-----------|------------|
| `describe(pngBase64)` | `:190-192` | `:194-195` | `:196-199` |
| `compose({...})` | `:203-206` | `:207-209` | `:210-213` |
| `ask({...})` | `:217-220` | `:221-223` | `:224-227` |

localStorage 键名（`:23-28`）：`news_vision_key`、`news_vision_base`、
`news_text_key`、`news_text_base`。
默认端点（`:30-33`）：vision `https://api.openai.com/v1`、text `https://api.deepseek.com/v1`。
`text` 与 `interrogate` **共用同一套 key/base**（`TEXT_KEY`/`TEXT_BASE`，`:118-119` 与
`:62-63`），这是刻意的范围控制（`:9-12` 自述）。

### 8.1 `vision.describe`

- **输入**：`pngBase64` — 一个 `data:image/png;base64,…` 字符串（来自
  `StreetScene.js:444` 的 `canvas.toDataURL`）。
- **prompt 位置**：`providers.js:49`（单条 user message 的 text part，字面量整句在该行）。
- **请求结构**（`_liveVision`，`:38-58`）：
  `POST ${base}/chat/completions`，header `Authorization: Bearer ${key}` +
  `Content-Type: application/json`（`:43`）；body（`:44-53`）：
  ```
  { model: 'gpt-4o-mini',
    messages: [ { role: 'user',
                  content: [ {type:'text', text: <:49 的 prompt>},
                             {type:'image_url', image_url:{url: pngBase64}} ] } ] }
  ```
- **输出**：读 `data.choices[0].message.content`（`:57`），即一段中文字符串。
  非 2xx 抛 `Error('vision HTTP ' + status)`（`:55`）。
- **对外返回**：`{text, mock: false}`（`:195`）或 mock 时 `{text, mock: true}`（`:191`）。
- **mock**（`_mockVision`，`:88-103`）：**不发网络**，从 `_lastSnapshot.entities` 的 tags
  拼模板。人物判定：tags 含 `npc`/`pedestrian`/`athlete`/`chess-player`/`dog-walker`
  任一（`:90`）。输出形如 `画面中 N 个人物。` + 每人一行 + `背景可见：…。`（`:93-101`）。

### 8.2 `text.compose`

- **输入**：`{visionReport, playerStance, playerDraft, testimony = []}`（`:61`）。
  `testimony` 是字符串数组，来自 `NewsUI.js:218` 的 `witnesses.flatMap(claimsToTestimony)`。
- **prompt 位置**：system prompt 字面量在 `providers.js:73`（单行）；
  user message 模板在 `:77`。证词拼接在 `:64`：
  `testimony.length > 0 ? '目击者证词：' + join('；') : '目击者证词：（无）'`。
- **请求结构**（`_liveText`，`:61-85`）：
  `POST ${base}/chat/completions`，同样的两个 header（`:67`）；body（`:68-80`）：
  ```
  { model: 'deepseek-chat',
    messages: [ {role:'system',  content: <:73>},
                {role:'user',    content: `现场描述：${visionReport}\n立场：${playerStance}\n记者草稿：${playerDraft || '（无）'}\n${testimonyLine}`} ] }
  ```
- **system prompt 与证词标注的耦合**：`:73` 明写"证词标注『（未经证实）』的部分只能作为
  记者听闻转述，不能当作确证事实直接下结论"——这个子串必须与 `Belief.js:249` 产出的
  字面量完全一致（`Belief.js:240-241` 明确要求"字面量不能改"）。**重写时这是一条跨模块
  的字符串契约。**
- **输出**：`data.choices[0].message.content`（`:84`）。非 2xx 抛 `Error('text HTTP …')`（`:82`）。
- **mock**（`_mockText`，`:108-114`）：立场词表 `STANCE_WORD = {neutral:'据悉',
  incite:'惊爆！', sympathy:'令人动容：'}`（`:106`）；拼
  `【快讯】{立场词}{主体tag}现场情况引发关注。` + visionReport + 草稿 + 证词（`:113`）。

### 8.3 `interrogate.ask`

- **输入**：`{question, knownClaims = []}`（`:216`）。`knownClaims` 是该目击者
  **完整的 claims 数组原样**（`NewsUI.js:126`）。
- **prompt 位置**：system prompt 是 `providers.js:128-136` 的多段字符串拼接
  （九行 `+` 连接，整段一起读）；user message 模板在 `:140`，形如
  `已知线索（仅供判断槽位，不得当作答案来源）：${JSON.stringify(knownClaims)}\n玩家提问：${question}`。
- **职责约束（写在 prompt 里，不是代码约束）**：把中文问句归类到五槽之一；
  候选值**只能从玩家问句本身的措辞里抽取**；"已知线索"只用于判断槽位，
  不得当作答案来源；抽不到时 `value` 必须是 `null`（`:128-136`）。
- **请求结构**（`_liveInterrogate`，`:117-152`）：
  `POST ${base}/chat/completions`，body model `deepseek-chat`，两条 message（`:123-143`）。
- **输出解析**（`:147-151`）：取 `content`，`trim()` 后剥掉 markdown 代码围栏
  （正则 `` /^```json\s*|```$/g ``，`:147`），`JSON.parse`（`:148`）。
  **只有 `slot` 缺失才算解析失败并抛错**（`:150`）；`value` 为 null 是合法结果（`:149`）。
  返回 `{slot, value: parsed.value ?? null}`（`:151`）。
- **对外返回**：`{slot, value, mock}`（`:219`/`:223`/`:226`）。
- **mock**（`_mockInterrogate`，`:175-180`）：`_detectSlot(question)`（`:163-168`）按
  关键词表 `SLOT_KEYWORDS`（`:155-161`）匹配——
  `actor: 谁做/是谁/谁在/哪个人/什么人`；`target: 对谁/跟谁/打了谁/针对谁`；
  `place: 哪里/哪儿/在哪/什么地方`；`time: 什么时候/几点/何时`；
  **`action` 没有关键词，是兜底默认值**（`:160`、`:167`）。
  值则从 `knownClaims` 里查该槽已有的第一个非 null 值（`:177-178`），查不到返回 null
  （不再用占位客套话兜底，`:170-174` 自述原因）。

### 8.4 三条 prompt 的行号索引（重写时需要原文照搬的位置）

| prompt | 文件:行 |
|--------|---------|
| vision 的 user text part | `js/news/providers.js:49` |
| text 的 system prompt | `js/news/providers.js:73` |
| text 的 user 模板 | `js/news/providers.js:77` |
| interrogate 的 system prompt | `js/news/providers.js:128-136` |
| interrogate 的 user 模板 | `js/news/providers.js:140` |

---

## 9. 成稿面板与发布（`NewsUI.js` + `NewsArchive.js`）

### 9.1 审问交互（`openComposer` 内，`NewsUI.js:72-158`）

- `witnesses.length === 0` 时只显示一行提示，文案按 `hasUnwitnessingNpc` 二选一
  （`:78-80`）：有人但没看见 → `（取景框里的人这时候什么都没看见——离得太远、背对着，或者在玩手机）`；
  框里没 NPC → `（本次取景框里没有 NPC，没有目击者可审问）`。
- 否则为每名目击者建一个按钮，标签 `` `${npcType}#${id}` `` 或 `` `NPC${id}` ``（`:108`）。
- 点"提问"后的完整分支（`:120-151`）：
  1. 取 `activeWitness.mem('belief').claims ?? []` 作为 `knownClaims`（`:126`）。
  2. `await providers.interrogate.ask({question, knownClaims})`（`:127`）。
  3. `result.value == null` → 显示 `这个问题没有暗示任何具体答案`，**不写 belief**（`:130-131`）。
  4. 否则 `findFillableClaim(activeWitness, result.slot)`（`:135`）：
     - 找到 → `injectSuggestion(activeWitness, fillable.id, result.slot, result.value)`（`:137`）。
     - 找不到 → 显示 `问出了答案，但这个目击者没有对应的空白可以记上`，不写（`:140`）。
  5. 清空输入框，重渲染证词（`:143-144`）。

  **LLM 的输出从不直接进 belief**：它只产出 `{slot, value}`，写入动作由
  `injectSuggestion` 这个游戏内机制执行（`:72-73` 自述）。

### 9.2 生成文章（`:213-233`）

立场取 radio 选中值，默认 `'neutral'`（`:216`）；
`testimony = witnesses.flatMap(w => claimsToTestimony(w))`（`:218`）；
调 `text.compose({visionReport, playerStance, playerDraft, testimony})`（`:220-222`）；
结果暂存在 `panel._composeResult`（`:226`），**此时尚未存档**。

### 9.3 发布（`:235-255`）——唯一的回流触发点

1. 无 `_composeResult` 直接 return（`:237`）。
2. 组装 article 对象（`:238-248`），字段：
   `id`（`NewsArchive.makeId()`，格式 `` `art_${Date.now()}_${random36}` ``，`NewsArchive.js:14-16`）、
   `photoRef`、`visionReport`、`entitySnapshot`、`playerStance`、`playerDraft`、
   `articleText`、`provider`（`'mock'`/`'live'`）、`timestamp`（`Date.now()`）。
3. `this._archive.publishArticle(article)`（`:249`）——`NewsArchive.js:9-12`，
   只 push 进 `this.articles` 并打 console。注释称其为"唯一写入入口，外部调用后可在此
   扩展世界反馈逻辑"（`NewsArchive.js:8`），**但当前函数体内没有任何世界反馈逻辑**。
4. `propagateArticleToWitnesses(witnesses)`（`:253`）——回流发生在 `publishArticle`
   **之后**、在 UI 关闭之前。这是全库唯一调用点（`check-invariants.mjs` Rule 18 守）。
5. `this.close()`（`:254`）。

---

## 10. 报道回流（`NewsBackflow.js`）

`propagateArticleToWitnesses(witnesses)`（`:61-93`）：

1. **分组**（`:65-72`）：遍历传入的每个目击者的每条 claim，按 `claim.eventId` 归入
   `Map<eventId, [{npc, claim}]>`。`eventId` 为 null 的 claim 跳过（`:68`）。
   注意**分组范围就是传入的 witnesses 数组本身**——不扫描场上其他 NPC。
2. 对每组（`:75-89`）：
   - 组内少于 2 条 claim 直接跳过（`:76`）——单人目击没有校对对象，这是设计内行为
     （`:34-35` 自述"不是 bug"）。
   - 对 `SLOTS` 五槽依次处理（`:78`，槽序固定 `actor, action, target, place, time`，`:41`）：
     - 找**第一个**该槽非 null 的成员作为 donor（`:79`）；没有则跳过这个槽（`:80`）。
     - 对组内其余成员（`:82-87`）：跳过 donor 自己（`:83`）；
       若 `written.length >= NEWS_BACKFLOW.maxFillsPerArticle` 则 `break outer`
       **跳出全部循环**（`:84`）；否则调 `injectSuggestion(npc, claim.id, slot, donor.claim[slot])`
       （`:85`），成功则记录 `{npc, claimId, slot, value}`（`:86`）。
3. 缓存到 `_lastResult` 并返回（`:91-92`）。

- **上限**：`NEWS_BACKFLOW.maxFillsPerArticle = 8`（`MemoryMutationTables.js:76`）。
  注意上限计的是**成功写入数**（`written.length`），被 `injectSuggestion` 拒绝的
  尝试不计数，但仍消耗一次循环。
- **来源标记**：回流写入的槽标 `'suggested'`，与审问注入完全相同——不新开 source 值
  （`:27-28` 自述）。
- **不豁免演化**：回流写入的槽照常参与 `evolveMemory`（`:22-23` 自述）。
- `getLastBackflowResult()`（`:51`）是给调试面板的只读缓存，`WitnessDebugPanel.js:313`
  消费；`:43-47` 自述这两行可随调试面板一并删除而不影响 P-7 功能。

---

## 11. 帧内执行顺序（重写时的时序契约）

`BehaviorManager.update(delta)` 内相关步骤，按代码顺序：

| 步骤 | 行为 | 行 |
|------|------|-----|
| 1 | `socialLayer.update(this.npcs, dt)` — Activity 在此 `emitEvent` | `BehaviorManager.js:113` |
| 1.5 | `drainNewEvents()` → 对每条 `generateClaims()` | `:116-119` |
| 1.6 | GameClock 攒够 `MEMORY_EVOLUTION_INTERVAL_MIN` → `evolveMemory()` | `:125-135` |
| 2 | `waitForBusLayer.update()` | `:138` |
| 3 | 自由 NPC 的 Agenda / TaskRunner / BSM / modifiers | `:141` 起 |

关键推论（代码可证）：**同一帧内发出的事件在同一帧被消费**——`emitEvent` 在步骤 1、
`drainNewEvents` 在步骤 1.5。目击裁决用的是 NPC 在**步骤 1 结束时**的位置与朝向，
因为步骤 3 的移动尚未执行。

拍照/发布路径不在 `BehaviorManager` 的帧序内，由玩家输入驱动（`StreetScene.js` 键盘绑定）。

---

## 12. 代码与设计稿不一致处

逐条对照 `docs/design-plans/news-pipeline-mvp.md`、`witness-memory-v1.md`、
`belief-layer-v0.md`。**只列不一致的**，一致的不列。**以代码为事实，本节不判断哪边对。**

### 对 `news-pipeline-mvp.md`

| # | 项 | 设计稿写的 | 代码实际 | 备注 |
|---|----|-----------|---------|------|
| N-1 | 取景框坐标系 | `news-pipeline-mvp.md:35` — `已实现常驻可拖拽/可缩放取景框（世界坐标系），挂到 vfGraphics（worldContainer zIndex=4）` | `Viewfinder.js:33` — `// 屏幕像素坐标（viewport 相对，不随相机 pan/zoom 变化）`；默认值 `Viewfinder.js:34-37` | 设计稿 `:6-13` 的"过期提示 2"已自述此处过期 |
| N-2 | 截图前 clamp | `news-pipeline-mvp.md:43` — `① 将取景框 clamp 进当前视口`；`:81` 调 `this._clampViewfinderToViewport()`；`:111-118` 给出该函数实现 | `StreetScene.js:430-436` — 注释明写 `不需要再 clamp、也不需要经 toScreen 投影`，直接 `Math.round(vf.x)` 等四行 | `_clampViewfinderToViewport` 在 `js/` 中已不存在（grep 零命中） |
| N-3 | 世界→屏幕换算 | `news-pipeline-mvp.md:86-90` — `const sx = Math.round((vf.x - this.scrollX) * z)` 等四行乘 zoom | `StreetScene.js:433-436` — `const sx = Math.round(vf.x)` 等四行，无 `scrollX`/`zoom` 参与 | 同 N-1 成因 |
| N-4 | `testimony` 取值 | `news-pipeline-mvp.md:145` — `params.testimony any[] — 证词列表（MVP 恒为 []，接口预留）`；`:394` 数据流图写 `testimony:[]` | `NewsUI.js:218` — `const testimony = witnesses.flatMap(w => claimsToTestimony(w));` 实际有值 | 设计稿 `:2-5` 的"过期提示"已自述 |
| N-5 | text system prompt 内容 | `news-pipeline-mvp.md:199` — `"你是一个新闻记者，根据现场描述、立场和记者草稿撰写 100~150 字的新闻报道。立场枚举：…"`（无证词、无"未经证实"条款） | `providers.js:73` — 多出 `和目击者证词` 以及整句 `证词标注"（未经证实）"的部分只能作为记者听闻转述，不能当作确证事实直接下结论。` | — |
| N-6 | text user message 内容 | `news-pipeline-mvp.md:203` — `"现场描述：…\n立场：…\n记者草稿：…"`（三行） | `providers.js:77` — 末尾多一行 `\n${testimonyLine}`（`:64` 构造） | — |
| N-7 | provider 数量 | `news-pipeline-mvp.md:149-150` — 只导出 `vision` 与 `text`；`:364` 文件结构注为 `vision/text Provider（live+mock）` | `providers.js:230-232` — 导出 `vision`、`text`、`interrogate` 三个 | `interrogate` 是 W-6 新增，设计稿未回填 |
| N-8 | `openComposer` 签名 | `news-pipeline-mvp.md:303` — `openComposer({ photoRef, entitySnapshot, visionPromise })` | `NewsUI.js:48` — 多两个参数 `witnesses = []`、`hasUnwitnessingNpc = false` | — |
| N-9 | `entitySnapshot.rect` 坐标系 | `news-pipeline-mvp.md:265` — `rect: {x,y,w,h}, // 世界坐标（已 clamp）` | `StreetScene.js:483` — 行内注释 `// 屏幕像素坐标，非世界坐标` | — |
| N-10 | 发布后的动作 | `news-pipeline-mvp.md:277` — `publishArticle(article) 是唯一咽喉函数：newsArchive.push(article)。后续扩展（世界反馈、事件触发）只在此函数内增加逻辑，外部无感知`；`:396` 数据流图发布是终点 | `NewsUI.js:249` 调 `publishArticle` 后，`:253` 另调 `propagateArticleToWitnesses(witnesses)`——世界反馈发生在 `NewsArchive.js` **之外** | `NewsArchive.js:9-12` 函数体内确实没有世界反馈逻辑 |
| N-11 | 成稿面板布局 | `news-pipeline-mvp.md:318-331` 的示意图无审问区 | `NewsUI.js:74-158` 在 vision 区与立场区之间插入了整块审问 UI | — |
| N-12 | 存档面板触发键 | `news-pipeline-mvp.md:356` — `按 A 键切换显示/隐藏` | 不确定 — `NewsUI.js` 只提供 `openArchive()`（`:262`），键绑定不在本次范围的文件内。缺的证据：`StreetScene.js` 的键盘绑定段未纳入本次逐行核对 | — |

### 对 `witness-memory-v1.md`

| # | 项 | 设计稿写的 | 代码实际 | 备注 |
|---|----|-----------|---------|------|
| W-1 | `time` 槽类型 | `witness-memory-v1.md:51` — `time: number \| null,    // 发生时刻` | 产出时是 number（`Belief.js:147` 取 `event.t`），但 `_distortSlot` 退化后写入**字符串**桶名（`Belief.js:328` → `_timeToBucket` 返回 `'just_now'` 等，`:274-276`），`_fabricateSlot` 同样写字符串（`:294`） | 设计稿 `:86` 的取值域表确实列了粗桶，但 `:51` 的 schema 行只声明 `number \| null` |
| W-2 | `strength` 的写入者 | `witness-memory-v1.md:62-63` — `strength: { [slot]: number },  // 只有被 injectSuggestion 填过的槽才会出现在这里` | `Belief.js:318` 的 `_forgetSlot` 会 `delete claim.strength[slot]`——被 `evolveMemory` 删除，不只由 `injectSuggestion` 写 | 代码行为与 `Belief.js:313-314` 自己的注释一致 |
| W-3 | 复述强化的适用来源 | `witness-memory-v1.md:226-228` — `唯一例外是同一 (claim, slot, value) 的重复注入……换一个不同的值、或者这个槽本来就是 witness 来源，都不允许覆盖` | `Belief.js:220` 的判定是 `sources[slot] === 'suggested' && claim[slot] === value`——`'fabricated'` 来源的槽同值重复注入**也被拒绝**，不加 strength | 设计稿写这段时 `'fabricated'` 尚未存在（v1.2 才引入，`:16-23`）；代码未就此给出说明 |
| W-4 | `sound` 通道 `target` 的硬约束 | `witness-memory-v1.md:101` 只把 `actor` 列为硬 null；`:107-110` 明写这是"本设计唯一的非概率规则" | 与代码一致（`Belief.js:140` 只对 actor 做无条件分支，target 照常抽样，`:145`） | **一致，不构成不一致项**；列出是因为易被误读 |
| W-5 | 目击者取样是否按 q 加权 | `witness-memory-v1.md:182` — `按 q 降序取样` | `Belief.js:74-75` 先按 q 降序排，再取前 N 名，N 由 `_witnessCount` **均匀随机**决定（`:61`）——q 只决定排序，不影响入选人数的概率分布 | 设计稿措辞"按 q 降序取样"可读作两种含义；代码是确定性截断 |
| W-6 | mutation 表的触发时机 | `witness-memory-v1.md:156` — `claim 经 NPC 间复述传播时，每跳按槽独立抽样是否失真` | `Belief.js:382-390` 的 `evolveMemory` 按游戏时间周期触发，与 NPC 间复述无关；全库无"转告产生新副本"的代码（grep 无相应写入点） | 设计稿 `:146-154` 的 v1.2 注记已自述此处改变 |
| W-7 | `EVENT_DEFS` 的规模描述 | `witness-memory-v1.md:203-204` — `目前只覆盖 TalkActivity.js 的 5 个 kind` | `EventDefs.js:15-26` 实为 7 个（含 `chess_move`、`stall_trade`） | 文档头 `:6-9` 已更正为 7 个，但 `:203-204` 的第六节正文未同步 |
| W-8 | `place` 槽 null 的成因 | `witness-memory-v1.md:85` — `完全没定位到地点（NavGrid 未 bake 时也返回 null，不抛错）` | 与代码一致（`Belief.js:105`、`:108`） | **一致，不构成不一致项** |
| W-9 | 证词标注的覆盖范围 | `witness-memory-v1.md` 未描述 `'fabricated'` 槽在证词里如何呈现（第一节 `:54-58` 只把它列为 sources 取值） | `Belief.js:249` 只对 `'suggested'` 追加 `（未经证实）`——`'fabricated'` 槽在证词中与 `'witness'` 槽**外观完全相同** | 设计稿无对应条款，故此条是"设计稿缺失"而非"两边矛盾" |

### 对 `belief-layer-v0.md`

该文档 `:1` 自述 `status: frozen`、`:3` 自述 `status: draft`。以下是它与代码的差异。

| # | 项 | 设计稿写的 | 代码实际 | 备注 |
|---|----|-----------|---------|------|
| B-1 | claim 数据结构 | `belief-layer-v0.md:22-29` — `{subject, predicate, object, confidence, source, timestamp}` 三元组 | `Belief.js:160` — 五槽 `{actor, action, target, place, time}` + `sources`/`strength`/`q`/`channel`/`eventId`/`id`；无 `subject`/`predicate`/`object`/`confidence` 字段 | `witness-memory-v1.md:30-34` 自述替换了这版结构 |
| B-2 | `source` 取值域 | `belief-layer-v0.md:27` — `source: 'witness' \| 'news' \| 'rumor'`，且是 **claim 级**字段 | `Belief.js:5-9` — **槽级** `claim.sources[slot]`，取值 `'witness'\|'suggested'\|'fabricated'\|null`；无 `'news'`、无 `'rumor'`，无 claim 级 `source` | 报道回流刻意复用 `'suggested'` 而非新开 `'news'`（`NewsBackflow.js:27-28`） |
| B-3 | `confidence` 机制 | `belief-layer-v0.md:26` — `confidence: number // [0,1]，1 = 亲眼所见，< 0.5 = 道听途说`；`:66-67` 传播时 `confidence *= 0.85`；`:67` `confidence < 0.05` 自动丢弃 | 全库无 `confidence` 字段（grep `js/` 零命中）。最接近的是 claim 上的 `q`（`Belief.js:160`），但 `q` 产出后**从不被任何写入点修改**，也没有衰减或丢弃逻辑 | — |
| B-4 | I-2 新闻注入 | `belief-layer-v0.md:52` — `按文章立场向受众 NPC 写入/修改 claim（source='news'）` | `NewsBackflow.js:61-93` — 回流**不读 `playerStance`**（grep 该文件无此符号），不按立场偏移任何值；受众限定为本次报道的目击者自身（`:66`），不外溢（`:30-32` 自述） | — |
| B-5 | I-3 社交传播（SIR） | `belief-layer-v0.md:53` — `Talk activity 配对时，以 SIR 衰减模型传播 claim`；`:60-68` 给出 `p_spread = confidence × 0.4`、每跳 `×0.85`、`<0.05` 丢弃 | 未实现。`TalkActivity.js` 不 import `Belief.js`（该文件 import 列表无此项）；全库无 claim 跨 NPC 复制的代码 | `witness-memory-v1.md:24-25` 亦自述"SIR 式复述传播触发点仍未实现" |
| B-6 | I-4 行为影响 | `belief-layer-v0.md:54` — `NPC 选目标/反应时（Agenda.tick）读 claim 影响 desire 权重` | 未实现。`js/behavior/Agenda.js` 不 import `Belief.js`；`injectSuggestion` 注释明写"NPC 本身不会因为被注入而改变任何行为"（`Belief.js:207-208`） | — |
| B-7 | I-1 事件录制的目标范围 | `belief-layer-v0.md:51` — `向参与 NPC + 目击圈写入 source='witness' claim` | `Belief.js:169-181` — 只写给 `selectWitnesses()` 选中的目击者。**事件参与者（actors）本人不会因为是参与者而自动获得 claim**；他们只有在也通过了 `perceive()` 阈值时才入选（候选池是全部 NPC，`BehaviorManager.js:118`） | 代码里 actor 与 witness 没有特殊关系；实际上 actor 距事件坐标为 0 或极近，`_distFactor` 会给很高的 q，但这是距离计算的副产物，不是显式规则 |
| B-8 | LLM 污染防护铁律 | `belief-layer-v0.md:43` — `LLM 只做翻译，不直接写 belief；belief 写入只能通过游戏内机制` | 与代码一致：`providers.js` 不 import `Belief.js`；写入由 `NewsUI.js:137` 的 `injectSuggestion` 执行 | **一致，不构成不一致项** |

---

## 13. 重写时需要注意的三处隐式契约

代码里存在但任何设计稿都没写明的耦合，grep 可证：

1. **证词标注字符串跨模块硬耦合**：`Belief.js:249` 产出的 `（未经证实）` 与
   `providers.js:73` system prompt 里的 `证词标注"（未经证实）"的部分` 必须逐字一致。
   `Belief.js:240-241` 明确要求"字面量不能改"，但这条约束只写在注释里，无静态检查。
2. **`actors` 数组下标语义无运行时保障**：`EventDefs.js#actorRoles` 完全不被读取
   （`EventDefs.js:8-9` 自述），`Belief.js:137` 硬性假定 `actorNpcs[0]` 是 actor、
   `[1]` 是 target。发事件时写错顺序不会报错，只会让 claim 的 actor/target 颠倒。
   注意 `ContactActivity.js:75` 的 eject 分支刻意用 `[otherNpc.id, npc.id]`（被弹出者排第二）。
3. **`q` 与 `channel` 是产出快照，永不更新**：claim 上的 `q`/`channel`（`Belief.js:160`）
   记录的是产出那一刻的感知裁决结果；之后无论槽值如何被注入、退化、虚构，这两个字段
   都不变。全库唯一的读取点是调试面板的显示语句
   `js/debug/WitnessDebugPanel.js:292`（`channel=${claim.channel} q=${claim.q…}`）——
   **不参与任何游戏逻辑计算**。重写时若省略调试面板，这两个字段就成了纯留档数据。
