# 目标管线立法 v1

**状态**：finalized（2026-07-16）
**取代**：`docs/audits/behavior-redundancy-2026-07.md` 附录 C（收敛提案）

---

## 1. 四层单向管线

```
Intent ──► Planning ──► Steering ──► Physics
```

每层只向下传输，禁止反向写入上层状态。

### 1.1 Intent 层（意图层）

**职责**：发布目标；响应结果回调。

**接口**：
```js
// Goal 对象
{
  dest:    { x, y },    // 目的地世界坐标
  timeout: number,      // 最长等待秒数（null = 无限）
  onDone:  (result) => void,  // result ∈ { 'arrived', 'timeout', 'blocked' }
}
```

**当前实现文件**：
- `js/behavior/Agenda.js` — 欲望评分 + Goal 发布
- `js/behavior/tasks/ExitSceneTask.js` — 离场 Goal
- `js/behavior/tasks/GotoTask.js` — 通用 Goto Goal（含 watchdog）
- `js/behavior/tasks/UseBenchTask.js` / `UseSmartPropTask.js` — 道具使用 Goal

### 1.2 Planning 层（规划层）

**职责**：dest → path（格子序列）。路径代价包含道路穿越（高代价格子），不由本层执行穿越判定——穿越是"代价"而非"流程"。

**当前实现文件**：
- `js/behavior/nav/NavGrid.js` — 代价格网（CELL=10，道路 cost=250）
- `js/behavior/nav/AStar.js` — A* 路径搜索
- `js/behavior/WalkMode.js#planCrossing` — 过街路线组合

### 1.3 Steering 层（导向层）

**职责**：path → desired velocity；决定到达（arrival decision）。

**当前实现文件**：
- `js/behavior/BaseStateMachine.js#steerRoam` — 漫游帧驱动，写 `mot.vel`
- `js/behavior/WalkMode.js` — wander / direct / path_follow / planCrossing 模式选择
- `js/behavior/nav/Lookahead.js` — 3 探针速度调整（障碍回避）

### 1.4 Physics 层（物理层）

**职责**：desired velocity → 位置积分；恢复决策；安全网决策。
**铁律**：Physics 层是唯一合法的位置写入点（`nudgeXY` / `setXY` / `integratePhysics`）。

**当前实现文件**：
- `js/behavior/Motor.js#integratePhysics` — 唯一位置积分（步骤 13）
- `js/behavior/Motor.js#_progress` — 卡死探测 + 恢复路由（per-mode）
- `js/behavior/BehaviorManager.js#_separate` — NPC 间分离冲量（`nudgeXY`）

---

## 2. 三条铁律

### 铁律 ①：按层切分，不按用例切分

每个文件只能属于一个层。禁止"Goto 文件同时做规划 + 导向 + 到达判定"的用例内聚写法。

### 铁律 ②：同层同职责的规则必须共存于该层唯一的决策文件，以声明式表格表达

表格列：`条件 | 阈值 | 动作 | 优先级 | 原因`

禁止将同一职责（如"到达判定"）的阈值散布在多处以魔法数字形式存在。

### 铁律 ③：距离比较与计时器累加只能出现在决策文件中

- 距离比较：`Math.hypot(...) < <number>` 或 `dist* < <number>`
- 计时器累加：`+= dt` / `+= delta`

在决策文件之外出现上述模式 → `check-invariants.mjs Rule 7` 发 WARN，注明迁移刀号。

---

## 3. 决策文件清单（按层）

| 层 | 决策文件（目标态） | 当前分散位置 | 迁移刀 |
|----|-------------------|--------------|--------|
| Intent | `js/behavior/tasks/GotoTask.js` | GotoTask.js watchdog (2s/8px) | N-2 |
| Planning | `js/behavior/nav/NavGrid.js` | — | — |
| Steering | `js/behavior/SteeringDecision.js`（新建） | BaseStateMachine.js arrival 阈值、WalkMode.js abandonAfter | N-1 |
| Physics | `js/behavior/Motor.js` | Motor.js progress monitor (1.5s/15px) | N-3 |

---

## 4. 三刀序列

### N-1：abandonAfter 统一（Steering 层）

**问题**：`routing` 模式默认 `?? 30`，`direct` 模式默认 `?? 60`，语义不一致。
**交付物**：
- 在 `Motor.js` 定义 `ABANDON_ROUTING = 30`、`ABANDON_DIRECT = 60` 具名常量
- `BaseStateMachine.js` / `WalkMode.js` 所有 `abandonAfter` 调用点引用具名常量
- 删除 `WalkMode.js` 中 `setWalkMode` / `pushWalkMode` / `popWalkMode` 的 `@deprecated` compat 重导出（前提：grep 确认零外部消费者）

**验收**：`check-invariants.mjs` 通过；grep `abandonAfter.*\?\?.*[0-9]` 零结果。

### N-2：卡死检测整合（Intent 层）

**问题**：GotoTask watchdog（2s/8px）与 Motor progress monitor（1.5s/15px）双重检测，触发顺序不一致。
**交付物**：
- Motor progress monitor 负责 per-mode 恢复（routing→routeReplan, direct→_stuckOnce→abandon, wander→roamTarget=null）
- GotoTask watchdog 负责 task 级放弃（`onDone('blocked')`）
- 两者阈值写入同一声明式表（GotoTask.js 顶部 `WATCHDOG` 常量块）
- StuckProbe 保持纯观测，`_stuckOnce` 标志生命周期文档化

**验收**：`check-invariants.mjs` 通过；两套检测各司其职，无重复触发。

### N-3：compat 重导出删除 + walkSpeed 常量（跨层）

**问题**：`walkSpeed` 魔法数字 `26`（或 `|| 26`）出现 5 处；`@deprecated` compat 重导出残留。
**交付物**：
- `Motor.js` 定义并导出 `DEFAULT_WALK_SPEED = 26`
- 所有 5 处 `26` / `|| 26` 改为引用 `DEFAULT_WALK_SPEED`
- 删除 `BaseStateMachine.js` 中 `setState` / `STATE_DEFS` 的 `@deprecated` compat 重导出

**验收**：grep `\|\| 26\b` 零结果；grep `= 26\b` 只剩 `DEFAULT_WALK_SPEED` 定义处；`check-invariants.mjs` 通过。

---

## 5. 三数验证表

验收目标（全三刀完成后）：

| 指标 | 起始值 | 目标值 | 度量方式 |
|------|--------|--------|----------|
| 距离/计时器阈值魔法数分布文件数 | 6 | 1 | `check-invariants.mjs Rule 7` 白名单缩减 |
| 多文件重复同一机制的实例数 | 6 | 0（表格化） | grep `abandonAfter.*\?\?` + `_stuckOnce` + `|| 26` |
| 位置写入路径数 | 4 | 1（Motor） | grep `npc\.[xy]\s*[+\-]?=` 非 Motor/nudgeXY |

---

## 6. 与审计文档的关系

本文件取代 `docs/audits/behavior-redundancy-2026-07.md` 附录 C 中的收敛提案。
审计文档本身保留为历史快照，不更新。
