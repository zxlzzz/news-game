# Behavior 层冗余机制审计 — 2026-07

**类型：** snapshot（不原地更新）  
**范围：** `js/behavior/`（含 nav/ tasks/ activities/）、`js/npc/Npc.js`  
**方法：** 读代码 + grep，禁止运行任何仿真  
**日期：** 2026-07-16

---

## 目录

1. [责任 1：到达判定](#责任-1到达判定)
2. [责任 2：卡死检测与恢复](#责任-2卡死检测与恢复)
3. [责任 3：越界与安全网](#责任-3越界与安全网)
4. [责任 4：目标点选取](#责任-4目标点选取)
5. [责任 5：速度与朝向写入](#责任-5速度与朝向写入)
6. [责任 6：任务→模式的驱动链](#责任-6任务模式的驱动链)
7. [责任 7：回落默认值普查](#责任-7回落默认值普查)
8. [责任 8：常数单一来源核查](#责任-8常数单一来源核查)
9. [附录 A：冲突清单](#附录-a冲突清单)
10. [附录 B：死代码/参数清单](#附录-b死代码参数清单)
11. [附录 C：收敛方案](#附录-c收敛方案)

---

## 责任 1：到达判定

"我到目标了吗？" — 所有判断 NPC 是否抵达目标点的检查。

| # | 位置 | 阈值 | 触发条件 | 关系 |
|---|------|------|----------|------|
| A | `BaseStateMachine.js#steerRoam#~243` | `< 20 (building), < 8 (default)` | routing 模式最终到达 routeTarget；exitType==='building' 时扩大到 20 | **唯一**（routing 终点） |
| B | `BaseStateMachine.js#steerRoam#246` | `< 8` | routing 模式中间路点推进（dist 到下一个 routePts[i+1]） | 与 A 同文件；阈值与 A default 相同但作用不同 |
| C | `BaseStateMachine.js#steerRoam#295` | `< 8` | navPath 中间路点推进（navIdx < navPath.length-1） | 与 B 完全相同阈值，不同数组；**重叠但正确**（B=routePts, C=navPath） |
| D | `BaseStateMachine.js#steerRoam#302` | `< 6` | walk/run/jog 分支 distToGoal — 调用 mode.onArrive | **唯一**（walk branch 终点）；比 A/B/C 小 2px |
| E | `BaseStateMachine.js#steerRoam#309` | `< 2` | direct 模式 nextTarget 角切：distToGoal < 2 或 raycast 无障碍时提前切换 nextTarget | **优化逻辑**，防止绕远；阈值非常紧 |
| F | `GotoTask.js#_chainWaypoints#onArrive` | 由 D 触发 | GotoTask 链式 modeDirect；每段 onArrive 回调推进下一个路点 | GotoTask 不自己检距离，依赖 D |
| G | `UseBenchTask.js#onStart#34` | `radius 80` | 判断是否已在长椅旁边（已到即坐） | `nearestFreeBench(npc, 80)` 半径判定；语义不同（"已经在附近"不同于"到达目标点"）|
| H | `UseBenchTask.js#tick#74` | `radius 80` | goto 阶段完成后二次检查长椅 | 与 G 重复；两次都用 80px |

**阈值列表（距离比较）：**
`20`, `8` (×3), `6`, `2`, `80` (×2)

**说明：**
- B 和 C 同阈值 8 对应两个不同数组（routePts vs navPath），逻辑正确、非冗余。
- D 的 6 与 B/C 的 8 差异 2px 有意（walk branch 需要更靠近才算到，防止过早 onArrive 触发）。
- E 的 2 极紧，在高速 NPC 单帧可能跳过，依赖 raycast fallback 兜底。

---

## 责任 2：卡死检测与恢复

"我静止太久了吗？" — 所有检测无运动/超时并触发恢复动作的机制。

| # | 机制名 | 位置 | 检测窗口 | 位移阈值 | 恢复动作 | 关系 |
|---|--------|------|----------|----------|----------|------|
| A | Motor progress monitor | `Motor.js#integratePhysics#~295-310` | 1.5 s (`progressAcc >= 1.5`) | `moved < 15 px` | routing→routeReplan; direct→`_stuckOnce`→abandon(stateTimer=abandonAfter); wander→roamTarget=null | **主恢复层**，所有 motorInstalled NPC 均运行 |
| B | GotoTask watchdog | `GotoTask.js#tick#90-100` | 2 s (`_watchT >= 2`) | `disp < 8 px` | 重规划一次（`_replanned` flag，单次），再失败→'abort' | 与 A **并行运行**，阈值更严（8 < 15），窗口更长（2 > 1.5） |
| C | modeDirect abandonAfter | `WalkMode.js#tickWalkMode#351` | `mode._elapsed > (mode.abandonAfter ?? 60)` 累计 | 无位移检测 | `setState(npc, 'walk', 'direct_timeout')` | **纯超时**，不管是否移动；默认 60s |
| D | routing stateTimer | `BaseStateMachine.js#tickBaseState#205` | `npc.stateTimer > (t.abandonAfter ?? 30)` 累计 | 无位移检测 | `setState(npc, 'walk', 'routing_timeout')` | **纯超时**；默认 30s；与 C 默认值**不一致**（30 ≠ 60） |
| E | StuckProbe | `StuckProbe.js` | 2 s 快照，30 s 统计 | `moved < 8 px`（四种场景） | **纯观察**，写入 `window.__stuck`，无恢复副作用 | 覆盖面最广（包含等车 NPC、Activity 内 NPC），不与 A/B 冲突 |
| F | wander maxDuration (stateDur) | `BaseStateMachine.js#tickBaseState` | `stateTimer > stateDur`（BSM 状态转换） | 无 | 状态切换（stand→walk 等） | **正常超时转换**，非卡死专用；与 A/B 独立 |

**并发分析：**
对于执行 GotoTask 的 NPC，A（Motor progress monitor）和 B（GotoTask watchdog）**同时运行**：
- A 以 1.5s/15px 为准，优先触发 direct mode _stuckOnce（一次重规划机会）
- B 以 2s/8px 为准，比 A 更严格，触发自己的重规划路径
- 若 A 先触发重规划，B 的 `_prevX/Y` anchor 会被新路径更新，可能重置 B 的计时
- 两者都有"重规划一次"逻辑，存在双重重规划风险（先 A 重规划，再 B 重规划）

**StuckProbe 阈值 vs Motor 阈值：**
- StuckProbe 用 `moved < 8`（2s 窗口）
- Motor 用 `moved < 15`（1.5s 窗口）
- 两者设计目标不同（观察 vs 恢复），但含义有重叠

---

## 责任 3：越界与安全网

"我在合法区域吗？" — 所有防止 NPC 进入禁区或超出画布的检查。

| # | 机制名 | 位置 | 触发条件 | 动作 | 关系 |
|---|--------|------|----------|------|------|
| A | `_slideMove` bounds clamp | `Motor.js#_slideMove#~220-240` | 每帧积分后 x/y 超出 npc.min/maxX/Y | 直接夹取坐标 | **最底层守卫**，每帧必执行 |
| B | `_slideMove` escape rule | `Motor.js#_slideMove#~215` | 当前格已是 BLOCKED（cost=0）时 | 允许任意方向移动（escape mode）| 防止 NPC 卡死在障碍格内 |
| C | `_slideMove` axis separation | `Motor.js#_slideMove#~231-245` | 前方格 BLOCKED | 尝试纯 X 或纯 Y 分量；失败则零速 | **wall-slide**；保持原速度大小 |
| D | Lookahead 前瞻探针 | `Lookahead.js#applyLookahead` | 4格前 BLOCKED → 尝试 ±35° 旋转；1格前 BLOCKED → 减速 ×0.4 | 调整 mot.vel 方向或减速 | 在 _slideMove 之前处理，**预防**而非修复 |
| E | `checkZoneTransition` | `WalkMode.js#checkZoneTransition` | walk/run 状态 NPC 进入 road/bike_lane 区 | 分配修正 modeDirect 目标，推回合法侧 | BSM 每帧主动调用；专门针对 wander NPC 漂移 |
| F | Npc.js bounds clamp | `Npc.js#update#290-296` | 非 motorInstalled NPC，x/y 超出 min/maxX/Y | x 夹取；vy 反向（有 walkMode 时零速而非反弹） | 与 A **重复**，但仅对非托管 NPC（leash 跟随者等）|
| G | NavGrid.nearestWalkable fallback | `NavGrid.js#nearestWalkable#168` | BFS 找不到合法格时 | 返回原始坐标 `{x: wx, y: wy}` | 静默回退，可能返回 ROAD 格 |

**注意：** G 的 fallback 返回原始坐标（可能是 ROAD 格），调用方（pickModeTarget）依赖 `_sanitized` flag 只清理一次，重复进入仍可能取到 ROAD 坐标。

---

## 责任 4：目标点选取

"下一步去哪？" — 所有生成随机游荡目标或走到特定位置的选取逻辑。

| # | 函数 | 位置 | 输入 | 输出 | 约束 | 关系 |
|---|------|------|------|------|------|------|
| A | `sampleWalkableNear` | `NavGrid.js#175` | npc, radius=350 | cost-1/8 格中心坐标 | 不跨侧（NEAR_Y），同侧约束，bounds 约束 | **主要 wander 采样**；92% 走cost-1 |
| B | `nearestWalkable` | `NavGrid.js#135` | wx, wy, bounds | 最近非 ROAD 可走格 | BFS 扩散 | 用于 sanitize；A 的 fallback |
| C | `_pickRandom` | `WalkMode.js#250` | npc | 随机游荡目标 | 5次随机尝试；无 bounds 时用 A(350) | 包装 A；若 A 为 null 则返回 null |
| D | `pickModeTarget` | `WalkMode.js#_pickRandom` | npc, mode | direct 目标 / wander 目标 | direct 分支单次 `_sanitized` + B 清理 | 调用 C；`_sanitized` flag 有状态泄漏风险（见附录 A-3）|
| E | `PathPlanner.plan` | `PathPlanner.js` | start, goal, grid | A* 路点数组 | ROAD 格不通行；line-of-sight 简化 | 用于 routing/GotoTask |
| F | `GotoTask._plan` | `GotoTask.js` | npc, target | 路点数组，提交 _chainWaypoints | 同侧检查 `_planSameSide` | 包装 E；失败→'abort' |
| G | `Agenda._utility` | `Agenda.js#116` | npc | 效用分 0–1 | nearestFreeBench / findAvailableSlot 空间查询 | **语义目标选取**，非几何路点 |
| H | `ExitRegistry.findExit` | `ExitRegistry.js` | npc, type | 出口坐标 | exitType, yZone 过滤 | 用于 triggerDeparture；不在 behavior/ 下但被 BSM 调用 |

---

## 责任 5：速度与朝向写入

"向量写入通道" — 所有写 npc.speed/direction/x/y 的入口。

| # | 函数/路径 | 位置 | 写入字段 | 调用方 | 关系 |
|---|-----------|------|----------|--------|------|
| A | `mot.vel` 通道 | `BaseStateMachine.js#steerRoam#walk/run/jog分支` | `mot.vel = {vx, vy}`（写 Motor 命名空间，非直接写 npc） | steerRoam walk 分支 | 延迟：step 13 integratePhysics 消费；routing 分支不用此通道 |
| B | `nudgeXY` | `Motor.js#258` | `npc.x += dx; npc.y += dy`（Proxy 授权） | BSM steerRoam (routing 分支直接步进) + BM._separate | **授权写入**；Proxy 保护下的直接坐标更新 |
| C | `setXY` | `Motor.js#253` | `npc.x = x; npc.y = y`（Proxy 授权） | BSM steerRoam (routeTarget teleport-on-arrive) | 精确传送；到达时覆盖坐标 |
| D | `_mw('speed', ...)` | `Motor.js#163` | `npc.speed = def.speedK * (walkSpeed \|\| 26)` | `setState` 内部（每次状态切换） | **唯一合法** speed 写入路径 |
| E | `updateFacing` | `BaseStateMachine.js#186` | `npc.direction = ±1` | steerRoam（walk 和 routing 分支末尾） | 阈值 `\|vx\| > spd * 0.35`，冷却 `dirCD = 0.45s` |
| F | `_separate` nudgeXY | `BehaviorManager.js#184,200` | `npc.x/y` via nudgeXY | BM.update 末尾 | 分离推力；规模因子 `sepR = 24 × scale/0.18` |
| G | Npc.js 内联积分 | `Npc.js#289-296` | `npc.x += direction * speed * dt; npc.y += vy * dt` | Npc.update（非 motorInstalled 路径） | 与 Motor integratePhysics **完全独立的积分路径**；适用于 leash 跟随者、场景内置非托管 NPC |

**通道冲突潜在点：**
- A（mot.vel）和 B（nudgeXY）在 routing 模式下不重叠（routing 用 B，walk 用 A）
- G 只在 `!_motorInstalled` 时运行，与 Motor 路径互斥
- _separate(F) 在 Motor integratePhysics 之后运行（BM.update step 4），不与 A/B 冲突

---

## 责任 6：任务→模式的驱动链

"谁触发了 walkMode？" — 所有从高层任务生成 modeDirect/routing 的入口，及其语义差异。

| # | 入口 | 位置 | 生成的 mode | abandonAfter | 语义 |
|---|------|------|-------------|-------------|------|
| A | `StrollTask → modeDirect` | `StrollTask.js#_chainWaypoints` | modeDirect，链式 | **硬编码 30** | 随机游荡短途腿，不期望长时间 |
| B | `GotoTask → modeDirect` | `GotoTask.js#_chainWaypoints` | modeDirect，链式 | `remaining`（从 timeout=60 递减） | 有明确目标的多段导航 |
| C | `UseBenchTask → GotoTask` | `UseBenchTask.js#50` | (委托给 GotoTask) | `timeout: 35` | 走向长椅 |
| D | `UseSmartPropTask → GotoTask` | `UseSmartPropTask.js#48` | (委托给 GotoTask) | `timeout: 30` | 走向道具 |
| E | `ExitSceneTask → routing (bus)` | `ExitSceneTask.js#47-56` | `mot.routeTarget = {x,y,abandonAfter:30,onArrive}` + `setState('routing')` | 30 | 路由到公交等候区 |
| F | `ExitSceneTask → triggerDeparture` | `ExitSceneTask.js#65-73` → `BSM#_routeToExit` | `mot.routeTarget`（無显式 abandonAfter） | ?? 30（fallback） | 路由到边缘/楼门出口 |
| G | `BM lifespan → ExitSceneTask` | `BehaviorManager.js#114-118` | (委托给 ExitSceneTask) | — | 寿命到期强制离场 |
| H | `Agenda → StrollTask` | `Agenda.js#141` | (委托给 StrollTask) | — | 无特定目标时默认游荡 |
| I | `_routeToExit (直接调用)` | `BaseStateMachine.js#_routeToExit` | `mot.routeTarget` + `setState('routing')` | 无（依赖 routing stateTimer ?? 30 兜底） | 内部路由触发，不经过 Task |

**注意：**
- A（StrollTask）hardcode 30，B（GotoTask）用递减 remaining（从 60 开始），C/D 分别用 35/30
- 这些值都是 modeDirect 的 abandonAfter，但 A 固定 30 而 B 的默认是 60
- F 和 I 中 `mot.routeTarget` 无 abandonAfter 字段时，routing stateTimer 用默认 30

---

## 责任 7：回落默认值普查

所有 `?? ` 和 `|| ` 默认值及其合理性。

| 表达式 | 位置 | 默认值 | 何时触发 | 是否合理 |
|--------|------|--------|----------|----------|
| `npc.walkSpeed \|\| 26` | Motor.js:163, BSM:251, BSM:326, WalkMode:94, WalkMode:99 | 26 px/s | walkSpeed 未赋值（非 BM 托管 NPC）| **魔法数字重复 5 次**；应提取为常量 |
| `t.abandonAfter ?? 30` | BaseStateMachine.js:205 | 30 s | routeTarget 无显式 abandonAfter | 合理（routing 应快速超时）；与 modeDirect 60s 默认不一致 |
| `mode.abandonAfter ?? 60` | WalkMode.js:351 | 60 s | modeDirect 对象无显式 abandonAfter | 合理（直行可等久些）；与 routing 30s 默认不一致 |
| `modeDirect(t, cb, abandonAfter = 60, nextTarget = null)` | WalkMode.js:142 | 60 s | modeDirect 默认参数 | 与上一行一致 |
| `cfg.waitTime ?? 4000` | BusStop.js:25 | 4000 ms | 无 waitTime 配置 | 合理 |
| `cfg.maxWaiters ?? 8` | BusStop.js:33 | 8 | 无 maxWaiters 配置 | 合理 |
| `stop.maxWaiters ?? 8` | ExitSceneTask.js:36,51 | 8 | 运行时读取 | 与构造时默认值一致 ✓ |
| `ag.exitBias ?? 'edge'` | ExitSceneTask.js:28 | 'edge' | NPC 无 exitBias 分配（非 Director spawn 的 NPC）| 合理兜底 |
| `profile.desires ?? []` | Agenda.js:47 | `[]` | profile 无 desires 字段 | 安全 |
| `ag.lifespan ?? null` | BehaviorManager.js（条件检查） | null | 常驻 NPC | 正确区分流动/常驻 |
| `npc.stateTimer > (stateDur ?? Infinity)` | BaseStateMachine.js（隐式）| Infinity | stateDur 未设 | 防止非法超时转换 ✓ |
| `poseCache?.sub_event \|\| {}` | SocialLayer.js:43 | `{}` | headless 无 poseCache | 防御性兜底 ✓ |

**重点问题：`npc.walkSpeed || 26`**
出现在 5 个地方，均为"若未赋值用 26"。BM.register 已赋值 rand(20,34)，但 `||` 不会触发（赋值后始终 truthy）。对非 BM 托管的 NPC，5 处都各自独立写入 26。应提取为命名常量 `DEFAULT_WALK_SPEED = 26`。

---

## 责任 8：常数单一来源核查

| 常数 | 值 | 定义处 | 消费者数 | 状态 |
|------|-----|--------|----------|------|
| Y 分带常量（BUILDING_BASE_Y / BIKE_LANE_FAR_TOP / FAR_Y / NEAR_Y / BIKE_LANE_NEAR_BOTTOM / PARK_TOP） | 210/248/268/333/353/353+ | `js/core/Layout.js` | NavGrid.js, WalkMode.js, BSM.js, EnvironmentQuery.js, Director.js, tasks/ExitSceneTask.js | ✅ 单一来源，全部通过 import |
| `CELL = 10` | 10 px | `NavGrid.js#36`（exported） | NavGrid 内部、PathPlanner.js、Lookahead.js、EnvironmentQuery.js | ✅ 导出常量 |
| `NPC_HALF_W = 7` | 7 px | `NavGrid.js#39`（module-local） | 仅 NavGrid._markObstacle | ✅ 模块内一处；语义：Minkowski 扩展碰撞半宽 |
| `PATH_TUBE_R = 20` | 20 px | `NavGrid.js#40`（module-local） | 仅 NavGrid._bakeZones | ✅ 模块内一处 |
| `ROAD = 250` | 250 | `NavGrid.js#37`（exported） | NavGrid 内部、PathPlanner.js、EnvironmentQuery.js | ✅ 导出常量 |
| 默认步行速度 `26` | 26 px/s | **无命名常量** | Motor.js:163, BSM.js:251, BSM.js:326, WalkMode.js:94, WalkMode.js:99 | ❌ **5 处魔法数字** |
| 分离半径 `24` | 24 px（at scale 0.18） | `BehaviorManager.js#178,195` | BM._separate 内 2 处 | ⚠️ 同文件两处重复（mover-mover + mover-static）；可提取 |
| `ROAD cost 250` | 250 | NavGrid.js | Lookahead.js（隐式：仅检 cost===0，不检 ROAD）| ✅ Lookahead 正确不拦截 ROAD（允许过马路） |

---

## 附录 A：冲突清单

### A-1：abandonAfter 默认值不一致（同责任字段，不同默认值）

| 路径 | 默认值 | 位置 |
|------|--------|------|
| routing stateTimer timeout | **30 s** | BSM.js:205 `t.abandonAfter ?? 30` |
| modeDirect timeout | **60 s** | WalkMode.js:351 `mode.abandonAfter ?? 60` |
| StrollTask hardcode | **30 s** | StrollTask.js（modeDirect 第三参数） |
| GotoTask initial timeout | **60 s** | GotoTask.js#constructor（default timeout=60） |
| UseSmartPropTask GotoTask | **30 s** | UseSmartPropTask.js:50 |
| UseBenchTask GotoTask | **35 s** | UseBenchTask.js:50 |
| ExitSceneTask bus route | **30 s** | ExitSceneTask.js:48 |

**影响：** 在 routing 模式下 NPC 最长等 30s 后放弃；在 direct 模式下默认等 60s。StrollTask 自行 hardcode 30，比 modeDirect 默认值严格一倍。不一致但无直接 bug——各场景的设计意图不同；风险是未来修改时产生遗漏。

### A-2：Motor progress monitor 与 GotoTask watchdog 并发触发

对执行 GotoTask 的 NPC，两个卡死检测**同时运行**：
- Motor progress monitor（1.5s/15px）：约在 t=1.5s 触发，执行 direct 模式 _stuckOnce，设 `mode._elapsed = abandonAfter`
- GotoTask watchdog（2s/8px）：约在 t=2s 触发，执行自己的重规划逻辑

如果 Motor 的 _stuckOnce 在 t=1.5s 触发后 GotoTask 的 watchdog 在 t=2s 仍检测到静止（重规划后 0.5s 内未移动），则两者都执行重规划。实际发生两次重规划，第二次可能将 GotoTask 送入 'abort'。

**severity：** 低（正常流中罕见，NPC 通常在第一次重规划后移动）

### A-3：pickModeTarget `_sanitized` flag 状态泄漏

`WalkMode.js#pickModeTarget#direct 分支`：仅在第一次（`!mode._sanitized`）对 target 调用 `nearestWalkable`；之后 `_sanitized=true` 永不清零。

若 target 经过一次 sanitize 后仍在 ROAD 格内（nearestWalkable fallback 返回原坐标，见责任 3-G），则后续帧 `_sanitized=true` 跳过清理，NPC 以 ROAD 格为目标。

**severity：** 中（路由失败时 NPC 可能试图穿越马路）

---

## 附录 B：死代码/参数清单

### B-1：@deprecated compat re-exports（已验证无实现，仅转发）

| 位置 | 内容 | 原因标注 |
|------|------|----------|
| `WalkMode.js:37-38` | `export { setWalkMode, pushWalkMode, popWalkMode } from './Motor.js'` | 注释：第三刀迁移完成后删除 |
| `BaseStateMachine.js:62` | `export { setState, STATE_DEFS } from './Motor.js'` | 注释：第三刀迁移完成后删除 |

**grep 验证：**
```
grep -r "from.*WalkMode.*setWalkMode\|from.*WalkMode.*pushWalkMode\|from.*WalkMode.*popWalkMode" js/
```
无结果（外部已不消费这些 re-export）。

```
grep -r "from.*BaseStateMachine.*setState\|from.*BaseStateMachine.*STATE_DEFS" js/
```
无结果（外部消费者已直接从 Motor.js 导入）。

→ **可安全删除两处 re-export**（第三刀迁移完成后执行）。

### B-2：routeTarget.abandonAfter 冗余显式赋值

`ExitSceneTask.js:48`：`abandonAfter: 30` 显式赋值，与 BSM.js 的 `?? 30` fallback 值相同。删除不改变行为。

### B-3：StuckProbe 四个 `moved < 8` 条件

StuckProbe.js 中对四种场景（bus-wait, walk/run/jog/routing, activity, infinite stateDur）均用 `moved < 8` 作卡死判据，但 StuckProbe 只观察不恢复。这四个条件和 Motor progress monitor / GotoTask watchdog 的触发条件（15px, 8px）形成三套平行的"静止"判断，只是 StuckProbe 的不产生副作用。

→ **非死代码**（观察数据有用），但可合并为单一阈值常量。

---

## 附录 C：收敛方案

### C-1：abandonAfter 统一（责任 2、6）

**现状：** 6 个不同数值（30/60/35/30/30/30）散布在 5 个文件。  
**方案：** 在 `WalkMode.js` 顶部定义：
```js
export const DIRECT_TIMEOUT = 60;   // modeDirect 默认超时
export const ROUTE_TIMEOUT  = 30;   // routing 模式默认超时
```
- `modeDirect` 默认参数改用 `DIRECT_TIMEOUT`
- BSM routing timeout 改用 `ROUTE_TIMEOUT`
- StrollTask 硬编码 30 → 改为 `ROUTE_TIMEOUT`（语义：短途腿用路由超时标准）
- UseSmartPropTask / ExitSceneTask 的 30 → `ROUTE_TIMEOUT`
- UseBenchTask 的 35 → 保留显式值（设计意图不同，保持 35 更合理）

**净变化：** 删除 4 处魔法数字，保留 2 个命名常量 + 1 处有意 35。

### C-2：默认步行速度常量化（责任 7、8）

**现状：** `26` 出现 5 次（Motor.js:163, BSM:251, BSM:326, WalkMode:94, WalkMode:99）。  
**方案：** 在 `Motor.js` 顶部定义 `export const DEFAULT_WALK_SPEED = 26`，5 处替换。  
**净变化：** -5 魔法数字，+1 导出常量，+5 引用。

### C-3：删除 @deprecated compat re-exports（责任 6）

第三刀任务完成后：
- 删除 `WalkMode.js:37-38` 的 re-export（3 行）
- 删除 `BaseStateMachine.js:62` 的 re-export（2 行）

**净变化：** -5 行。

### C-4：合并 Motor / GotoTask 双重卡死检测（责任 2，可选）

**现状：** 两个机制并行，阈值相近但不同（1.5s/15px vs 2s/8px）。  
**方案（保守）：** 保留两者，但文档化"GotoTask watchdog 是 Motor progress monitor 的应用层补充，不是替代"。GotoTask watchdog 检查 GotoTask 自身路径规划有效性；Motor monitor 检查底层位移。两者职责不重叠，不需合并。  
**净变化：** 仅补注释，零代码变化。

### C-5：分离半径常量化（责任 8）

**现状：** `24` 出现在 BM._separate 两处（mover-mover, mover-static）。  
**方案：** 提取 `const SEP_RADIUS_BASE = 24` 局部常量（或模块常量）。  
**净变化：** -2 魔法数字，+1 常量 +2 引用。

### 汇总

| 方案 | 涉及文件 | 净删除行数 | 风险 |
|------|----------|----------|------|
| C-1 abandonAfter 统一 | WalkMode.js, BSM.js, StrollTask.js, UseSmartPropTask.js, ExitSceneTask.js | +2 常量, -4 魔法数字 | 低（仅常量化，无逻辑变化） |
| C-2 DEFAULT_WALK_SPEED | Motor.js, BSM.js (×2), WalkMode.js (×2) | +1 常量, -5 魔法数字 | 低 |
| C-3 删除 re-exports | WalkMode.js, BSM.js | -5 行 | 低（grep 证无消费者） |
| C-4 文档化双检测 | — | 0（注释）| 零 |
| C-5 SEP_RADIUS_BASE | BehaviorManager.js | +1 常量, -2 魔法数字 | 低 |

**合计净删除：** ~5 行代码 + 消除 11 处魔法数字，零行为变化。

---

*本文档为 snapshot，不原地更新。如需修订请新建日期版本。*
