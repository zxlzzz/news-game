> **status: snapshot** — 盘点截止 2026-07-18（V-H 竣工）；新增功能批次请同步更新本表。

# 功能路线图 — 落地状态一览

| 批次名 | 核心内容 | 状态 | 文档/代码锚点 |
|--------|----------|------|--------------|
| Batch-E（出口系统） | ExitRegistry、E1–E6 出口语义、headless-sim 僵尸检测 | ✅ 已落地 | `js/npc/ExitRegistry.js`；`scripts/headless-sim.mjs` |
| Batch-R（公交站） | busstop 实体、WaitForBusLayer、公交候车行为 | ✅ 已落地 | `js/entity/busstop/`（5个文件）；`js/entity/busstop/WaitForBusLayer.js` |
| Batch-M1（坐标常量重命名） | `SIDEWALK_NEAR_Y` 语义澄清（实为公园深处 y=508） | ⚠️ 部分落地 | `js/npc/Athletes.js:8` 注释说明；常量名未改，近端跑者已改走 `park_loop_jog` 路线 |
| Batch-M2（Lookahead 导航） | `Lookahead.js` goal-directed 速度计算、NavPath 规划 | ✅ 已落地 | `js/behavior/nav/Lookahead.js` |
| Batch-H（usedVel 字段） | `mot.usedVel` 标记机制（设计用途未知） | ❌ 无痕迹 | `grep "usedVel"` 无结果；可能停留在设计阶段未实施 |
| Batch-I（usedVel 消费） | 消费 `mot.usedVel` 的后续逻辑 | ❌ 无痕迹 | 同 Batch-H；上游未落地，本批次亦无痕迹 |
| 新闻管线 MVP | Viewfinder 截图、vision/text Provider、成稿面板 NewsUI | 🔲 设计定稿 | `docs/design-plans/news-pipeline-mvp.md`（finalized） |
| 速度统一·前置普查 | 全库消费者普查（34处）、movement-dataflow 契约 | ✅ 已落地 | `docs/design-plans/velocity-representation-survey.md`；`docs/contracts/movement-dataflow.md` |
| 速度统一 V-1 | integratePhysics 重写（D1）：删标量回退分支，steer 只写 `mot.vel`，Y 钳制迁移 | ✅ 已落地 | `docs/design-plans/velocity-unification-design-v1.md §2`；`js/behavior/Motor.js#integratePhysics` |
| 速度统一 V-1.5 | 生产端迁移：Athletes 远端 jogger → `modePathFollow('sidewalk_far_jog')`；DogWalker owner → `modeWander()` | ✅ 已落地 | `js/npc/Athletes.js`；`js/npc/DogWalker.js`；`assets/scene.json walkPaths.sidewalk_far_jog` |
| S-1（活动旁路修） | DogWalker owner activity bypass 修复（`sc.activity` 短路）；NavGrid 负坐标别名越界修复 | ✅ 已落地 | `js/npc/DogWalker.js`；`js/behavior/nav/NavGrid.js` |
| S-2（离场竞态根修） | 寿命触发加 `!sc.activity` 门（race 根修）；`departing_orphan` 审计计数器；`SpawnManager.js` 删除；lifespan 单一写入点（profile 驱动）；ExitSceneTask building 分支冗余 `findExit` 删除 | ✅ 已落地 | `js/behavior/BehaviorManager.js:118`；`js/debug/MovementAudit.js`；`js/npc/Pedestrians.js:87`；`js/behavior/Director.js`；`js/behavior/tasks/ExitSceneTask.js` |
| S-3（despawn 统一钩子 + 生成/离场坐标修正） | `despawnNpc` 单一写入点（leash 级联 / bench 防御）；edge spawn `snap:false` 跳过 NavGrid 吸附；出口坐标 ±200 → ±40；spawn 入口坐标 ±10 → ±30 | ✅ 已落地 | `js/npc/despawn.js`；`js/behavior/BaseStateMachine.js`；`js/entity/busstop/WaitForBusLayer.js`；`js/scenes/SceneInitializer.js`；`scripts/headless-sim.mjs` |
| S-4（Director 密度账目分离 + 超额加速离场） | `transientAlive`（lifespan != null）分账，常驻 NPC 不占 target；超额 `> target+2` 时快进 `ageTimer`，走 BM 全链路减员 | ✅ 已落地 | `js/behavior/Director.js#update`；`js/behavior/Director.js#_alight` |
| 速度统一 V-2 | 消费者迁移（D2/D3/D4）：`npc.vy/speed` 物理角色删除；StuckProbe gate 改 state 集；zone 门改读 `mot.vel?.vy`；`updateFacing` 单写入点（routing + wander 共用）；dead-code `!mode` 分支删除 | ✅ 已落地 | `js/behavior/BaseStateMachine.js`；`js/behavior/Motor.js`；`js/behavior/StuckProbe.js`；`js/debug/MovementAudit.js`；`docs/contracts/movement-dataflow.md` |
| T1/T2/T3（动画&朝向清理） | walk clip 水平质心归零（T1，shift=+18）；`updateFacing` 提取为 BaseStateMachine 函数（T2）；check-invariants Rule 4（walk-state clip `|meanX|≤4`）（T3） | ✅ 已落地 | `scripts/recenter-clips.py`；`assets/animations/cycle/walk.json`；`scripts/check-invariants.mjs` |
| F1–F4（足迹统一） | footprint 扩展 `shape/blocks/sortDY`（F1）；PropEntity 收敛 `this.footprint`，删 `collisionRX/RY`，`_sortY` 由 `sortDY` 派生（F2）；NavGrid 改读 `e.footprint`，`OBS_MARGIN=1` → `NPC_HALF_W=7`，shape 分发（F3）；check-invariants Rule 5/6（F4） | ✅ 已落地 | `js/core/PropEntity.js`；`js/behavior/nav/NavGrid.js`；`js/entity/*/`；`scripts/check-invariants.mjs` |
| 速度统一 V-3 | 清理（D6）+ 不变量：死字段 npc.vy 删除；死 API setSpeed 删除；seat.js typeof 守卫删除；check-invariants Rule 9/10/11 新增（no-direct-xy / no-direction-in-physics / no-npc-vy）。D5 内联路径 CONTRACT 由 N-3 取代，不再执行。 | ✅ 已落地 | `js/npc/Npc.js`；`js/behavior/Motor.js`；`js/behavior/BaseStateMachine.js`；`js/entity/seat/seat.js`；`scripts/check-invariants.mjs`（V3-a: `dcd6677`；V3-b: `011572f`；V3-c: `804b123`） |
| P-0（StuckProbe 补盲） | WAIT 分类新增（公交等待者单列，排除误入 MOVE 桶）；info 字段扩展 `wait/board/nb`；删除死字段 `spd` | ✅ 已落地 | `js/behavior/StuckProbe.js`（commit `d93605f`） |
| B-1（公交等待 Activity 化） | 新增 `WaitBusActivity.js`；删除 BM 平行调度旁路 `if(waitingBusStop) tickWaiter`；`WaitForBusLayer.tickWaiter/_releaseWaiter` 迁入 Activity；`ExitSceneTask` 公交分支加区域校验 + `pendingBusWait` 标记 | ✅ 已落地 | `js/behavior/activities/WaitBusActivity.js`；`js/entity/busstop/WaitForBusLayer.js`；`js/behavior/BehaviorManager.js`；`js/behavior/tasks/ExitSceneTask.js` |
| Scene-1（场景数据归一化） | 新增 `propDefaults.js`（类型级默认）、`sceneData.js`（`expandSceneData()` 纯函数）、`buildingKinds.js`（KIND_TAGS）；`scene.json` 压缩（`at[]` 分组、buildings kind 字段、trees 紧凑数组）；`StreetScene.js` 调用 expandSceneData | ✅ 已落地 | `js/core/propDefaults.js`；`js/core/sceneData.js`；`js/entity/building/buildingKinds.js`；`assets/scene.json` |
| N-0（目标管线立法 + P-0 StuckProbe 扩展） | `goal-pipeline-v1.md` 四层架构（Intent/Planning/Steering/Physics）+ 三铁律；check-invariants Rule 7（warning）+ 12 文件白名单；StuckProbe observer 字段扩展（`_rayBlocked` 纯观测）；check-invariants.sh → .mjs 文档引用统一 | ✅ 已落地 | `docs/design-plans/goal-pipeline-v1.md`；`js/behavior/StuckProbe.js`；`scripts/check-invariants.mjs Rule7`（commit `10ad85f`） |
| N-1（归表） | ARRIVAL_RULES（`SteeringDecision.js`）、RECOVERY_RULES / SAFETY_RULES（`Motor.js`）三张裁决表立起；`arrived(ruleId, dist)` 调用模式；Lookahead 参数注入（删内联 fallback）；`check-invariants.sh` 删除 | ✅ 已落地 | `js/behavior/SteeringDecision.js`；`js/behavior/Motor.js`；`scripts/check-invariants.mjs`（commit `3cd1f99`） |
| N-2a（规划层） | `PLANNING_RULES`（`PathPlanner.js`）；`_bakeCrosswalks` 斑马线烘焙进 NavGrid；A* 有效代价准入（ROAD 格可用）；check-invariants Rule 8（crosswalk/jaywalk/roadCost 数值定义唯一住址） | ✅ 已落地 | `js/behavior/nav/PathPlanner.js`；`js/behavior/nav/NavGrid.js`（commit `97c1e44`） |
| N-2b（Goal 通道） | `PlanService.js` 成为 `mot.path` 唯一写入方；`mot.goal` 结构体（x/y/radius/meta）；jaywalk 空间派生（不再 walkModeStack）；zone 弹回无状态化；`modeDirect` / `planCrossing` / `walkModeStack` 删除 | ✅ 已落地 | `js/behavior/nav/PlanService.js`；`js/behavior/tasks/GotoTask.js`；`docs/design-plans/goal-pipeline-v1.md r2.3`（commit `0dcf420`） |
| J1（跑者/Agenda 集成修复） | J1-a: StrollTask `STROLL_BLOCKED_LIMIT=2` 有限重发回落（plan 必败不再死循环）；J1-b: Athletes 跑者显式 bounds + `makeNPC` 出生点守卫；J1-c: ATHLETE profile `agenda:false`，BM.register 跳过 Agenda 实例化 | ✅ 已落地 | `js/behavior/tasks/StrollTask.js`；`js/npc/Athletes.js`；`js/npc/npcUtil.js`；`js/npc/NpcProfile.js#ATHLETE`（commits `3476eb3`–`4897677`） |
| P-1（vx 振荡探针） | Motor `integratePhysics` 追踪 vx 符号翻转（`mot._obsFlipVx/_obsVxSign`，纯只读观测）；StuckProbe MOVE 明细新增 `flips` 字段（读取即归零） | ✅ 已落地 | `js/behavior/Motor.js#integratePhysics`；`js/behavior/StuckProbe.js`（commit `28eb558`） |
| N-3（骑手集成 + 路由链删除 + 不变量加固） | CYCLIST profile + `ride` STATE_DEFS + BM._separate 豁免；CyclistSpawner 接入 BM；Npc.js 内联移动分支删除；StuckProbe `_rayBlocked/isDirect/nextTarget` + SteeringDecision `corner_cut` 删除；check-invariants Rule 7 升级为 error | ✅ 已落地 | `js/npc/NpcProfile.js`；`js/behavior/Motor.js#STATE_DEFS`；`js/behavior/BaseStateMachine.js#_tickState`；`js/entity/vehicle/CyclistSpawner.js`；`js/behavior/StuckProbe.js`；`js/behavior/SteeringDecision.js`；`scripts/check-invariants.mjs Rule7` |
| V-H（车辆绘制锚点硬编码去除） | drawBicycle/drawEbike/_moto 全部脱离 getAnchor/getFrame 骑手骨架锚点；改为 FK 推导常量 × scale × direction；drawEbike 删除 `*1.2` 因子折入常量；新增 derive-vehicle-anchors.mjs 推导脚本 | ✅ 已落地 | `js/entity/vehicle/drawBicycle.js`；`js/entity/vehicle/drawVehicle.js#_moto`；`scripts/derive-vehicle-anchors.mjs` |
| 挂饰 attachment schema | NPC 可拾取/佩戴道具的声明式 schema | 🔲 定稿未落盘，待从历史找回 | — |
| V-final（速度统一线收尾核账） | 五处已知修正（Rule 10 正则收紧、Rule 9 结构修、哈希订正、Npc.js 缩进、speed 读者描述）；A–H 八段核账；封存报告 | ✅ 已落地 | `docs/audits/velocity-unification-closing-2026-07.md` |
| G-1（publishGoal 完备化 + 无驱动安全网） | 铁律 ④（goal-pipeline r2.6）；ExitSceneTask 公交分支降级边缘出口；SceneInitializer 摊主有限重发→setXY 就位；WaitForBusLayer 车门 timeout→modeWander；`_resolveTimeout` 收紧（departing && goal）；TRANSITIONS 'no-drive' priority 8 安全网（walk/run 无驱动 2s→stand）；StuckProbe STATE: 排除带 goal 行走 | ✅ 已落地 | `js/behavior/BaseStateMachine.js`；`js/behavior/tasks/ExitSceneTask.js`；`js/scenes/SceneInitializer.js`；`js/entity/busstop/WaitForBusLayer.js`；`js/behavior/StuckProbe.js`；`js/debug/MovementAudit.js` |
| 资产渲染一致性（A/B/C） | A：编辑器地面线改用 skeleton groundY（删硬编码 CY+82）；B：StickRenderer 头半径改读 skeleton.json（人 10→16，狗 7→8）；C：车辆绘制锚点改用 assets/vehicle-anchors.js（FK 生成，check-invariants Rule 12） | ✅ 已落地 | `sth/stick-puppet/js/app.js`；`js/core/StickRenderer.js`；`js/entity/vehicle/drawBicycle.js`；`js/entity/vehicle/drawVehicle.js`；`assets/vehicle-anchors.js`；`scripts/derive-vehicle-anchors.mjs` |

---

## 历史批次盘点（静态 grep 核实，2026-07-14）

### Batch-R（公交站系统）— 已落地

代码锚点：`js/entity/busstop/` 目录存在以下文件：
- `busstop.js`、`WaitForBusLayer.js`、`drawBusStopBay.js`、`drawBusStopRoof.js`、`drawBusStopSign.js`

`WaitForBusLayer.js` 在 `js/behavior/BehaviorManager.js` 中被引用（`import … WaitForBusLayer`）。

### Batch-M1（坐标常量语义）— 部分落地

`SIDEWALK_NEAR_Y` 常量存在于 `js/core/Layout.js:28`（值 = 508，位于公园深处）。

`js/npc/Athletes.js:8` 有注释：
> `⚠️ SIDEWALK_NEAR_Y = 508，实为公园深处，非近侧人行道；近端跑者改走 park_loop_jog，不再用此值做 bounds。`

常量名未改（破坏性变更暂缓），但 Athletes.js 已改用 `modePathFollow('park_loop_jog')` 替代。

### Batch-M2（Lookahead 导航）— 已落地

`js/behavior/nav/Lookahead.js` 文件存在。`steerRoam` walk 分支通过 `applyLookahead()` 计算 `{vx, vy}`，写入 `mot.vel` 和 `npc.vy`（见 `movement-dataflow.md §1 step 9`）。

### Batch-H / Batch-I（usedVel）— 无痕迹

`grep -rn "usedVel" js/` 无结果。该字段可能停留在设计草案阶段，从未实施；或已被后续方案（`mot.vel` 的 same-frame 消费语义）替代。如需重拾，须重新定义语义并对齐 `movement-dataflow.md`。

---

### 速度统一 V-2 — 已落地

核心变更（commit `c037a59`、`fbb455f`）：

- `npc.vy` 在路由/暂停分支的写入全部删除；`checkZoneTransition#goingDown` 改读 `mot.vel?.vy`（WalkMode.js）
- `npc.speed = 0` 在路由入口 / path_follow 暂停分支全部删除（`setSpeed` import 已移除）
- `StuckProbe.js` 触发条件改为 `state ∈ {walk,run,jog,routing}` 集合判断，不再依赖 `npc.speed > 0`
- `MovementAudit.js` 计数器 `speed0_walk` 重命名为 `vel0_walk`（语义已失效，保留观察期）
- `dir_mismatch` 审计去掉 `npc.speed > 0` 前置门（speed 恒 0，原门屏蔽了全部计数）
- `updateFacing(npc, vx, spd, dt)` 提取为 `BaseStateMachine.js` 顶层函数；routing 分支 + wander 分支共用同一写入点（`dirCD` 0.45 s 迟滞、`|vx|>spd×0.35` 阈值）
- Motor.js 中 `!mode` 死代码分支删除（逻辑证明：`hasGoal && !routing` 时 `wm` 必为真，`!mode` 不可达）

代码锚点：`js/behavior/BaseStateMachine.js#updateFacing`；`js/behavior/StuckProbe.js:27`；`docs/contracts/movement-dataflow.md §1 step 8-9`

---

### T1/T2/T3（动画&朝向清理）— 已落地

- **T1** — `scripts/recenter-clips.py` 生成，对 `walk.json` 全帧全关节 x delta 均匀加 +18，水平质心 −18.26 → −0.26。variant_of=walk 的 `walk_older` 自动跟随归零。
- **T2** — `BaseStateMachine.js#steerRoam` routing 分支原内联朝向更新删除，改调 `updateFacing`（同 V-2 提取函数），彻底消除朝向双写入点。
- **T3** — `scripts/check-invariants.mjs` Rule 4 新增：STATE_DEFS 中 `speedK>0` 的 walk-state clip（walk/run/jog）须 `|meanX|≤4`（当前：−0.26 / 2.79 / −0.68，全绿）。

代码锚点：`scripts/recenter-clips.py`；`assets/animations/cycle/walk.json`；`scripts/check-invariants.mjs:87`

---

### F1–F4（足迹统一）— 已落地

核心变更（commit `897ae47`）：

- **F1** — 全库 12 个障碍物 `footprint(e)` 返回值扩展为 `{shape, rx, ry, blocks, sortDY}`：fountain → `shape:'ellipse'`；tree → `sortDY:-e.height*0.35`；其余均 `shape:'rect', sortDY:0`。新增 `js/entity/sign/sign.js`（`blocks:false, sortDY:9`）。`'slide'` 从 `OBSTACLE_TYPES` 删除（全库无生成点）。
- **F2** — `PropEntity` 构造函数：`this.footprint = this._computeFootprint()`（重命名自 `_footprint`）；删 `collisionRX/RY/collisionRadius`；`_sortY` 由 `fp.sortDY` 派生（替代 stall/tree 硬编码）；default 分支对 obstacle 类型抛异常（每个 obstacle propType 必须有显式声明）。`SceneInitializer.js` 删除 sign 的 `cfg._sortY` 配置（改由 `sign.js#footprint.sortDY:9` 承载）。
- **F3** — `NavGrid._markObstacle` 改读 `e.footprint.rx/ry`；`OBS_MARGIN=1` 重命名为 `NPC_HALF_W=7`（Minkowski 扩展 = NPC 碰撞半宽）；`isFountain` 特判改为 `e.footprint.shape === 'ellipse'` 分发。
- **F4** — `check-invariants.mjs` Rule 5：OBSTACLE_TYPES 每个类型的 footprint 函数含 `shape` + `blocks`。Rule 6：`_sortY=` 仅出现于 `PropEntity.js`、`seat.js`、`Chess.js`。全 6 规则通过。

代码锚点：`js/core/PropEntity.js#_computeFootprint`；`js/behavior/nav/NavGrid.js:39 NPC_HALF_W`；`scripts/check-invariants.mjs:125`

---

### S-2（离场竞态根修）— 已落地

核心变更（commit `bf0532b`、`d6a05f5`）：

- **C1 竞态根修**：`BehaviorManager.js:118` 寿命触发加 `!sc.activity` 门。
  原路径：`ag.ageTimer >= ag.lifespan` 在 Activity 期间触发 → `triggerDeparture` 写 `state=routing`
  → BSM 被 `if (sc.activity) continue` 跳过 → routing 永远不推进 → Activity 结束后
  `destroy()` 写 `setState(walk)` → `ag.departing=true` 但无 routeTarget（孤儿态）。
  新路径：ageTimer 照常累计；当且仅当 `!sc.activity` 时触发，Activity 结束后下一帧
  自动离场，按构造消除孤儿态。
- **C1 审计**：`MovementAudit.js` 新增 `departing_orphan` 计数器：`departing=true` 且
  `state!=='routing'` 且非 `pendingDeparture` 且非 `waitingBusStop` → 每秒计入；
  `dump()` / `rows()` 同步输出，观察期内应恒零。
- **C2 SpawnManager 删除**：`js/npc/SpawnManager.js` 全库零 import，已由 Director 完全替代，
  删除；`Pedestrians.js` 注释更新；`VehicleSpawner.js` 移除 SpawnManager 引用。
- **C2 lifespan 单一写入点**：`Pedestrians.js:87` 改读 `profile.departure.lifespanRange`；
  `Director.js` 删 `ag.lifespan = rand(90,200)` override；lifespan 现在唯一来源为 NpcProfile。
- **C2 ExitSceneTask 简化**：building 分支冗余 `findExit` 预检删除；
  `ExitRegistry.findExit(preferType='building')` 已在无匹配时自动回落全候选集，
  `triggerDeparture` 本身处理 no-exit → `ag.lifespan+=30` 兜底。

代码锚点：`js/behavior/BehaviorManager.js:118`；`js/debug/MovementAudit.js#tick`；`js/behavior/tasks/ExitSceneTask.js#_driveExit`

---

### S-3（despawn 统一钩子 + 生成/离场坐标修正）— 已落地

核心变更（commit `bd726af`、`5f1e1c6`）：

- **C1 despawnNpc 统一入口**：新增 `js/npc/despawn.js`，`despawnNpc(npc, reason, ctx)` 成为所有行人 NPC `alive=false` 的单一写入点。
  资源普查（C1.1）：
  - **leash** — `ctx.entities` 扫描，owner 死亡时 `e.leashTarget===owner` 的实体（dog）级联 `alive=false`
  - **modifier** — `NpcPropManager.getDrawables()` 已过滤 `!prop.npc.alive`；`_props` Map 条目保留（接受）
  - **slot** — `SocialLayer.update()` 下帧自动清理死亡 NPC 槽位，无需 despawnNpc 干预
  - **bench** — `sit_bench.onExit→standUp` 正常路径先释放；`despawnNpc` 内 defensive `standUp` 兜底非标准路径
  - **bus queue** — `_startBoarding.onArrive` 自清 `stop._boardingQueue`；lifespan 触发由 `!sc.waitingBusStop` 门控
- **C1 BaseStateMachine**：`triggerDeparture(npc, registry, ctx={})` + `_routeToExit(npc, exit, ctx={})` 添加 ctx 参数；`onArrive` 改用 `despawnNpc('exit-arrive', ctx)`；`pendingDeparture` 路径同步保存 `ag.pendingDepartureCtx`，`tickBaseState` 消费。
- **C1 WaitForBusLayer**：`constructor(busStops, entities)` 新增 entities 参数；`_startBoarding.onArrive` 改用 `despawnNpc('boarding-arrive', {entities})`。
- **C1 BehaviorManager / SceneInitializer**：调用点传 `{entities: em.entities}`。
- **C2 edge spawn snap**：`spawnOnePedestrian opts.snap !== false` 控制 `nearestWalkable`（默认 true）；`Director._spawnNPC` 传 `snap: fromDoor`（边缘入口 snap=false）。bounds 论据：`_slideMove` 仅对"已在 minX 内侧→外侧"位移钳制（`npc.x >= npc.minX` 前置门），x=−30/minX=0 时条件为 false，NPC 从外侧自由向内行走。
- **C3 出口/入口坐标**：边缘出口 ±200 → ±40（`SceneInitializer.js`、`headless-sim.mjs` 同提交）；边缘 spawn 入口点 ±10 → ±30。

代码锚点：`js/npc/despawn.js`；`js/behavior/BaseStateMachine.js#triggerDeparture`；`js/entity/busstop/WaitForBusLayer.js#_startBoarding`；`js/scenes/SceneInitializer.js:105`

---

### S-4（Director 密度账目分离 + 超额加速离场）— 已落地

核心变更（commit `9f8a791`）：

- **C1 分账**：`Director.update` 与 `_alight` 的存活计数改为 `transientAlive`
  （`n.alive && !ag.departing && ag.lifespan != null`）。常驻 NPC 无 `departure`
  字段 → `Pedestrians.js:87` 赋 `lifespan = null` → 不占 target 配额。
  回落过目（引用 S1 C2.4 清单）：有 `departure.lifespanRange` →
  `lifespan != null`：pedestrian / businessman / tourist；无 departure →
  `lifespan = null`：chess_player / chess_onlooker / stall_seller / dog_owner /
  athlete。无例外。

- **C2 超额加速**：`transientAlive > target + 2` 时，按 `ageTimer/lifespan`
  降序选最多 2 个候选，执行 `ag.ageTimer = ag.lifespan`。BM 寿命检查在下一帧
  触发 `triggerDeparture → ExitSceneTask` 全链路，Director 不直调任何离场函数。
  选人排除条件（`ag.departing / sc.activity / sc.waitingBusStop`）与 BM 门控完全对应：
  Director 排除 → BM 门也排除 → 快进后必触发，无绕门路径。+2 滞回带防止补员/减员边界抖振。

代码锚点：`js/behavior/Director.js#update`；`js/behavior/Director.js#_alight`

---

### N-3（骑手集成 + 路由链删除 + 不变量加固）— 已落地

核心变更（commits on `claude/velocity-unification-v1-946h9l`）：

- **N3-c CYCLIST profile + ride 状态**：`NpcProfile.js` 新增 `CYCLIST`（`agenda:false, separate:false, initial:'ride'`）；Motor STATE_DEFS 新增 `ride` 行（`anim:'bike', speedK:1.0`）；`BaseStateMachine._tickState` 新增 ride 分支——每帧直写 `mot.vel = {vx: direction×speed, vy:0}`，绕开 steerRoam。
  - `CyclistSpawner` 接入 BM：构造函数接受 `bm` 参数，`_spawn` 内调 `bm.register(n,'cyclist')` + `setAnimation(n, kind==='ebike'?'mobile':'bike')`。
  - `BehaviorManager._separate` 过滤加 `&& n.mem('agenda').profile?.separate !== false` 门——骑手不参与分离物理。
  - `vehicleSpawner.initVehicleSystem(em, sr, bm)` + `SceneInitializer` 传 `bm` 参数。
  - `Npc.js` 删除 L297–309 内联移动分支（`else if (!this.leashTarget)`），替换为仅当 `_motorInstalled` 时调 `integratePhysics`。

- **N3-c Rule 4 豁免**：`check-invariants.mjs` 新增 `RULE4_EXEMPT = new Set(['bike','mobile'])`——motor-vel 驱动的骑手 clip meanX 大是设计意图，不是漂移 bug。

- **N3-d 路由遗迹删除**：`StuckProbe.js` 删除 `_rayBlocked` 函数、`isDirect` 变量、nextTarget 分支；`SteeringDecision.js` 删除 ARRIVAL_RULES 中 `corner_cut` 行。

- **N3-e Rule 7 升级**：check-invariants Rule 7（距离/时间累积器白名单）从黄色 warn 升级为 red fail；`BaseStateMachine.js` 白名单注释更新为 "permanent"（非临时例外）。

- **movement-dataflow.md 同步**：新增 step 8b（ride 分支写 vel）；step 12 注释（separate:false 豁免）；step 13 注释（Npc.js 内联删除确认）。

代码锚点：`js/npc/NpcProfile.js#CYCLIST`；`js/behavior/Motor.js#STATE_DEFS:ride`；`js/behavior/BaseStateMachine.js#_tickState`；`js/entity/vehicle/CyclistSpawner.js#_spawn`；`js/behavior/BehaviorManager.js#_separate`；`scripts/check-invariants.mjs RULE4_EXEMPT`

---

### V-H（车辆绘制锚点硬编码去除）— 已落地

核心变更（commit `7865e9c`）：

- **drawBicycle（自行车）**：删除 `forwardHand()` 辅助函数（逐帧 getAnchor 选手动态选取）。改用 bike clip frame-0 FK 常量：hip `jx=0 jy=-82`；把手 r_hand `jx=65 jy=-66`（所有 16 帧均靠前，无需动态判断）；曲柄中心取全帧平均 `jx≈28 jy≈-37`。保留 `getAnchor('foot_l')` + `getAnchor('foot_r')` ——踏板接触点随动画旋转，不可硬编码。

- **drawEbike（电动车）**：删除全部 `getAnchor` 调用；删除 `s = n.scale * 1.2`，将 1.2 折入各维度常量（视觉完全不变）：`wR 14.4→17.28`，`rwx 偏移 19.2→23.04`，`fwx 偏移 4.8→5.76`，`platY 偏移 2.4→2.88`，`boxW 14.4→17.28`，`boxH 13.2→15.84`，`boxCx 偏移 21.6→25.92`。FK 来源：mobile clip，hip `jx=-9 jy=-59`，l_hand `jx=32 jy=-81`。

- **_moto（摩托）**：删除 `vehicle._sr?.getFrame('mobike', 0)` 实时查帧；删除 `W(joint, fallback)` 骨架名查找模式；改为纯 FK 辅助 `W(jx, jy) => {x: x+d*jx*rs, y: groundY+jy*rs}`。常量来自 mobike frame-0：hip `[0,-82]`，l_hand `[50,-76]`，r_hand `[47,-75]`，r_foot `[-28,-42]`，l_foot `[-37,-46]`（原 fallback 值已正确，live lookup 为死权重）。

- **derive-vehicle-anchors.mjs**（D-1 同批）：`scripts/derive-vehicle-anchors.mjs` 读取 `skeleton.json` + manifest + 三个骑乘 clip，输出 frame-0 FK 常量、全帧平均曲柄中心、ebike 折 1.2 后的最终常量，为以上常量提供可复现依据。

验收：`getAnchor` 在 drawEbike / `_moto` = 0；drawBicycle 中恰好 `foot_l` + `foot_r`；drawEbike 无 `*1.2` 运算；`js/behavior/` + `js/npc/` 未改动；check-invariants 全 8 条通过。

代码锚点：`js/entity/vehicle/drawBicycle.js`；`js/entity/vehicle/drawVehicle.js#_moto`；`scripts/derive-vehicle-anchors.mjs`

---

### P-0（StuckProbe 补盲）— 已落地

核心变更（commit `d93605f`）：

- WAIT 分类新增：`sc.waitingBusStop && moved<8` → `cat=WAIT:{state}`，在 MOVE 判断前求值，公交等待者不再误入 MOVE 桶。
- info 字段扩展：删 `spd`（V-2 后 `npc.speed` 为死字段）；新增 `wait`（候车态）、`board`（上车态）、`nb`（30px 内邻居数）。
- 审计豁免：WAIT 类不计入 stuck 计数器，与 ACT 类对称。

代码锚点：`js/behavior/StuckProbe.js:29`

---

### B-1（公交等待 Activity 化）— 已落地

核心变更（commit `21937da`）：

- **新增** `js/behavior/activities/WaitBusActivity.js`：单 NPC Activity，管理 stand/loiter 交替等待、`waitTimer` 超时自退、boarding 路径；`_destroyed` 守卫确保 `destroy()` 幂等。
- **WaitForBusLayer**：删除 `tickWaiter`/`_releaseWaiter`（逻辑全量迁入 Activity）；`_addWaiter` 改为实例化 WaitBusActivity push 进 `socialLayer.activities`；新增 `isInWaitZone` / `waitZoneTarget` 供 ExitSceneTask 路由判断；`_startBoarding` 新增 `ag.departing=true` 防寿命重触发。
- **BehaviorManager**：删除 `if (sc.waitingBusStop && state!=='routing') { tickWaiter; continue }` 旁路块；寿命条件 `!sc.waitingBusStop` 移除（由 `!sc.activity` 门覆盖，语义等价）。
- **ExitSceneTask**：公交分支加区域校验——已在等候区直接入队，否则路由到 `waitZoneTarget`；新增 `ag.pendingBusWait` 标记阻止路由中 tick abort。

代码锚点：`js/behavior/activities/WaitBusActivity.js`；`js/entity/busstop/WaitForBusLayer.js`；`js/behavior/BehaviorManager.js`；`js/behavior/tasks/ExitSceneTask.js`

---

### Scene-1（场景数据归一化）— 已落地

核心变更（commit `1b6f6a2`）：

- **新增** `js/core/propDefaults.js`：道具类型级 `{tags, smartDef, w, h, facing}` 权威表，消除 scene.json 逐实例重复字段。
- **新增** `js/core/sceneData.js`：`expandSceneData()` 纯函数（无 PIXI 依赖），将紧凑 scene.json 展开为 SceneInitializer 已期望的格式。
- **新增** `js/entity/building/buildingKinds.js`：`KIND_TAGS` 映射表，sceneData + BuildingEntity 共用单一定义。
- **scene.json**：buildings 改用 `kind` 字段；props 按类型分组 + `at[]` 数组；trees 紧凑数组；busStops 删除几何常量；routes 删除（已无消费者）。
- **SceneInitializer.js**：`create()` 调用 `expandSceneData`；自身零业务变更。

代码锚点：`js/core/propDefaults.js`；`js/core/sceneData.js`；`js/entity/building/buildingKinds.js`；`assets/scene.json`

---

### N-0（目标管线立法）— 已落地

核心变更（commit `10ad85f`）：

- **goal-pipeline-v1.md** 立法：四层架构（Intent / Planning / Steering / Physics）+ 三铁律（层切割 / 规则共居 / 阈值唯一住址）；决策文件清单；N-1/N-2/N-3 刀序；三数验证表（5/15/22 跨层引用归零目标）。
- **check-invariants.mjs Rule 7**（warning-only）：标记 `js/behavior/**` 内距离比较和时间累积器，仅白名单 12 文件例外；零意外违规确认后升 error（见 N3-e）。
- **StuckProbe observer 扩展**：`_rayBlocked()` 纯只读辅助；MOVE:*/direct 明细增 `distToGoal/hasNextTarget/raycastBlocked` 字段；无任何 NPC 状态写入。
- **文档引用统一**：`check-invariants.sh` → `check-invariants.mjs` 全库替换（CLAUDE.md、behavior.md、known-violations.md、velocity-unification-design-v1.md）。

代码锚点：`docs/design-plans/goal-pipeline-v1.md`；`js/behavior/StuckProbe.js`；`scripts/check-invariants.mjs`

---

### N-1（归表）— 已落地

核心变更（commit `3cd1f99` + `a0bc2fb`）：

- **ARRIVAL_RULES**（`SteeringDecision.js`）：到达阈值裁决表，`arrived(ruleId, dist)` 调用替代内联数值比较。
- **RECOVERY_RULES**（`Motor.js`）：卡死恢复策略参数唯一住址。
- **SAFETY_RULES**（`Motor.js`）：物理层安全网参数表；`lookahead` 条目注入 `applyLookahead`，删除 Lookahead.js 内联 fallback（`params = null` 默认移除）。
- **check-invariants.sh 删除**（`a0bc2fb`）：全部 gate 已迁入 `.mjs`，shell 版本无人使用。

代码锚点：`js/behavior/SteeringDecision.js#ARRIVAL_RULES`；`js/behavior/Motor.js#RECOVERY_RULES,SAFETY_RULES`；`js/behavior/nav/Lookahead.js#applyLookahead`

---

### N-2a（规划层）— 已落地

核心变更（commit `97c1e44`）：

- **PLANNING_RULES**（`PathPlanner.js`）：`crosswalkCost / jaywalkRoadCost / roadCostDefault` 数值定义唯一住址。
- **`_bakeCrosswalks`**（`NavGrid.js`）：斑马线单元格烘焙进网格（低代价通道），A* 无需运行时查询斑马线位置。
- **ROAD 格代价准入**：A* 允许 road 区格参与规划（以 `roadCostDefault` 代价），跨马路路径可行。
- **check-invariants Rule 8**：crosswalk/jaywalk/road cost 数值定义只允许出现在 PathPlanner.js。

代码锚点：`js/behavior/nav/PathPlanner.js#PLANNING_RULES`；`js/behavior/nav/NavGrid.js#_bakeCrosswalks`；`scripts/check-invariants.mjs Rule8`

---

### N-2b（Goal 通道）— 已落地

核心变更（commit `0dcf420`）：

- **PlanService.js**：成为 `mot.path` 唯一写入方；接收 `mot.goal {x,y,radius,meta}` 结构体，统一触发 A* 规划 + `mot.path` 写入。
- **mot.goal 结构体**：`GotoTask` / `StrollTask` 等 Task 层统一改为发布 `mot.goal`，不再直接写 path；Task 退化为"发 Goal 收 result"模式。
- **jaywalk 空间派生**：过马路目的地坐标由 PlanService 在规划时派生，不再由 Task 预计算。
- **`modeDirect` / `planCrossing` / `walkModeStack` 删除**：三个旧通道全部删除，Goal 通道成为唯一路径规划入口。
- **zone 弹回无状态化**：弹回逻辑不再维护 walkMode 栈，由 PlanService 重规划替代。

代码锚点：`js/behavior/nav/PlanService.js`；`js/behavior/tasks/GotoTask.js`；`docs/design-plans/goal-pipeline-v1.md r2.3`

---

### J1（跑者/Agenda 集成修复）— 已落地

核心变更（commits `3476eb3`、`970a663`、`4897677`）：

- **J1-a**：`StrollTask` 新增 `STROLL_BLOCKED_LIMIT=2`——连续 blocked 达上限退化 `modeWander`，任务继续 tick 至 duration；修复 plan 必败场景（出生点超 bounds）的 NPC 永冻。
- **J1-b**：`Athletes.js` 两个跑者显式传 `minX/maxX/minY/maxY`（近端跑者含 y=508 出生点）；`npcUtil.makeNPC` 末尾加出生点守卫——仅当明确提供四边界且出生点在世界范围内时 assert，超范围抛出含 tags 的 Error。
- **J1-c**：`NpcProfile ATHLETE` 加 `agenda: false`；`BehaviorManager.register` 对 `profile.agenda===false` 跳过 Agenda 实例化——阻止 Agenda 推 StrollTask 干扰跑者环线。

代码锚点：`js/behavior/tasks/StrollTask.js#STROLL_BLOCKED_LIMIT`；`js/npc/Athletes.js`；`js/npc/npcUtil.js#makeNPC`；`js/npc/NpcProfile.js#ATHLETE`

---

### P-1（vx 振荡探针）— 已落地

核心变更（commit `28eb558`）：

- **Motor.js `integratePhysics`**：消费 `mot.vel` 时追踪 `mot._obsVxSign`（当前 vx 符号），翻转则 `mot._obsFlipVx++`；纯只读观测，不影响任何速度计算。
- **StuckProbe.js**：MOVE 类明细 `info` 新增 `flips: mot._obsFlipVx`（探针窗口 2s 累计），读取后归零；用于调查 id:50 类 NPC 振荡现象的证据收集。

代码锚点：`js/behavior/Motor.js#integratePhysics`；`js/behavior/StuckProbe.js#info`
