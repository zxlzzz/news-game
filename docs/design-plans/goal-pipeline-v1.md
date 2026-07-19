# 目标管线立法 v1 (r2.5)

**类型**：normative（失效代码变更须同 commit 更新本文件）
**状态**：finalized（2026-07-17）；N-1 已落地（3cd1f99）；N-2a 已落地（97c1e44）；N-2b 已落地（0dcf420）；N-3 已落地（3607cbc / f7899b7 / 603307f / 1c0f789 / 74d277a）；@deprecated compat 迁移：D2-d
**取代**：`docs/audits/behavior-redundancy-2026-07.md` 附录 C（作废）；本文件 r1（2026-07-16，被否决——三刀降级为常量改名、Goal 接口伪造为现状、冻结 bug 缺失）
**地面真值**：审计文档责任表 1–8 为所有"起始值"数字的唯一来源，本文引用不复制。

---

## 1. 四层单向管线

```
Intent ──► Planning ──► Steering ──► Physics
```

每层只向下传输，禁止反向写入上层状态。**以下各层接口均为目标态**（N-2/N-3 完成后成立）；现状文件清单标注了各自与目标态的差距。

### 1.1 Intent 层（意图层）

**职责**：发布 Goal；收 result 回调。除此之外无移动政策——不检距离、不计时、不选路。

**目标态接口**（N-2 引入，N-3a 扩展 meta）：
```js
// mot.goal
{
  dest:    { x, y },          // 语义目的地折算后的世界坐标
  timeout: number | null,     // 最长秒数（null = 无限）
  onDone:  (result) => void,  // result ∈ { 'arrived', 'timeout', 'blocked' }
  meta: {
    jaywalk:      boolean,         // 随机决定是否横穿马路（publishGoal 封入）
    arrivalRule?: string,          // ARRIVAL_RULES 行 id；缺省 'walk_goal'
    offWorld?:    boolean,         // true = 边缘离场；到达判据为 npc.x 越界而非距离
  },
  elapsed: number,            // Motor 每帧累加
}
```

**现状文件**：`Agenda.js`、`tasks/*.js`。差距：任务通过 `modeDirect` 链 / `mot.routeTarget` / `pushWalkMode` 三条私路直接驱动导向层，且 GotoTask 自带 watchdog（越层做卡死检测，审计责任 2-B）。

### 1.2 Planning 层（规划层）

**职责**：dest → 路点序列。道路穿越是**代价**（ROAD cost=250 的格子）而非**流程**——不存在"过街子程序"。

**现状文件**：`nav/NavGrid.js`、`nav/AStar.js`、`nav/PathPlanner.js`。差距：`WalkMode.js#planCrossing` 把穿越做成了流程组合，属违章建筑，N-2 拆除。

### 1.3 Steering 层（导向层）

**职责**：路点 → 期望速度（写 `mot.vel`）；**到达裁决**（本层唯一的距离判定职责）。

**现状文件**：`BaseStateMachine.js#steerRoam`、`WalkMode.js`、`nav/Lookahead.js`。差距：到达阈值 6 种语义散布（审计责任 1）；wander/direct/path_follow/routing 四套模式并存。

### 1.4 Physics 层（物理层）

**职责**：期望速度 → 位置积分（唯一）；**恢复裁决**；**安全网裁决**。

**铁律**：Physics 层是唯一合法位置写入点。目标态下 `Motor.js#integratePhysics` 消费 `mot.vel` 是唯一移动路径；`nudgeXY`（分离冲量）与安全网夹取为 Physics 层内部授权操作。

**现状文件**：`Motor.js`、`BehaviorManager.js#_separate`。差距：steerRoam routing 分支经 `nudgeXY` 直接步进 + `setXY` 到达传送（审计责任 5-B/C）；`Npc.js#update` 内联积分为平行第四条路（责任 5-G）。

---

## 2. 三条铁律

### 铁律 ①：只按层次拆分，禁止按应用场合拆分

每个文件属于且只属于一层。禁止"Goto 文件同时做规划+导向+到达判定"的场合内聚。场合文件（各 Task / Activity）**只发数据（Goal），不带政策**（阈值、计时、距离判定）。

### 铁律 ②：允许多规则，禁止多住址

同一职责的全部规则共存于该层**唯一**裁决文件，以声明式表格表达，列为：

`条件 | 阈值 | 动作 | 优先级 | 理由`

样板：`BaseStateMachine.js#PED_TRANSITIONS`。不同场景可以有不同阈值（多规则合法），但必须是同一张表里的不同行（多住址非法）。

### 铁律 ③：距离比较与计时器累加只出现在裁决文件

- 距离比较：`Math.hypot(...) < n` / `dist* < n` / `moved < n`
- 计时器累加：`+= dt` / `+= delta`

裁决文件对外导出**裁决函数**（如 `arrivalCheck(...)` 返回动作），调用方只收动作、不做比较——否则比较仍散布在调用方，铁律形同虚设。

执法：`check-invariants.mjs Rule 7`。渐进收紧：现在 WARN + 白名单（12 文件，各注刀号）→ **N-3 完成时移动相关文件转 error**。活动相位计时器（ChessActivity 等，非移动政策）长期保留白名单并注明理由。

---

## 3. 四张裁决表（N-1 + N-2a 交付物）

与审计责任表 1/2/3/4 一一对应：

| 表 | 层 | 住址 | 归拢来源（审计行号） |
|----|----|------|--------------------|
| **到达裁决表** `ARRIVAL_RULES` | Steering | `js/behavior/SteeringDecision.js` | 责任 1 A–H：routing 终点 20/8、路点推进 8、navPath 推进 8、walk 终点 6、nextTarget 角切 2、长椅半径 80×2 |
| **恢复裁决表** `RECOVERY_RULES` | Physics | `js/behavior/Motor.js` | 责任 2 A–F：progress monitor 1.5s/15px、GotoTask watchdog 2s/8px、modeDirect 超时 ??60、routing 超时 ??30、（StuckProbe 除外）、stateDur 转换 |
| **安全网裁决表** `SAFETY_RULES` | Physics | `js/behavior/Motor.js` | 责任 3 A–G：bounds clamp、escape、wall-slide、Lookahead 参数、zone 修正、Npc 夹取、nearestWalkable fallback |
| **规划裁决表** `PLANNING_RULES` | Planning | `js/behavior/nav/PathPlanner.js` | 责任 4/8：ROAD 代价政策（default 250/jaywalk 3）、斑马线管代价 2/半宽 20 |

StuckProbe 永久保持纯观测，不入表、不受铁律③约束（白名单注 keep）。

---

## 4. 三刀序列

每刀独立新会话；CC prompt 必须写**前后状态变量数/写入点数/阈值住址数对比**、静态验证条款（仿真需显式批准）、契约文档同 commit 更新。

### N-1：归表（行为保真，只改住址）✅ 3cd1f99

**交付**：
- 建三张裁决表（§3），全部现行阈值原值入表，每行带理由注释
- 调用方改为调用裁决函数；`BaseStateMachine.js` / `WalkMode.js` / `GotoTask.js` / `Motor.js` 内的裸距离比较与超时比较全部迁走
- **零行为变化**——数字不改、语义不改，只改住址。abandonAfter 默认值 30/60 不一致照原样入表（两行、各注理由），统一与否留待 N-2 后用表格视角再裁

**验收（静态）**：`check-invariants.mjs` 通过；Rule 7 白名单从 12 文件缩至裁决文件 + StuckProbe + 活动计时器；grep 责任 1 表列出的 8 个判定点原址零残留。

### N-2a：规划层（斑马线入格 + ROAD 代价准入 + cost profile）✅ 97c1e44

**交付**：
- 建第四张裁决表 `PLANNING_RULES`（§3，4 字段）
- `PathPlanner.plan()` 增 `opts.roadCost` 参数，A* 邻居扩展改用有效代价（ROAD → roadCost）；起点 snap 不再拒绝 ROAD（修分离冲量被推入者）
- `NavGrid.bake()` 增 `planningRules` 参数（政策注入，nav 零 import 增量）；`_bakeCrosswalks` 覆盖 ROAD 格为 cost=2 供路线吸附
- bake 调用方（SceneInitializer.js / headless-sim.mjs）传入 `PLANNING_RULES`
- `check-invariants.mjs` Rule 8：PLANNING_RULES 字段名定义只能出现在 PathPlanner.js
- 预期行为变更两条：同侧路径可能被吸向斑马线管沿线（管 cost 2 < 草 8）；起点恰在 ROAD 格不再 snap 到路外，直接从原地规划离开
- 跨侧能力装膛不击发：现存调用方均有同侧检查，无人请求跨侧路径

**验收（静态）**：`check-invariants.mjs` 全绿含 Rule 8；`=== ROAD` 计数 4（end snap / A* eff×3）；`grep -n "import" NavGrid.js` 无 PathPlanner。

### N-2b：Goal 通道（任务退化为发 Goal 收 result）✅ 0dcf420

**交付**：
- 引入 `mot.goal`（§1.1 接口）与 `mot.path`（路点数组 + 游标，二者为仅存的每目标状态位）
- 新建 `PlanService.js`（Planning 层胶水）：`publishGoal` / `ensurePath` / `ensureWanderPath`；`mot.path` 唯一写入点
- 全部 Task 改写为：发 Goal → 收 result。timeout 判定进恢复裁决表（goal.elapsed > goal.timeout → result='timeout'），恢复穷尽判定进恢复裁决表（两击制：first stuck → needReplan；second stuck → result='blocked'），到达判定在 steerRoam（result='arrived'）
  - **J1-a 修正**：StrollTask blocked 回落改为有限重发（连续 `STROLL_BLOCKED_LIMIT=2` 次后退化 modeWander），不再无条件重发——原无条件重发在 plan 必败场景下导致永冻（见 J1 bug report）
- `crossing` / `jaywalking` 标签改为 NavGrid 格值空间派生（`Npc.getTags()` 中读 cost，取代 `planCrossing` 标签声明周期）；jaywalk_sprint 进 SAFETY_RULES；`checkZoneTransition` 改为无状态 vel 覆写（删除 pushWalkMode 调用）
- **删除**：`planCrossing`（穿越归代价）、`pushWalkMode`/`popWalkMode`/walkModeStack、`modeDirect` 及任务侧 onArrive 链式路点接力（路点推进归 Steering 按 `mot.path` 游标走）
- **删除**：GotoTask watchdog（2s/8px、`_watchT`/`_replanned`）——职责已并入恢复裁决表
- **删除**：`navPath`/`navIdx`/`navGoalX`/`navGoalY`（BSM walk branch）；`direct_timeout`/`goto_watchdog` RECOVERY_RULES 行（无消费者）
- ExitSceneTask 留 routing 至 N-3 一并迁（routing 链 N-3 整体删除）；path_follow 不在死刑名单
- **亡者逐名**（被删机制的现存回落默认值）：`modeDirect.abandonAfter=60`（RECOVERY_RULES.direct_timeout.default）；`modeDirect.nextTarget=null`；`planCrossing.jaywalkChance=0.1`；`GotoTask.timeout=60`（保留为 publishGoal 参数）；`_chainWaypoints.remaining=max(5, ...)`（无等效默认）

**验收（静态）**：grep `planCrossing|pushWalkMode|popWalkMode|modeDirect` 零命中；grep `onDone` 覆盖全部 Task；`_watchT|_replanned|_stuckOnce|_sanitized|navPath|navIdx|navGoalX|navGoalY|walkModeStack` 零命中。

### N-3：杀行

**交付**：
- **删除** routing 模式整条链：`routeTarget`/`routePts`/`routeIdx`、steerRoam routing 分支（含 `nudgeXY` 直接步进与 `setXY` 到达传送）——离场/公交改发 Goal
- **删除** `nextTarget` 机制（`modeDirect` 签名、StrollTask/GotoTask 传参、steerRoam 角切行）
- **删除** `Npc.js#update` 内联积分（289–296）——非托管 NPC 并入 Motor 积分或改挂件定位，具体方案在 N-3 prompt 中先行核定（cyclist 未注册绕过 NavGrid 为既有约束，不得顺手改动）
- **删除** 重复恢复行（`_stuckOnce` 与表内规则二选一，表胜）
- **删除** `@deprecated` compat 重导出（审计 B-1）：`setWalkMode`（WalkMode.js，消费者 WaitBusActivity.js）和 `setState`/`STATE_DEFS`（BaseStateMachine.js，消费者 StallActivity / UsePropActivity / TalkActivity / BehaviorManager）——消费者已迁至 Motor.js 直接导入后删除（D2-d；原文"grep 已证零消费者"有误——消费者存在，需先迁移再删导出）
- Rule 7 移动相关文件转 error

**验收（静态）**：grep `routeTarget|routePts|routeIdx|nextTarget|_stuckOnce` 零命中；grep `npc\.[xy]\s*[+\-]?=` 仅 Motor 授权点；`check-invariants.mjs` 全绿（含 error 级 Rule 7）。

---

## 5. 四数验收表（全三刀完成后）

N-3 后状态（D2-c 实测）。

| 指标 | 起始（审计锚点） | 目标 | N-3 后状态 | 度量 |
|------|-----------------|------|------------|------|
| 到达阈值语义 | **6 种**（责任 1：routing 终点 / 路点推进 / navPath 推进 / walk 终点 / 角切 / 长椅半径） | **1 张表** | **1 张表**（corner_cut 已删，N3-d） | 裸距离比较 grep 零命中（Rule 7 error） |
| 卡死/超时机制 | **6 套**（责任 2 A–F） | **1 张表 + StuckProbe 纯观测** | **2**（RECOVERY_RULES 两击制 + StuckProbe） | grep `_watchT\|_stuckOnce\|abandonAfter.*\?\?` 零命中 |
| 位置写入路径 | **4 条**（责任 5：mot.vel / nudgeXY 步进 / setXY 传送 / Npc 内联） | **1 条**（mot.vel → integratePhysics；分离冲量与安全网为层内授权） | **1 条**（nudgeXY 步进 + setXY 传送已删，N3-b；Npc 内联已删，N3-c） | grep `npc\.[xy]\s*[+\-]?=` |
| 每目标状态位 | **≥10**（roamTarget / routeTarget / routePts / routeIdx / navPath / navIdx / mode.target / mode.nextTarget / \_watchT / \_replanned / \_stuckOnce / \_sanitized…） | **2**（`mot.goal` + `mot.path`） | **2**（mot.goal + mot.path）+ npc.roamTarget（wander 辅助，非每目标状态位，语义清晰） | grep 逐项零命中 |

重构真伪判据：这四个数字降了才算根修；只加常量名、只补注释属化妆，直接打回。

---

## 6. 冻结死区 bug 的死亡路径

**起因**（N 系列直接动机）：`steerRoam` direct 分支，`nextTarget` 存在 + raycast 阻挡 + `distToGoal ∈ [2, 6)` 时无条件 `return`，不写 `mot.vel`——V-1 删标量回落后暴露（第③类迁移教训：删参数暴露回落路径）。

**处置**：**禁止单独 hotfix**。N-2 删 modeDirect 链后 `nextTarget` 失去全部来源；N-3 删角切行后死区代码本体消失。P-0 已在 StuckProbe 加 `distToGoal`/`hasNextTarget`/`raycastBlocked` 只读字段，迁移期间可观测该死区的发生频次。

---

## 7. 与审计文档的关系

审计责任表 1–8 保留为地面真值 snapshot，不更新；附录 C 全部作废（含 C-1～C-5——其中 C-2 常量化、C-3 删重导出的**内容**被 N-1/N-3 吸收，但以归表/杀行形式执行，不以孤立常量化执行）。