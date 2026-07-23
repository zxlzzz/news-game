> **status: finalized** — 2026-07-22 定稿；B-①a / B-①b / B-② 批次待实施。

# 链条行为系统 — ChainTask / AttachmentDefs / BehaviorScripts

> 目标：NPC 行为 = 数据不 = 代码。新行为 = 脚本表里加一行，不写新类。
> 前置：affordance 池已就绪（A-①② 已入库）。

---

## 1. 三概念分工

| 概念 | 载体 | 职责 | 本轮变更 |
|------|------|------|----------|
| Task | `TaskRunner.primary` | 单 NPC 顺序行为 | 新增 `ChainTask`，逐步吸收手写特例 |
| Activity | `SocialLayer` | 多 NPC 协调（下棋、聊天、等公交） | 不动 |
| State | `BaseStateMachine` | 姿势 + 转换，被上两层驱动 | 不动 |

### 劫持边界

脚本声明 `interruptible`（路人默认 `true`，职业 NPC `false`）。
`SocialLayer` 的 50~98 优先级转换仅允许劫持 `interruptible` 的链条；
被劫持 = 链条 abort → 处置由统一机制兜底。

---

## 2. ChainTask — 解释器

一个类，三件事：按步推进、把每步映射到原语实现、在任何退出路径上执行处置。

### 2.1 脚本 schema

文件：`js/behavior/data/BehaviorScripts.js`（纯数据，场合文件只发数据的铁律适用）。

```js
eat_snack: {
  tier: 0,                       // 素材档位：0=零成本 / 1=低成本 / 2=高成本
  weight: 0.4,                   // Agenda 抽取权重
  interruptible: true,
  steps: [
    { op: 'attach', item: 'snack' },
    { op: 'goto', aff: 'use_trash' },
    { op: 'detach', item: 'snack' },
  ],
},
sweep: {
  tier: 1, interruptible: false,
  steps: [
    { op: 'attach', item: 'broom' },
    { op: 'goto', aff: 'use_trash' },
    { op: 'pose', clip: 'sweep', dur: [6, 10] },
    { op: 'loop', from: 1 },     // 回到 goto，永循环
  ],
},
```

### 2.2 六原语

| 原语 | 参数 | 实现 |
|------|------|------|
| `goto` | `aff` (tag) | `drawAffordance` 按 tag 抽点 → 内部复用 `VisitTask` 处理寻路/净空复检/占用（不用 VisitTask 的 arrivalState/dur，由后续步骤控制） |
| `attach` | `item` | 设 held modifier → ModifierLayer 扫描自动创建道具（见 §3） |
| `detach` | `item` | 清 held modifier → 道具自动销毁 |
| `pose` | `clip`, `dur`, `facing?` | `setState(clip)` + `stateDur=Infinity` 防 BSM timeout + dur 计时；`facing:'toward_aff'` = 面向上一个 goto 到达的实体 |
| `use` | `task` (白名单) | 委托现有手写 Task 当子任务（`'bench'` → `UseBenchTask`）；吸收缓冲区 |
| `loop` | `from`, `times?` | 跳回 `from` 步序；无 `times` = 永循环 |

### 2.3 失败语义

任何一步 abort（goto 超时、净空重试耗尽、use 子任务 abort）→ 整链 abort → 处置 → 上报 Agenda 走 `MAX_ABORTS`。

不给脚本写分支（if/else），因为一旦可写分支，"行为=数据"退化为"行为=换了语法的代码"。
需要条件行为的场景用两个脚本 + 权重解决。

---

## 3. attach 实现 — 骑 held 通道

**关键决策**：attach 不直接调 NpcPropManager，而是走 ModifierLayer 的 held 通道：

- `attach` = 给 NPC 设 held modifier（id = item 名） → NpcPropManager 的 `MODIFIER_TO_PROP` 扫描自动创建道具、heldPose overlay 自动叠加
- `detach` = 清掉 modifier → 道具自动销毁

道具生命周期仍然只有一个驱动源（modifier 扫描），ChainTask 不成为第二个道具写入点。

### 3.1 AttachmentDefs

文件：`js/behavior/data/AttachmentDefs.js`，每物一行。

```js
snack:  { anchor: 'hand_r', heldPose: 'hold_snack',
          acquire: { from: 'spawn' },
          dispose: 'destroy' },
guitar: { anchor: 'hand_l', heldPose: 'hold_guitar',
          acquire: { from: 'world_prop', tag: 'guitar_rack' },
          dispose: 'return' },
```

- `acquire.from`：`'spawn'`（凭空出现）或 `'world_prop'`（从场景实体拾取）
- `dispose`：`'destroy'`（销毁）或 `'return'`（归还来源实体，attach 时在 `npc.mem('items')` 记来源引用）

### 3.2 处置的单一住址

`dispose` 只写在 AttachmentDefs 表里，脚本里没有。

执行路径只有一条：`ChainTask.onStart` 时调 `runner.hold(() => 处置所有在挂物品并释放占用)`，正常 detach 走同一个处置函数。无论链条怎么结束（完成 / abort / 社交劫持 / NPC despawn），道具归宿都从表里查、从同一个函数出。

### 3.3 MODIFIER_TO_PROP 扩展

现有 `NpcPropManager.MODIFIER_TO_PROP` 是硬编码 map。新增物品需要：

1. AttachmentDefs 里加一行
2. `MODIFIER_TO_PROP` 里加映射
3. 视觉实现：简单物品用通用 `SimpleProp` 类（anchor + 基本几何），复杂物品写专用 NpcProp 子类

`SimpleProp`：接收 anchor 名 + 绘制描述（线条/矩形/圆形），覆盖棍状道具（扫帚、零食）不需要每种写一个类。

---

## 4. 分派 — Agenda 升级

### 路人（默认模板）

`_buildDesires` 的 desire 池从字符串（`'rest'`/`'use_vending'`）升级为脚本 id + 权重。
`_pickGoal` 命中脚本 → `new ChainTask(script)`。
现有 desire 逐个改写成一步脚本，`UseSmartPropTask` 在此过程中被吸收。

### 职业 NPC

新 `agendaTemplate: 'worker'`：profile 带 `script` 字段。
Agenda 只干一件事 — primary 空了就再推 `ChainTask`
（脚本自己 loop，实际推一次够，重推是异常兜底）。

### park_idler / passerby

模板骨架不动，"额度到期抽一个 affordance"升级为"抽一个脚本"，
VisitTask 类行为退化为一步脚本。

---

## 5. 校验脚本

静态检查，进 `check-invariants.mjs` 或独立 `scripts/check-behavior-data.mjs`：

1. 每个 `attach.item` 在 AttachmentDefs 存在，每个 item 有 `dispose`
2. 每个 `goto.aff` / `acquire.tag` 在 affordance 声明（AffordanceDefaults + scene.json）中存在
3. `loop.from` 指向合法步序
4. `pose.clip` 在 manifest 存在
5. `use` 目标 task 在白名单
6. `tier >= 1` 的脚本引用的新 clip 若 manifest 缺失 → error（防脚本先行素材未到）

---

## 6. 设计决策记录

### pose 的 facing

支持 `facing: 'toward_aff'`（面向上一个 goto 到达的实体）和 `facing: 1 | -1`（绝对方向）。
ChainTask 在 goto 到达时记住目标实体引用，pose 步用 `'toward_aff'` 读这个引用算方向。

### worker goto 占满时的行为

不加等待参数。占满 = `drawAffordance` 返回 null = goto abort = 整链 abort = Agenda 重推。
`_scanTimer` 的 1~3 秒随机延迟形成自然等待间隔。
worker 模板不计 abort 上限，循环重推。

### overlay（边走边做动作）

B-① 不实现。eat_snack 先用简化版（attach → goto → detach），
边走边吃的 gesture 效果等 ModifierLayer 有"由 task 控制的定时 gesture"接口后再加。

---

## 7. 批次拆分

### B-①a（道具基建）

文件：`js/behavior/data/AttachmentDefs.js`（新），`js/npc/props/SimpleProp.js`（新），`js/npc/props/NpcPropManager.js`（改 MODIFIER_TO_PROP）

- AttachmentDefs 表 + held 通道打通
- SimpleProp 通用类
- NpcPropManager 扩展 MODIFIER_TO_PROP
- 验证：attach snack modifier → 手上可见道具

### B-①b（链条执行器）

文件：`js/behavior/data/BehaviorScripts.js`（新），`js/behavior/tasks/ChainTask.js`（新），`scripts/check-behavior-data.mjs`（新）

- ChainTask 解释器（六原语）
- eat_snack 脚本（无 overlay 简化版）
- 校验脚本
- 依赖 B-①a 的道具通道

### B-②（passerby 第③刀，与 B-① 文件零重叠）

- passerby 模板实现 + stroll 退役
- 语义目的地设计 v2 的最后一块

之后每吸收一个手写 Task 都是独立小批：改脚本表 + 删类 + 校验绿 — 每批状态类/写入点数量下降。