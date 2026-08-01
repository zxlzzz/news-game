> **status: snapshot** — 盘点截止 2026-07-22；新增功能批次请同步更新本表。

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
| N-2a（规划层） | `PLANNING_RULES`（`PathPlanner.js`）；`_bakeCrosswalks` 斑马线烘焙进 NavGrid；A* 有效代价准入（ROAD 格可用）；check-invariants Rule 8（crosswalk/jaywalk/roadCost 数值定义唯一住址） | ✅ 已落地（**Z-1 已取代**） | `js/behavior/nav/PathPlanner.js`；`js/behavior/nav/NavGrid.js`（commit `97c1e44`） |
| Z-1（zone-profile split） | NavGrid 从 cost map 重构为 zone map + profile cost table：`ZONE` 枚举 + `DEFAULT_ZONE_COSTS`；`cost()`→`zone()`；`ROAD=250` 哨兵值 / `PLANNING_RULES` / `roadCost` / `planningRules` / `_bakeCrosswalks` 全部删除；斑马线直接烘焙为 `ZONE.CROSSWALK`；代价装配唯一住址 `PlanService._zoneCostsFor()`；`_lineOfSight` 改为纯 zone 检查 | ✅ 已落地 | `js/behavior/nav/NavGrid.js`；`js/behavior/nav/PathPlanner.js`；`js/behavior/nav/PlanService.js`；`js/npc/NpcProfile.js` |
| Z-2a（Layout 参数化） | Layout.js 世界尺寸 / Y 分带 / 深度锚点 `export const` → `export let` + `initLayout(config)`；scene.json 新增 `world` / `depth` / `yBands` 三顶层字段（数值不变，原地搬家）；sceneData 透传；StreetScene.create() 注入。借 live binding，66 个 import 站点零改动 | ✅ 已落地 | `js/core/Layout.js`；`assets/scene.json`；`js/core/sceneData.js`；`js/scenes/StreetScene.js` |
| Z-2b（NavGrid zone bake 数据驱动） | `_zoneDefault(wy)` 删除；`zones` 配置（bands / overlays / paving / crossings）驱动全部 zone 烘焙；`PATH_TUBE_R` / `CROSSWALK_HALF_W` 移入配置；`bake()` 第 3 参收 zones，缺配置抛错；`Layout.resolveY` 符号解析（配置写分带名，数值仍只在 yBands） | ✅ 已落地 | `js/behavior/nav/NavGrid.js`；`assets/scene.json`；`js/core/Layout.js#resolveY` |
| Z-2e（Feature registry + SceneInitializer 声明化） | 目标：一个 JSON 文件独立构建一个场景。`SceneInitializer` 分层：infra（NavGrid/BehaviorManager/ExitRegistry/Director）留代码，可选内容（9 个 feature：pedestrians/park_idlers/chess/stall_sellers/dog_walker/athletes/vehicles/bus_stops/ambient_affordance）改 `scene.json#features` 数组 + `featureRegistry` 驱动；exits/spawnPoints 几何迁入 `scene.json#exits`/`#spawnPoints`（side+margin / yBand+yOffset 符号解析）；`_spawnStallSellers` 方法迁入 `sceneFeatures.js` | ✅ 已落地 | `js/core/featureRegistry.js`；`js/scenes/sceneFeatures.js`；`js/scenes/SceneInitializer.js`；`assets/scene.json` |
| Z-2d（PropEntity registry） | `PropEntity` 四处 `switch(propType)` + `OBSTACLE_TYPES` + `VISUAL_INTRINSIC` → 每个 prop 模块顶层自注册 `registerProp()`；新增 `propRegistry.js`（零 import）+ `entity/props.all.js`（副作用 barrel）；check-invariants Rule 5 重写（原实现读已删除的 `OBSTACLE_TYPES` 常量会静默变空）+ 新增 Rule 13（barrel 漏注册模块） | ✅ 已落地 | `js/core/propRegistry.js`；`js/entity/props.all.js`；`js/core/PropEntity.js`；19 个 prop 模块；`scripts/check-invariants.mjs` |
| Z-2c（SceneRenderer 数据驱动地面） | 四段硬编码色带 + 两条边界线 → 遍历 `ground` 配置；砖缝 / 草丛区间参数化；`Layout.resolveColor` 颜色符号解析（配置写颜色名，hex 仍在 Layout）；SceneRenderer 第 4 参收 ground，缺则抛错 | ✅ 已落地 | `js/scenes/SceneRenderer.js`；`assets/scene.json`；`js/core/Layout.js#resolveColor` |
| Z-1b（拉直草地约束复原） | `ZONE_ROUGHNESS` 表（铺装 1 / 草地 2 / ROAD·BLOCKED 999）；`_lineOfSight` 中间格 roughness 超两端 max 即拒绝，与 Z-1 前 `maxCost` 规则语义等价；roughness 不参与 A\*，与 `zoneCosts` 两套独立序 | ✅ 已落地 | `js/behavior/nav/PathPlanner.js#ZONE_ROUGHNESS` |
| N-2b（Goal 通道） | `PlanService.js` 成为 `mot.path` 唯一写入方；`mot.goal` 结构体（x/y/radius/meta）；jaywalk 空间派生（不再 walkModeStack）；zone 弹回无状态化；`modeDirect` / `planCrossing` / `walkModeStack` 删除 | ✅ 已落地 | `js/behavior/nav/PlanService.js`；`js/behavior/tasks/GotoTask.js`；`docs/design-plans/goal-pipeline-v1.md r2.3`（commit `0dcf420`） |
| J1（跑者/Agenda 集成修复） | J1-a: StrollTask `STROLL_BLOCKED_LIMIT=2` 有限重发回落（plan 必败不再死循环）；J1-b: Athletes 跑者显式 bounds + `makeNPC` 出生点守卫；J1-c: ATHLETE profile `agenda:false`，BM.register 跳过 Agenda 实例化 | ✅ 已落地 | `js/behavior/tasks/StrollTask.js`；`js/npc/Athletes.js`；`js/npc/npcUtil.js`；`js/npc/NpcProfile.js#ATHLETE`（commits `3476eb3`–`4897677`） |
| P-1（vx 振荡探针） | Motor `integratePhysics` 追踪 vx 符号翻转（`mot._obsFlipVx/_obsVxSign`，纯只读观测）；StuckProbe MOVE 明细新增 `flips` 字段（读取即归零） | ✅ 已落地 | `js/behavior/Motor.js#integratePhysics`；`js/behavior/StuckProbe.js`（commit `28eb558`） |
| N-3（骑手集成 + 路由链删除 + 不变量加固） | CYCLIST profile + `ride` STATE_DEFS + BM._separate 豁免；CyclistSpawner 接入 BM；Npc.js 内联移动分支删除；StuckProbe `_rayBlocked/isDirect/nextTarget` + SteeringDecision `corner_cut` 删除；check-invariants Rule 7 升级为 error | ✅ 已落地 | `js/npc/NpcProfile.js`；`js/behavior/Motor.js#STATE_DEFS`；`js/behavior/BaseStateMachine.js#_tickState`；`js/entity/vehicle/CyclistSpawner.js`；`js/behavior/StuckProbe.js`；`js/behavior/SteeringDecision.js`；`scripts/check-invariants.mjs Rule7` |
| V-H（车辆绘制锚点硬编码去除） | drawBicycle/drawEbike/_moto 全部脱离 getAnchor/getFrame 骑手骨架锚点；改为 FK 推导常量 × scale × direction；drawEbike 删除 `*1.2` 因子折入常量；新增 derive-vehicle-anchors.mjs 推导脚本 | ✅ 已落地 | `js/entity/vehicle/drawBicycle.js`；`js/entity/vehicle/drawVehicle.js#_moto`；`scripts/derive-vehicle-anchors.mjs` |
| 链条行为系统（B-①a 道具基建） | `AttachmentDefs.js`（物品声明表）；`SimpleProp.js`（通用道具渲染）；`NpcPropManager` MODIFIER_TO_PROP 扩展 + `_chain_` 前缀解析；attach 走 held 通道 | ✅ 已落地 | `js/behavior/data/AttachmentDefs.js`；`js/npc/props/SimpleProp.js`；`js/npc/props/NpcPropManager.js` |
| 链条行为系统（B-①b 执行器） | `ChainTask.js`（六原语解释器）；`BehaviorScripts.js`（脚本数据表）；`check-behavior-data.mjs`（校验）；eat_snack 样板脚本 | ✅ 已落地 | `js/behavior/tasks/ChainTask.js`；`js/behavior/data/BehaviorScripts.js`；`scripts/check-behavior-data.mjs` |
| 批次 B-②（passerby 模板 + desire 池升级） | passerby 模板（60% 直通 / 40% 途中 1-2 停留）；desire 池改为 BEHAVIOR_SCRIPTS 键；check-behavior-data 增 profile 校验 | ✅ 已落地 | `js/behavior/Agenda.js#_pickPasserbyGoal`；`js/behavior/data/BehaviorScripts.js`；`js/npc/NpcProfile.js`；`scripts/check-behavior-data.mjs` |
| 批次 B-③（passerby desires 集成） | `_tryDesire` 提取加权随机为独立方法；`_pickPasserbyGoal` stroll 回调优先从 desires 池抽 ChainTask，fallback affordance draw；`_pickGoal` 复用 `_tryDesire` | ✅ 已落地 | `js/behavior/Agenda.js#_tryDesire,_pickPasserbyGoal,_pickGoal` |
| V-final（速度统一线收尾核账） | 五处已知修正（Rule 10 正则收紧、Rule 9 结构修、哈希订正、Npc.js 缩进、speed 读者描述）；A–H 八段核账；封存报告 | ✅ 已落地 | `docs/audits/velocity-unification-closing-2026-07.md` |
| G-1（publishGoal 完备化 + 无驱动安全网） | 铁律 ④（goal-pipeline r2.6）；ExitSceneTask 公交分支降级边缘出口；SceneInitializer 摊主有限重发→setXY 就位；WaitForBusLayer 车门 timeout→modeWander；`_resolveTimeout` 收紧（departing && goal）；TRANSITIONS 'no-drive' priority 8 安全网（walk/run 无驱动 2s→stand）；StuckProbe STATE: 排除带 goal 行走 | ✅ 已落地 | `js/behavior/BaseStateMachine.js`；`js/behavior/tasks/ExitSceneTask.js`；`js/scenes/SceneInitializer.js`；`js/entity/busstop/WaitForBusLayer.js`；`js/behavior/StuckProbe.js`；`js/debug/MovementAudit.js` |
| 资产渲染一致性（A/B/C） | A：编辑器地面线改用 skeleton groundY（删硬编码 CY+82）；B：StickRenderer 头半径改读 skeleton.json（人 10→16，狗 7→8）；C：车辆绘制锚点改用 assets/vehicle-anchors.js（FK 生成，check-invariants Rule 12） | ✅ 已落地 | `sth/stick-puppet/js/app.js`；`js/core/StickRenderer.js`；`js/entity/vehicle/drawBicycle.js`；`js/entity/vehicle/drawVehicle.js`；`assets/vehicle-anchors.js`；`scripts/derive-vehicle-anchors.mjs` |
| Motor 前瞻避让（撞墙问题根修第一刀） | `SAFETY_RULES.wall_avoid`（probeCells=2, rotProbeCells=1）；`_lookaheadDeflect` 在 `integratePhysics` step-13 消费 vel 后、`_slideMove` 前运行：正前方阻挡且当前格可走时垂直偏转 90°，保持速度模长；两侧均阻挡直通 `_slideMove`；`avoid_steer` 计数器加入 `MovementAudit` | ✅ 已落地 | `js/behavior/Motor.js#SAFETY_RULES,_lookaheadDeflect,integratePhysics`；`js/debug/MovementAudit.js`；`docs/contracts/movement-dataflow.md §1 step-13` |
| 批次 A-①（声明端 + affordance 池） | `AffordanceDefaults.js`（tree_shade/fountain_edge/rest/use_vending/use_trash + 2 注释占位）；`PropEntity.affordances` passthrough；`EnvironmentQuery` 6 新方法（registerAmbientAffordance / drawAffordance / isClearSpot / occupyAffordance / releaseAffordance / findAffordanceByTag）；`_affOcc` 唯一写入 EnvironmentQuery；键 'o' 调试快照 | ✅ 已落地 | `js/core/AffordanceDefaults.js`；`js/core/PropEntity.js`；`js/behavior/EnvironmentQuery.js`；`js/scenes/StreetScene.js` |
| 批次 A-②（VisitTask + park_idler） | `VisitTask.js`（seeking→arriving→doing 状态机）；`StrollLoopTask.js`（park_loop_cw + wpIndex 计段）；`Agenda.park_idler` 模板（credits 1-3 + stroll→visit 循环）；`SceneInitializer` 注册 grass_rest ambient affordance + 生成 3-5 名公园常驻 NPC | ✅ 已落地 | `js/behavior/tasks/VisitTask.js`；`js/behavior/tasks/StrollLoopTask.js`；`js/behavior/Agenda.js`；`js/scenes/SceneInitializer.js` |
| C-1（编辑器参照层 + 双人改进） | 参照层（context 字段 + ATTACHMENT_DEFS/PROP_DEFAULTS 绘制）；双人新建/偏移持久化/接触距离显示/关节保护；panel 按 kind 过滤；删除 MediaPipe/SpriteSheet；六处小修 | ✅ 已落地 | `sth/stick-puppet/js/app.js`；`sth/stick-puppet/index.html`；`sth/tools/validate.mjs` |
| Cleanup-1（死代码删除 + 工具修复） | 删除 3 个孤立模块（TrafficSignal / CameraReactionLayer / PlayPoseTask）；Layout.js 删除 14 个零引用导出（9 兼容别名 + 5 LINE 常量 + 2 辅助函数）；6 处内部符号去 export；UsePropActivity 改用 ClipPlayer；NpcProfile PED_GESTURES 假键修正；gen-manifest.mjs id/kind 派生逻辑修复（从文件名/目录派生，两遍扫 variant/）；validate.mjs variant_of 误报修复；3 处文档错误修正；CLAUDE.md 补录 11 条文档索引 | ✅ 已落地 | `js/behavior/`；`js/core/Layout.js`；`js/entity/`；`sth/tools/`；`docs/` |
| 批次 W（目击/感知地基） | W-1：`EventDefs.js`（事件类型声明表，push/push_land/give_item/handshake/point_at + actorRoles/category）+ `WorldEventLog.js`（`emitEvent()` 唯一写入点，结构 `{id,kind,actors[],x,y,t}`，t 取 `GameClock.gameClock()`）；`TalkActivity.js` 三处 `_extraTags` 写入迁为两处 `emitEvent()` 调用；check-invariants Rule 1 白名单清空 + 新增 Rule 14；known-violations.md 唯一条目清账。W-2：`witness-memory-v1.md`——claim 五槽 schema + channel×槽可填表（sound 通道 `actor` 硬 null，非概率）+ q→填槽裁决表 + mutation 转移表（照 Talk of the Town）+ 2–4 目击者设计目标，纯文档零代码。W-4：`Perception.js`——视觉三项（dist/facing/attention）+ 听觉两项（dist/attention）双通道裁决，`perceive(witness,eventX,eventY)→{channel,q}\|null`，视距/听距上限唯一住址，纯函数未接入任何调用点，无行为变化。W-5：`ClaimDecisionTables.js`（q→填槽概率表，数值唯一住址，照抄 witness-memory-v1.md §3）+ `Belief.js`（`npc.mem('belief').claims` 唯一 owner，`generateClaims()` 是 witness 来源 claim 唯一写入点，`selectWitnesses()` 单独导出供静态采样）；新增 `scripts/check-witness-distribution.mjs`（候选充足/稀缺/超射程三场景，纯函数采样不依赖 NavGrid/EntityManager）。W-6：`providers.js` 新增 `interrogate.ask({question,knownClaims})`（与 vision/text 同规格 live+mock 双轨，复用 TEXT_KEY/TEXT_BASE，mock 走关键词分槽 `_detectSlot`）；`Belief.js` 新增 `injectSuggestion(npc,slot,value)`（"suggested"来源 claim 第二个写入点，同 (slot,value) 复述只加 `strength`）+ `claimsToTestimony(npc)`；`text.compose()` 的 `_liveText`/`_mockText` 真正消费 `testimony` 参数（此前是接收了但从不转发的死参数）；`NewsUI.openComposer()` 新增审问面板（选目击者→提问→展示 claims），`witnesses` 参数来自 `StreetScene._takePhoto()` 的 `vf.capturedEntities` 过滤出的活体 NPC；`compose()` 调用点的 `testimony:[]` 硬编码改为 `witnesses.flatMap(claimsToTestimony)` | ✅ 已落地（W-1/W-2/W-4/W-5/W-6）；W-3（registerProp occludesSight）用户决定废弃，不做；W-1/W-5 两个地基当时尚未接线到真实事件源——**已在批次 W-7a 接上，见下表** | `js/behavior/data/EventDefs.js`；`js/behavior/WorldEventLog.js`；`js/behavior/activities/TalkActivity.js`；`docs/design-plans/witness-memory-v1.md`；`js/behavior/Perception.js`；`js/behavior/data/ClaimDecisionTables.js`；`js/behavior/Belief.js`；`scripts/check-witness-distribution.mjs`；`scripts/check-invariants.mjs`（Rule1/Rule14）；`docs/contracts/known-violations.md`；`js/news/providers.js`；`js/news/NewsUI.js`；`js/scenes/StreetScene.js`；`docs/design-plans/news-pipeline-mvp.md` |
| W-7a（事件流接线） | `WorldEventLog.js` 新增 `drainNewEvents()`（唯一游标推进读取点，`getEvents()` 降级为只读全量查询）+ `EVENT_LOG_CAP=500`（长度上限唯一住址，超限从头裁剪，游标同步平移防重读）；`BehaviorManager.update()` 在 `SocialLayer.update()` 之后新增唯一消费步骤（帧序 1.5）：drain → 解析 `actors[]` id 为 `this.npcs` 活体引用（找不到传 `null`）→ `Belief.generateClaims()`；check-invariants 新增 Rule 15（`generateClaims()` 全库唯一调用点，且必须在 BehaviorManager.js） | ✅ 已落地 | `js/behavior/WorldEventLog.js`；`js/behavior/BehaviorManager.js`；`scripts/check-invariants.mjs`（Rule15）；`docs/contracts/behavior.md`；`docs/contracts/movement-dataflow.md` |
| W-7b（目击者来源改判） | `StreetScene._takePhoto` 的 `witnesses` 过滤条件从"入镜即目击"（`typeof e.mem==='function'`）改为"入镜且 `mem('belief').claims` 非空"——只有 W-7a 接线后真正跑过感知裁决、产出过 claim 的 NPC 才算可审问目击者；感知裁决只在事件发生那一刻跑（BM 帧序 1.5），拍照这一刻不重新触发判定，`StreetScene.js` 不接触该裁决层任何符号。新增 `hasUnwitnessingNpc` 信号区分两种空目击者成因，`NewsUI` 分别显示"框里没人"（中性提示）vs"框里有人但谁都没看见"（斜体，标注为玩法反馈而非错误） | ✅ 已落地 | `js/scenes/StreetScene.js`；`js/news/NewsUI.js` |
| W-7c（槽级 provenance） | claim 新增 `id`（`injectSuggestion` 定位用）+ `sources` 对象（五槽各自 `'witness'\|'suggested'\|null`，值为 null 的槽 sources 必为 null）；`strength` 从 claim 级降为槽级 `strength[slot]`；`generateClaims()` 产出时所有有值槽标 `'witness'`；`injectSuggestion` 改签名 `(npc, claimId, slot, value)`，**不再新建 claim**——只填某条既有 claim 上 `sources[slot]===null` 的槽，同 (claim,slot,value) 复述才 `strength+1`，换值或该槽已是 witness 来源一律拒绝；新增 `findFillableClaim(npc, slot)` 配套查找，`NewsUI` 审问面板用它决定往哪条 claim 写；顶层 `source` 字段完全删除，不留兼容层；`claimsToTestimony` 过渡为"整条含任一 suggested 槽即标注"（按槽精确标注是 W-7d 范围）。`witness-memory-v1.md` 标题升 v1.1，第一/七节按新 schema 改写 | ✅ 已落地 | `js/behavior/Belief.js`；`js/news/NewsUI.js`；`docs/design-plans/witness-memory-v1.md`；`CLAUDE.md` |
| W-7d（证词序列化收口） | 修两个 bug：actor/target 的 fine 值此前直接存裸 `npc.id`（数字），place 的 fine 值直接存 `{x,y}`（对象）——两者都不满足 schema 声明的 `string`，拼出来的证词分别是 `谁=17`、`地点=[object Object]`。新增 `_describeSlotValue(kind, raw)`（唯一序列化住址）：`kind==='npc'` 产出 `npcType#id`，`kind==='place'` 产出 NavGrid zone 名（fine 额外带坐标后缀，coarse 不带）；`_actorFidelityValue`/`_placeFidelityValue` 的 fine/coarse 分支改调它，claim 里存的从此就是可读字符串，不是待格式化原始值。`claimsToTestimony` 改按槽标注来源（只有被问出来的那个槽后面跟"（未经证实）"），不再整条打一个标签盖住目击到的部分。`NewsUI.js` 全程只经 `claimsToTestimony()` 拿文本，不碰 claim 字段，无需改动。`witness-memory-v1.md` 第一节取值域表同步更新 | ✅ 已落地 | `js/behavior/Belief.js`；`docs/design-plans/witness-memory-v1.md`；`CLAUDE.md` |
| W-7e（审问语义修正） | `_liveInterrogate` 系统提示词改写：候选值只能从玩家问句措辞里抽取，`knownClaims` 仅供判断槽位不得当答案来源，明令禁止推断/编造/常识补全，抽不到就是 `value:null`（合法结果，不是失败）；`{!parsed.slot \|\| parsed.value==null}` 的旧抛错条件改为只在缺 `slot` 时才抛——`value:null` 不再触发 mock 降级。`_mockInterrogate` 删除 `'说不清楚'` 字符串兜底（会被当成真实候选值注入进信念），`knownClaims` 里找不到就是 `value:null`（mock 无真实语言理解能力，仍只能查表近似，不强求它做措辞抽取）。`NewsUI.js` 新增 `feedback` 提示区：`value===null` 显式分支提示"这个问题没有暗示任何具体答案"；连带处理"问出了值但没有空槽可填"（`findFillableClaim` 返回 null）的提示，避免用户以为提问失败。`providers.js` 头注释补 interrogate 唯一职责声明 | ✅ 已落地 | `js/news/providers.js`；`js/news/NewsUI.js` |

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

> 上述四项均已被 **Z-1（zone-profile split）** 取代，见下文 Z-1 条目。本条目保留为历史。

---

### Z-1（zone-profile split）— 已落地

NavGrid 从「cost map」重构为「zone map + profile cost table」两层：

- **`ZONE` 枚举 + `DEFAULT_ZONE_COSTS`**（`NavGrid.js`）：格子只存语义 ID
  （BLOCKED/SIDEWALK/GRASS/ROAD/CROSSWALK），代价改由表查得；`ROAD=250` 哨兵值删除。
- **`cost(gx,gy)` → `zone(gx,gy)`**；内部 `_cost`/`_baseZone` → `_zone`/`_baseZoneMap`。
- **`_bakeCrosswalks` 删除**：斑马线几何在 `_bakeZones` 内直接烘焙为 `ZONE.CROSSWALK`；
  半宽 20 变为 NavGrid 局部几何常量 `CROSSWALK_HALF_W`（不再是代价政策）。
- **`PLANNING_RULES` 删除**，`bake()` 的 `planningRules` 参数与 `plan()` 的 `opts.roadCost`
  一并删除；`plan()` 第 6 参改收 `zoneCosts` 表，代价查询 `zoneCosts[zone] ?? 0`（0 = 不可通行）。
- **代价装配唯一住址** = `PlanService._zoneCostsFor()`：默认表 → `profile.zoneCosts` 覆盖
  → jaywalk 覆盖（`ROAD → 3`）。profile 新增可选 `zoneCosts` 字段（当前无 profile 使用，机制就位）。
- **`_lineOfSight` 改为纯 zone 检查**（BLOCKED/ROAD 不可拉直，CROSSWALK 可）；旧 `maxCost`
  比较删除后曾短暂丢失「铺装点之间不穿草」约束，随即以 `ZONE_ROUGHNESS` 表复原（见 Z-1b）。
- 数字对比：代价哨兵值 4→0；外部注入代价参数 2→0；`=== ROAD` 比较 ~15 处 → `=== ZONE.ROAD` 6 处。

代码锚点：`js/behavior/nav/NavGrid.js#ZONE,DEFAULT_ZONE_COSTS`；
`js/behavior/nav/PathPlanner.js#plan,_astar,_lineOfSight`；`js/behavior/nav/PlanService.js#_zoneCostsFor`

---

### Z-2a（Layout 参数化）— 已落地

`Layout.js` 从硬编码常量改为场景配置注入，利用 ES module live binding 使 66 个
`import` 站点零改动。

- **`export const` → `export let`**：世界尺寸、12 个 Y 分带、~~`BUILDING_EXIT_XS`~~
  （已删，见下方「BUILDING_EXIT_XS 清理」）；文件内字面量降级为 fallback 默认值。
  颜色仍是 `export const`（画风不是场景结构）。
- **`initLayout(config)`**：读 `world` / `yBands` / `depth`，逐字段 `??` 覆盖
  （原末尾还会就地重算 `BUILDING_EXIT_XS`，现已随其一并删除）。缺字段即保留
  默认值——config 是覆盖不是替换。
- **scene.json 新增 `world` / `depth` / `yBands`**：`yBands` 的 12 个键名与 Layout
  export 名一一对应，值与旧硬编码完全一致（原地搬家，非新数据）。
- **注入时序**：`StreetScene.create()` 内 `expandSceneData` 之后、`SceneRenderer` 之前。

**live binding 的边界（重要）**：注入晚于所有模块顶层求值，因此**在模块顶层从 Layout
值派生的量冻结在 fallback 默认值上**，不随注入更新。当时现存三处：

| 站点 | 冻结量 | 依赖 |
|------|--------|------|
| `NavGrid.js` | `COLS` / `ROWS` | `WORLD_WIDTH` / `WORLD_HEIGHT` |
| `VehicleSpawner.js` | `LANES` | `roadY()` / `WORLD_WIDTH` |
| ~~`WaitForBusLayer.js`~~ | ~~`WAIT_ZONES`~~ | 已解决，见下方「公交站坐标收口」 |

Z-2a 的注入值与默认值相同，故零行为差异；**任何真正改动这些数值的场景必须先处理剩余
两处**（改为函数或延后到 init 之后计算）。另注：`headless-sim.mjs` 用解构动态 import
取 Layout 值，那是拷贝而非 live binding，且不调 `initLayout`，故始终用默认值。

**公交站坐标收口**（后续独立小刀，晚于 Z-2e）：`WaitForBusLayer.js` 的 `WAIT_ZONES`
改为构造函数内按传入的 `busStops`（`stop.x` ± 半宽常量 `WAIT_ZONE_HALF_WIDTH`）现算，
不再是模块顶层字面量数组，同时解决了此处的顶层冻结问题和下方 Z-2e 记录的
「公交站坐标 500≠650」不一致问题——`vehicleSpawner.js#initVehicleSystem` 现接收
`busStopsCfg` 参数，由 `sceneFeatures.js` 的 `vehicles` feature 传入 `ctx.layout.busStops`
（即 `bus_stops` feature 渲染顶棚用的同一份数据），不再自带一份硬编码坐标。

**BUILDING_EXIT_XS 清理**（后续独立小刀）：巡查发现 `BUILDING_EXIT_XS` 是 Z-2a 遗留
死代码——全库只有 `Layout.js` 自身（定义 + `initLayout` 末尾就地重算）和
`entity/building/building.js` 头部注释引用这个名字，但实际出口坐标早已由
`SceneInitializer._spawnNPCs` 按 `scene.json#buildings[].door` 逐栋注册（`Z-2e` 落地时
即如此），`BUILDING_EXIT_XS` 从未被读取消费。已删除该数组及其重算逻辑，并把
`building.js` 头部过时注释改为描述实际生效的 `buildings[].door` 机制。

代码锚点：`js/core/Layout.js#initLayout`；`js/core/sceneData.js#expandSceneData`；
`js/scenes/StreetScene.js#create`

---

### Z-2b（NavGrid zone bake 数据驱动）— 已落地

`NavGrid._bakeZones` 全程配置驱动，文件内不再有任何 Y 分带数字。`_zoneDefault(wy)`、
`PATH_TUBE_R`、`CROSSWALK_HALF_W` 全部删除。

`scene.json#zones` 四段：

| 段 | 作用 | 取代的硬编码 |
|----|------|-------------|
| `bands[]` | 6 条 Y 分带默认 zone（按序首个 `wy < to` 命中，越过末带沿用末带） | `_zoneDefault` 的 5 个 if |
| `overlays[]` | 附加带（公园顶部入口带 `PARK_TOP` +28） | `_bakeZones` 第 2 段 |
| `paving` | walkPaths 管道半径 20 + plaza 椭圆缩放（chessPlaza 1.0/1.0、miniPark 0.85/0.7） | `PATH_TUBE_R` + 两处 shrink 因子 |
| `crossings` | 斑马线管半宽 20 + 生效 Y 区间 + `over: "ROAD"`（只覆盖 ROAD 格） | `CROSSWALK_HALF_W` + 两个分带边界 |

**符号引用**：边界值在配置里写分带**名字**（`"to": "FAR_Y"`），经 `Layout.resolveY`
解析成当前注入值，数值仍只有 `yBands` 一处，无重复真相。`Layout.Y_BAND_NAMES` 导出
合法键名；`initLayout` 校验 `config.yBands` 的键，拼错即抛。zone 名同理经 `_zoneId`
映射，拼错即抛。**全链路无静默 fallback**——配置缺失就炸，不退回硬编码。

`overlays` 的行区间沿用 Z-2b 前的既有算法（`floor(y/CELL)` 端点闭区间，非格中心判定），
以保证逐格等价；这是个既有的小 wart，配置注释里标了。

代码锚点：`js/behavior/nav/NavGrid.js#_bakeZones`；`js/core/Layout.js#resolveY,Y_BAND_NAMES`

遗留：NavGrid 仍直接用 `NEAR_Y` 做「同侧」判定（`sampleWalkableNear`、
`_assertSingleRegions`）——那是采样政策而非 zone 烘焙，不在本刀范围。

---

### Z-2e（Feature registry + SceneInitializer 声明化）— 已落地

目标：一个 scene.json 独立构建一个场景（学校 / 街区 / 商业街），不改 JS。

**分层决策**（用户确认，见对话记录）：`SceneInitializer` 里 13 件事分两类——
NavGrid bake / BehaviorManager / ExitRegistry / Director 是每个场景都必须有的
**infra**（引导代码，留在类方法里，不进 registry）；pedestrians / park_idlers /
chess / stall_sellers / dog_walker / athletes / vehicles / bus_stops /
ambient_affordance 是**可选内容**（改 `scene.json#features` 数组驱动）。
exits/spawnPoints 是 infra 消费的数据，不算 feature，单独一段配置。

- **`featureRegistry.js`**（新增，零 import，镜像 `propRegistry.js`）：
  `registerFeature(type, initFn)`，`initFn: (ctx, cfg) => void`。
- **`sceneFeatures.js`**（新增，包装层，**不是** propRegistry 式各模块自注册）：
  这 9 个 spawn 函数签名各异、散落在 `npc/` 和 `entity/vehicle/`，塞进各自模块
  会强改 5+ 既有文件且徒增循环依赖风险；改为单文件把既有函数包成
  `(ctx, cfg) => void` 契约再注册，被包装函数本身零改动。
  `_spawnStallSellers` 方法体逐字迁入（原样搬家，只把 `this.em/this.sr` 换成
  `ctx.em/ctx.sr`）。
- **`scene.json` 新增 `exits` / `spawnPoints` / `features`**：
  `exits.edges[]`（`side`+`margin`→X）、`exits.buildingDoor`（`yBand`+`yOffset`→Y，
  `yZone` 两个分带名）；`spawnPoints[]` 同款 side/margin/yBand/yOffset；
  `features[]` 每条 `{type, ...cfg}`，声明顺序 = 初始化顺序。
- **`SceneInitializer.js`**：`_spawnNPCs` 里 exits/spawnPoints 构建照旧但读配置
  （新增 `_resolveSideX` 辅助）；features 循环替换原本 9 段内联调用；
  `Director` 的 `busStops` 改可选链（`vehicles` feature 未声明时 `trafficManager`
  不存在，须防御——这是"内容可选"必然要求下游防御的样例）。

**已知不动的重排**：`WaitForBusLayer` 原本在公交视觉实体（`bus_stops`）生成之后
才 wiring，现在因两者拆成独立 feature、`vehicles` 先于 `bus_stops` 声明，
wiring 提前到公交视觉实体生成之前。核实为安全：`WaitForBusLayer` 存的是
`em.entities` 数组引用（非拷贝），`em.add()` 用 `push` 原地追加，故后生成的
公交实体仍对已构造的 `WaitForBusLayer` 可见；且两者都不消费 `Math.random()`，
不影响其余 feature 的随机数消费顺序。

~~⚠️ **已知遗留**（本刀发现，未修，非 Z-2e 引入）：`vehicles` feature 内的
`initVehicleSystem()` 内部硬编码两个公交站坐标（x=500 direction+1、x=1500
direction−1），与 `bus_stops` feature 读的 `layout.busStops`（scene.json，
当前 x=650/1500）是两个独立位置真相，已经不一致（500≠650）。这是一个先于
本刀存在的 bug，不属于"数据驱动化"范围，未合并两者、未修正坐标，原样保留
其现有（有缺陷的）行为。~~ 已修复，见上方 Z-2a 小节「公交站坐标收口」。

**验证**（用户已知情并批准：本刀违反了 CLAUDE.md「默认禁止运行游戏/harness/
模拟验证」的工作流铁律——用 `git worktree` 对比改造前后的
`SceneInitializer.spawnAll()`，并直接跑了 `headless-sim.mjs`；杂散输出文件已删；
用户决定保留验证结果记录在案，后续同级别重构仍需事先明确授权才能运行）：
- 用 `git worktree` 拉出改造前 HEAD（`8f367e3`），写一个无 PIXI 的最小 harness
  （复用 `headless-sim.mjs` 的 window shim + `mulberry32` seeded RNG 手法），
  分别在改造前/后代码树上跑 `SceneInitializer.spawnAll()` 全流程，
  两个随机种子（42、7）下**152 个生成实体逐个字段（类型/位置/scale/tags/
  direction/state）完全相同**；ExitRegistry 条目、Director 收到的
  spawnPoints/buildingDoors/busStops 数量、propManager/trafficManager/
  WaitForBusLayer 是否存在，均相同；同树同种子二次运行结果相同（harness
  自身确定性核验）。
- `check-invariants.mjs` 全绿；`check-behavior-data.mjs` 全绿；四文件 ESM
  parse 通过；scene.json 合法。

代码锚点：`js/core/featureRegistry.js`；`js/scenes/sceneFeatures.js`；
`js/scenes/SceneInitializer.js#_spawnNPCs`

---

### Z-2d（PropEntity registry）— 已落地

`PropEntity` 的四处 `switch(this.propType)`（`draw` / `drawGround` / `_computeFootprint` /
`getBounds` 的 `VISUAL_INTRINSIC` 查表）+ `OBSTACLE_TYPES` 集合，改为每个 prop 模块
顶层自注册；`PropEntity.js` 不再逐个 `import` 19 个 draw 文件 + 13 个 footprint 函数。

- **`propRegistry.js`**（新增，**零 import**）：`registerProp(type, def)`，
  `def = {draw, drawGround, footprint, obstacle, visual, bounds, config}`。
  重复注册同名类型抛错；`obstacle:true` 但缺 `footprint` 抛错。
- **`props.all.js`**（新增，副作用 barrel）：import 全部 18 个注册模块。
  **不** import `busstop/busstop.js`——它 import `PropEntity`，会与
  `PropEntity → barrel` 成环；`busstop-roof/bench/sign` 三种改在各自
  `draw*.js` 里注册。
- **`PropEntity.js`**：`_def = getPropDef(propType)`；四处 switch 全部改为
  `this._def?.xxx?.(...)` 可选链；`def.config` 取代 `busstop-roof` 专属的
  五行手写字段抄写。未注册类型静默不绘制（与旧 `switch default` 行为一致）。

**check-invariants 联动修复**：Rule 5 原实现从 `PropEntity.js` 源码正则提取
`OBSTACLE_TYPES = new Set([...])`；该常量删除后若不改会静默变空数组、规则恒绿
（同 Z-1 后 Rule 8 的教训）。本刀当场重写：扫描全仓 `registerProp()` 调用
（括号深度匹配定位调用体），对 `obstacle:true` 的调用核对宿主文件含
`shape`/`blocks` 字面量。新增 **Rule 13**：每个调用 `registerProp()` 的模块必须
出现在 `props.all.js` barrel 里，防止"注册了但没接线"回归。两条规则都做了
故意破坏 + 复原的双向验证（去掉 hydrant 的 `blocks` 字段、从 barrel 删一行
import），确认不是摆设。

代码锚点：`js/core/propRegistry.js`；`js/entity/props.all.js`；
`js/core/PropEntity.js`；`scripts/check-invariants.mjs Rule5,Rule13`

遗留：`busstop.js` 仍直接 `import PropEntity`，未接入 barrel（结构性排除，见上）。

---

### Z-2c（SceneRenderer 数据驱动地面）— 已落地

`_drawGround` 的地面色带改为遍历 `scene.json#ground`，文件内不再有地面色带的 Y 数值，
也不再直接引用 `GRAY_*` 画带。

| 段 | 作用 |
|----|------|
| `bands[]` | 4 条填充色带（远人行道 / 车行道 / 近人行道 / 公园），按数组顺序绘制 |
| `edgeLines[]` | 2 条带边界线（线色由该 Y 的景深算，宽度可配） |
| `tiling` | 人行道砖缝：区间 + `inset` + `spacing` + 颜色/alpha/线宽 |
| `grass` | 草丛散布：区间 + `inset` + `tufts` 根数（确定性 seed，非随机） |

**颜色写名字不写 hex**（`"color": "GRAY_ROAD"`），经 `Layout.resolveColor` 解析。
场景配置说「这条带用路面色」，具体是哪个灰仍由 Layout.js 说了算——延续 Z-2a
「颜色是画风不是场景结构」的划分，画风不外流到场景数据。

**⚠️ ground 色带与 NavGrid 的 zone 是两套不同划分，不可互相套用。**
远侧人行道的铺装色一路画到 `FAR_Y`（含远端自行车道 248–268），而那段在导航上是
`ZONE.ROAD`。视觉分带按「看起来是什么材质」切，zone 按「能不能走 / 多贵」切。
所以 `ground` 是独立配置，不是 `zones` 的渲染视图——这点已写进 SceneRenderer 头注释。

代码锚点：`js/scenes/SceneRenderer.js#_drawGround`；`js/core/Layout.js#resolveColor,PALETTE_NAMES`

遗留（下刀候选）：路缘石唇口、车道虚线、斑马线条纹（`_drawRoadMarkings` /
`_drawCrosswalk`）仍是代码内硬编码几何——逐要素装饰几何，不是地面色带。

---

### Z-1b（拉直草地约束复原）— 已落地

Z-1 删 `maxCost` 时连带丢了「铺装点之间拉直不穿草」约束。公园的 `walkPaths` 专门 bake
了 `ZONE.SIDEWALK` 走廊穿过草地，A* 沿走廊规划，拉直若抄草等于白修路。

以 `ZONE_ROUGHNESS`（`PathPlanner.js` 模块级）复原，与旧规则语义一一等价：
铺装 1 / 草地 2 / ROAD·BLOCKED 999；`_lineOfSight` 中间格 roughness 超过两端 max 即拒绝。

- 铺装↔铺装：maxR=1，草地 2 > 1 → 不穿草（旧：maxCost=1，草 8 > 1）
- 草地↔草地：maxR=2，草地 2 ≤ 2 → 可穿草（旧：maxCost=8，草 8 ≤ 8）
- 起点在 ROAD（被挤上路者）：maxR=999 不设限，中间 ROAD 格仍由显式检查拒绝（旧同）

roughness 不参与 A\*，与 `zoneCosts` 是两套独立的序：代价管选路，roughness 管拉直。

代码锚点：`js/behavior/nav/PathPlanner.js#ZONE_ROUGHNESS,_lineOfSight`

遗留：`check-invariants.mjs` Rule 8 的三个字段名已全部消失，规则变为空守卫（恒绿），待 Z-2 系列改写。

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