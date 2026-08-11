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
| 新闻管线 MVP | Viewfinder 截图、vision/text Provider、成稿面板 NewsUI | ✅ 已落地 | `js/scenes/StreetScene.js#_takePhoto`；`js/news/NewsUI.js#openComposer`（`providers.text.compose`）；`docs/design-plans/news-pipeline-mvp.md`（finalized） |
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
| M-1（check-invariants Rule 8 改写） | 旧 Rule 8 守的 `crosswalkCost`/`jaywalkRoadCost`/`roadCostDefault` 三个字段名在 Z-1 之后全库消失，规则恒绿、不再守护任何东西（该债务此前已在 `goal-pipeline-v1.md` N-2a 小节和本文件 Z-1b 小节记录为已知遗留）。改写为守真实住址：`[ZONE.x]: n` / `[ZONE.x] = n` 这类 zone 代价字面量只允许出现在 `NavGrid.js`（`DEFAULT_ZONE_COSTS`）和 `PlanService.js`（`_zoneCostsFor`）；`PathPlanner.js` 单独豁免——它的 `ZONE_ROUGHNESS` 是形状相同但语义无关的拉直摩擦表（早有文档说明与代价"两套独立序"），豁免不等于允许它定义代价。规则注释里写清楚验证手法：在第三个文件里加一行 `[ZONE.x]: n` 应该会让规则失败（已实测：临时加违规行触发 FAIL，删除后复绿）。规则新增了跳过文档注释行的逻辑，避免 `NpcProfile.js` 里举例用的 `` `zoneCosts: { [ZONE.GRASS]: 1 }` `` 这类注释文字被误判 | ✅ 已落地 | `scripts/check-invariants.mjs`（Rule 8）；`docs/design-plans/goal-pipeline-v1.md`；`docs/roadmap.md` |
| E-1（SceneRenderer 路面标线几何收口） | `_drawRoadMarkings`/`_drawCrosswalk` 里剩下的硬编码几何（远/近路缘石厚度、路面边缘带高度、车道虚线间距/长度/线宽、斑马线条纹数量/长度/横向偏移、各元素透明度）全部移进 `scene.json layout.roadMarkings`（`curbFar`/`roadEdge`/`curbNear`/`laneStripe`/`crosswalk` 五个子对象），两函数改用 `_need()` 读取，缺配置即抛错，与文件里其余绘制函数（`_drawSidewalkTiles`/`_drawParkGrass`）同一套配置纪律；顺带把此前已半配置化但仍带 `\|\| 56/28` 硬编码 fallback 的 `layout.roadStripeSpacing/roadStripeLength` 合并进新的 `laneStripe` 子对象，去掉 fallback。车道漆/斑马线的白色不再是裸 `0xffffff` 字面量，新增 Layout.js 具名颜色 `MARKING_PAINT` 走 `resolveColor()` 符号解析，遵循"颜色是画风只在 Layout.js、场景配置只写名字"的既有铁律。复用 Z-2c 的教训：`roadMarkings` 是沿路装饰几何，不套用 `ground` 的横带结构或 NavGrid 的 zone 划分，三者形状不同、配置独立 | ✅ 已落地 | `js/scenes/SceneRenderer.js`；`js/core/Layout.js`；`assets/scene.json`；`CLAUDE.md` |
| A-1（lift.json 接线，首个非 null heldPose） | `lift.json` 从 `new_assets/overlay/` 移入 `animations/overlay/` 并注册进 `manifest.json`（`kind:overlay`，未改动关节数据）；`ATTACHMENT_DEFS` 新增 `guitar` 条目，`heldPose:'lift'`——但 `heldPose` 字段目前无消费者（`NpcPropManager` 只读 `propType`/`draw`/`anchor`，`ModifierLayer` 的姿势叠加走 `profile.heldPoses` 是另一套机制），填值不代表运行时生效，文件头注释与 guitar 条目注释都写明了这个区分。实际"举吉他"视觉效果改走 `Motor.js` 新增的 `STATE_DEFS.lift`（`speedK:0, once:true`，静止持握姿势）+ `BehaviorScripts.js` 新增 `play_guitar` 脚本（`attach guitar → goto tree_shade → pose lift[10,20]s → detach`）——`pose` 步骤本来就要求 `clip` 是合法 `STATE_DEFS` 键（`setState` 内部查表，查不到静默 no-op），这一步是让脚本真正起作用的必要连带修改，不只是走个过场；`lift.json` 本身按 `new_assets/docx.md` 校对说明是"可走路"设计，本批只用了静止持握这一部分能力，未新增 ChainTask 原语去支持"走路时叠加姿势"。`pedestrian` profile 的 `desires` 加入 `play_guitar` | ✅ 已落地 | `assets/animations/overlay/lift.json`；`assets/manifest.json`；`js/behavior/data/AttachmentDefs.js`；`js/behavior/Motor.js`；`js/behavior/data/BehaviorScripts.js`；`js/npc/NpcProfile.js`；`assets/animations/new_assets/docx.md` |
| A-2（child skeleton，声明性数据） | `assets/skeleton.json` 新增第三条骨架 `child`：`joints`/`defaultPose` 与 `human` 逐字节复制（不单独画 child clip，全部既有 human clip 直接复用），`scale`/`unit_height`/`headRadius` 按 100/144≈0.694 比例设成小孩尺寸。**范围经用户确认**（动手前用问题澄清了是否要新增跨实体缩放机制，用户选择不做）：这三个字段目前没有渲染代码读取——`EntityManager.js` 的 `e.scale = depthScale(e.y)` 每帧整体覆写、与骨架名无关，`StickRenderer._drawHuman` 头半径也硬编码只读 `this._headRadius['human']`，不按 `anim.skeleton` 分支查表；本批不新增跨实体的缩放机制（不碰 `EntityManager.js`/`Npc.js`），child NPC 生成后视觉上和成人一样大，是有意的最小范围而非遗漏。`NpcProfile.js` 新增 `CHILD` 预设（spread 自 `PEDESTRIAN`，加 `skeleton:'child'` 声明字段，同样无消费者），注册进 `PROFILES.child`，暂无任何 spawner 使用它。删除 `new_assets/child_single.json`——逐关节比对确认 11 个关节 delta 全部是同一个值 `(-6,+18)`，就是 `stand.json` 整体平移，零独立姿势信息 | ✅ 已落地（声明性范围，视觉效果留给后续批次） | `assets/skeleton.json`；`js/npc/NpcProfile.js`；`docs/contracts/behavior.md`；`assets/animations/new_assets/docx.md` |
| A-3（hand_stand 两个 clip 归零并接线） | `hand_stand_up`（11 帧）/`hand_stand_down`（7 帧）移入 `animations/transition/` 并注册进 `manifest.json`（`kind:transition`）；用 `scripts/rezero-clips.py`（临时把两个 id 加进 `TARGET_CLIPS` 跑完再改回原 4 项，脚本文档里的历史 "Targets" 列表保持不变）做接地归零，未手改任何关节坐标；两文件补 `"skeleton":"child"`（沿用 A-2 骨架，defaultPose 与 human 相同，数值不受影响）+ `"from"/"to"` 元数据（`stand↔handstand`，纯文档字段，无运行时消费者）。顺带修了两个在验证过程中发现的、影响判定但与本批无关的 `sth/tools/validate.mjs` 既有 bug：①`VALID_SKELETONS` 硬编码 `['human','dog']`，A-2 加了 `child` 骨架后必然报 "invalid skeleton"——改成从 `skeleton.json` 动态派生，以后加骨架不用记得同步这里；②Windows 下 `path.relative()` 返回反斜杠路径，跟 manifest 里正斜杠字符串比较永远不相等，导致几乎全部子目录 clip 被误判 UNREGISTERED（`open_door.json` 等早就正确注册的文件也中招，是本批之前就存在的假阳性，不是本批引入）——两处 `rel` 计算统一 `.replace(/\\/g,'/')` 后收敛为真实的 0 个未注册文件。rezero-clips.py 本身也顺手修了一个 Windows 独立 bug：验证阶段的 ✓/✗ 在 GBK 控制台编码下会 UnicodeEncodeError 崩溃（崩溃发生在文件已经写完之后，容易让人误判"改坏了"），加了 `sys.stdout.reconfigure(encoding='utf-8')`。**已知残留、未消除**：两个 clip 各自仍有 1 条 "ground: first frame no joint near y=0" 警告——frame 0 是动作中段的悬空姿势（hand_stand_down 是倒立中段，hand_stand_up 是被全局归零量整体带偏 1px 出容差），这是"保证全片段不穿地"这条正确算法的必然副作用，不是没处理干净；消除它只能靠手改单帧坐标（被本批规则禁止）或重排帧序（改变动作语义，未获授权），因此保留为已知限制，如实记录，不强行让 `validate.mjs` 输出"看起来干净" | ✅ 已落地（含 2 处 validate.mjs 既有 bug 修复；ground 首帧警告有已知且合理的残留，未强行消除） | `assets/animations/transition/hand_stand_up.json`；`assets/animations/transition/hand_stand_down.json`；`assets/manifest.json`；`scripts/rezero-clips.py`；`sth/tools/validate.mjs`；`assets/animations/new_assets/docx.md` |
| C-1b（编辑器 context 写入口，补 C-1 的漏） | C-1 只做了 `context.held`/`context.prop` 的读侧渲染（`_drawContextRef`），`exportJSON` 三个分支（cycle/overlay、duet、variant）都没写出 `context`，`index.html` 无设置 UI，全库零 clip 带 `context`——D5 的交叉检查从没被真实数据触发过。本批：三个 `exportJSON` 分支补 `...(clipContext ? {context: clipContext} : {})`；`_enterDuetMode` 删除无条件 `clipContext = null`（此前 duet clip 载入即丢 context）；`index.html` 新增「参照物 (context)」面板（`contextKindSelect`/`contextValueSelect` 两个下拉，取值源分别是 `ATTACHMENT_DEFS`/`propDefaults`/`skeleton.json` 的键）；`_syncPanels()` 挂 `_syncContextPanel()`，载入 clip 自动回填。补上设计文档 D1 原定但 C-1 没做的第三种引用「对手方角色」（`context.counterpart`，取值为 skeleton 名）——D3 没给这一档定几何渲染规格，`_drawContextRef` 只画一行文字标注，不画完整第二具骨架，是遵照设计文档的既定范围，不是缩水。顺带删了 `loadedClipMeta.context`（设了从没读过的死字段，真正的读写路径一直是独立的 `clipContext` 模块变量）。给 `assets/animations/overlay/lift.json` 补 `context:{held:'guitar'}`，与 A-1 的 `ATTACHMENT_DEFS.guitar.heldPose:'lift'` 互相指回，第一次让 `validate.mjs` 的 context 交叉检查真实跑到并通过 | ✅ 已落地 | `sth/stick-puppet/js/app.js`；`sth/stick-puppet/index.html`；`sth/stick-puppet/README.md`；`assets/animations/overlay/lift.json`；`docs/design-plans/editor-reference-layer-v1.md`；`CLAUDE.md` |
| L-1（朝向改为实际位移的派生量） | 删 `BaseStateMachine.js#updateFacing` 及其调用、`mot.dirCD`；朝向唯一住址迁入 `Motor.js#integratePhysics`（新增 `_updateDirection`，`_slideMove` 写入之后调用）：判据从"转向意图速度 + 0.45s 时间冷却"改为"本帧真实 x 位移的空间死区"——`mot.faceAcc` 累加带符号真实 dx，越过 `SAFETY_RULES.facing.deadZone(10 骨架单位) × npc.scale` 才翻转、翻转后清零；只在 `walk`/`run`/`jog`/`ride` 四态生效，其余状态的既有 `npc.direction` 写入（落座/离场朝向、Director 出生朝向、LoiterBehavior 等）不变。`audit.count('dir_mismatch')` 同步搬迁，判据从"意图 vx vs direction"改为"真实 dx 符号 vs direction"，成为可回归指标。`check-invariants.mjs` Rule 10 白名单类别 A 的位置/语义注释同步更新（正则本身无需改，`desired`/`dir_mismatch` 关键字延续）。四门验证：check-invariants/check-behavior-data/check-witness-distribution/validate.mjs 均以改动前基线差分核对——`check-invariants` Rule 2 与 `validate.mjs` 的既有失败项（未 track 的 `new_assets/overlay` 两个 clip 带 `kind`、`stumble.json`/`sweep.json` 空文件解析错）改动前后逐字节一致，与本批无关，未处理 | ✅ 已落地 | `js/behavior/Motor.js`；`js/behavior/BaseStateMachine.js`；`scripts/check-invariants.mjs`；`docs/contracts/movement.md`；`docs/contracts/movement-dataflow.md`；`CLAUDE.md` |
| L-2（循环相位改为距离驱动） | `ClipLibrary.resolve()` 新增 `groundTravel`（骨架单位/循环）：cycle clip JSON 显式声明优先，未声明则自动推导——逐帧转场取贴地关节（y 与地面线 `y=0` 之差 ≤1 骨架单位；**不是**相对"该 clip 实际达到的最大 y"，后者会被单帧 1~2 单位入地噪声带偏基准，run.json 实测踩过这个坑）中 Δx 最小值（最负者=真正支撑脚）沿循环累加；推导值绝对值 <8 判定非位移循环（stand/sit/chess 等保持时间驱动，这是判据不是兜底）；按贡献关节名分左右（`l_/fl_/bl_` 左，`r_/fr_/br_` 右）各累计一次，相对偏差 >20% 视为 clip 缺陷并抛出（新增 `check-invariants.mjs` Rule 16 同判据静态门，运行时抛出因此总被静态门先拦下；已做咬合验证：临时把 walk.json frame0 的 `l_foot` x 改动 15 单位，规则从 `walk: groundTravel=96 left=48 right=48 diff=0%` 变 FAIL，验完已用 `git checkout` 还原）。`bike`(470)/`walk_front`(96)/`dog_walk`(55，临时值，见下)三个 clip 无法/不宜自动推导，显式声明绕过。顺带修正：`fps` 此前只取 `keyframes[0].dur` 算一个全局值，后续每帧 dur 全部丢弃；新增 `_buildFrameCumFrac()` 保留每帧 dur 建累积时间表（`frameCumFrac[i]`=该帧开始前占循环的累积占比），现存 clip 的 dur 全部同值故不改变现有播放，是面向未来非均匀 dur 的正确性修复。`Npc.js#update()` 新增距离驱动分支（`anim.kind==='cycle' && anim.groundTravel` 时生效）：相位=`(phase + 实际位移模长/(groundTravel×scale)) % 1`，查 `frameCumFrac` 表映射 frameIndex；`phase`/`phaseAnchorX`/`phaseAnchorY` 是 Npc 自记的新字段（不向 Motor/BehaviorManager 取，避免帧内顺序耦合），跨 clip 切换不清零（相位是连续的步频概念）；其余 clip 的时间驱动路径（`frameTimer`/`anim.fps`）原样保留。**过程发现并经用户确认修正**：`run.json` 原始数据左右脚贴地时长严重不对称（差值 30%~45%，任何容差都过不了 20% 一致性判据），用户判断是该 clip 动作幅度画得太平淡，重画后左右差降到 17%，通过；重画同时使 `validate.mjs` 已有的 cycle 首末帧闭合 WARN（非本批新增检查项）数值变大（`r_foot` Δ 15→25px，新增 `l_foot` Δ17px 一条），级别仍是 WARN 不是 ERROR，未处理，留给以后。`dog_walk`：所有腿关节 y 全程 -2~-9 从不触及 `y=0`，自动推导贴地判据零候选、`fl_lower`/`br_lower` 强行推导会给出矛盾位移，本批不修 clip 数据，显式声明 55（狗身长约 50，步幅约等于身长），CLAUDE.md 登记"待重画"。`dog` 骨架同 commit 补 `unit_height:50.2`（取自 `joints.body_front.len`，语义是身长非身高，纯声明性字段同 A-2 无消费者）。`sth/tools/validate.mjs` WHITELIST 加入 `groundTravel`。四门以改动前基线差分核对：check-invariants 除新增 Rule 16（全绿）与 Rule 4 的 run.json meanX 数值变化（2.79→3.53，仍 <4 ✓，因用户重画 run.json）外零差异；validate.mjs 的 `new_assets/sweep.json` 在本批开始前已被外部并发编辑填入内容，错误数 2→1 与本批无关（对比法同 L-1，已用 git stash 逐项核实） | ✅ 已落地 | `js/core/ClipLibrary.js`；`js/npc/Npc.js`；`scripts/check-invariants.mjs`（Rule 16）；`sth/tools/validate.mjs`；`assets/animations/cycle/{bike,walk_front,dog_walk,run}.json`；`assets/skeleton.json`；`CLAUDE.md` |
| L-3（竖直移动切换 _front clip） | `walk_front`/`stand_front`/`idle_front`/`squat_front` 此前已在 manifest 注册但全库零消费点（`PoseCacheBuilder` 的 front/side 配对只服务 `kind==='overlay'` 的 trait，这几个是 `kind==='cycle'`，落不进去）。选址复用 L-1 朝向的同一处（`Motor.js#integratePhysics`，`_slideMove` 写入之后），新增 `_updateFrontVariant(npc, dx, dy)`：独立的 `mot.frontAccDx/frontAccDy` 死区累加器（不复用 `mot.faceAcc`——它的清零时机绑定朝向翻转，混用会产生不受控耦合），越过 `SAFETY_RULES.facing.deadZone × npc.scale`（复用 L-1 阈值，未新增）才判定一次「本段以竖直/水平位移为主」，按 `\|累计dy\| > \|累计dx\|` 选 front/side，随后累加器清零。变体配对显式登记在 `FRONT_VARIANTS`/`SIDE_OF_FRONT` 表（新增变体需在此登记），实际是否切换看 `clipLibrary.manifest.clips[targetId]` 存在性查表（查表不是兜底），只在 `walk`/`run`/`jog`/`ride` 四态生效——`stand`/`squat` 是 `speedK:0` 静止态，`mot.vel` 从不被设置，本机制天然不会经过它们，`stand_front`/`squat_front`/`idle_front` 因此仍是未被本批实际接通的候选（不在本批范围内，只有 `walk_front` 被验收要求接通）。切换时 `npc.phase`/`npc.frameIndex` 归零（walk 20 帧/walk_front 13 帧，帧数不同且两变体帧未必逐帧姿势对应）。Motor.js 新增 `import { clipLibrary }`（该文件零导入，不产生循环依赖）。**实现过程记录**：最初用字符串拼接（`baseId + '_front'`）动态算变体 id，逻辑更通用但导致 `grep walk_front js/` 只命中注释，不满足验收「非注释命中」；改为显式配对表后 `walk: 'walk_front'` 成为真代码行，问题解决——留痕供以后类似"验收要求字面量可见"的场景参考 | ✅ 已落地 | `js/behavior/Motor.js`；`CLAUDE.md` |
| U-1（接触量改用骨架单位，C-2 前置） | `TalkActivity.js#_startSubEvent` 曾把 `cfg.designGap`（`PoseCacheBuilder.decodeSubEvent` 输出，编辑器坐标即骨架单位，默认 70）直接当世界像素用，近侧 scale≈0.262 时 70 骨架单位应渲染成 18px，实际站开了 70px，约 4 倍，且错的倍数随 y 变。改为消费时乘 `(a.scale + b.scale)/2`（两人常不在同一深度，取平均）。`PoseCacheBuilder.js#decodeSubEvent` 的 `designGap` 输出行注释改写，明确标注单位为骨架单位、编辑器坐标与骨架坐标同空间（原注释误写"70px"）。同 commit 在 `docs/design-plans/duet-interaction-design-v1.md` 补「单位约定」章节，写死 C-2 的所有接触量（配对行走目标距离、接触判定阈值、reach 距离）一律骨架单位、消费时乘 `npc.scale`，世界像素不是合法单位；删除 D4/D7 两处"≤2px"估计值（同一类错误：只在编辑器画图假设的那一个深度成立），改为占位说明「阈值骨架单位，具体数值待 D-2/D-7 实现时校准」，不预先猜一个数字。四门以改动前基线差分核对：零差异（本批不触碰 clip JSON / check-invariants / validate.mjs 逻辑） | ✅ 已落地 | `js/behavior/activities/TalkActivity.js`；`js/behavior/PoseCacheBuilder.js`；`docs/design-plans/duet-interaction-design-v1.md` |
| U-2+U-3（walkSpeed/到达阈值改骨架单位 + 单位规则入法） | **迁移基准**：近侧人行道有效 scale 0.262（`depthScale(NEAR_Y)=0.308 × human.skeletonScale 0.85`），该深度换算前后行为不变。`npc.walkSpeed` 语义改骨架单位/秒：`BehaviorManager.js#register` 的 `rand(20,34)` → `rand(76,130)`（20/0.262≈76、34/0.262≈130）；`npc.speed` 仍是世界像素/秒，但不再只在 `setState` 算一次——`setState` 把 `def.speedK` 存进新字段 `mot.speedK`，`Motor.js#integratePhysics` 每帧用当帧最新 `npc.scale` 重算 `speedK×walkSpeed×scale`（scale 随 y 连续变化，一次性快照会随深度漂移过期），Motor 仍是唯一写入点（`_mw`）。`SteeringDecision.js#ARRIVAL_RULES` 五条 threshold 改骨架单位：`nav_waypoint 8→30`、`walk_goal 6→23`、`bench_radius 80→305`、`exit_building 20→76`、`exit_offworld 8→30`；`arrived(ruleId, dist, scale)` 新增第三参数，内部 `threshold×scale` 再比较，两处调用点（`BaseStateMachine.js#steerRoam`）与 `UseBenchTask.js` 两处直接消费 `bench_radius.threshold` 的调用点均已传入/乘 `npc.scale`。`BaseStateMachine.js#steerRoam` 的 `total`（走向路点的目标速度）、`WalkMode.js#checkZoneTransition` 的弹出 `vy`、`_routeToExit` 的超时估算分母，三处 `npc.walkSpeed` 消费点同步补乘 `npc.scale`；`_routeToExit` 的兜底常数 26→99（同一 0.262 基准换算，专用于防除零，正常路径不会触发——`register()` 保证已注册 NPC 的 `walkSpeed` 恒非空）；其余 3 处 `\|\| 26` 全部移除（不留软兜底，`register()` 调用顺序保证 `walkSpeed` 先于任何 `setState` 设好）。`Athletes.js`/`CyclistSpawner.js` 的 `speed` 配置一并换算（60→229、66→252、rand(95,120)→rand(363,458)、rand(110,130)→rand(420,496)），`scene.json` 新增 `_speedUnit` 字段标注单位。U-3：`check-invariants.mjs` 新增 Rule 17，静态门 `ARRIVAL_RULES`（`SteeringDecision.js`，全部条目含 `threshold`，逐行必须命中"骨架单位"）、`SAFETY_RULES`（`Motor.js`，已知长度字段名白名单 `baseRadius/deadZone/probeCells/rotProbeCells/nearCells` 命中即要求同行标注，非长度字段如 `rotateDeg/slowFactor/speedK/atScale` 不要求）、`PoseCacheBuilder.js`（`designGap` 声明行前 5 行内需命中）；规则注释指名引用 `BehaviorManager.js#_separate` 的 `baseRadius*(scale/atScale)` 为正确范式。已做咬合验证：临时在 `ARRIVAL_RULES` 加一条无标注的 `threshold` 条目，规则从全绿变 FAIL，验完删除还原。四门以改动前基线差分核对：check-invariants 除新增 Rule 17（全绿）外零差异；check-behavior-data/check-witness-distribution/validate.mjs 与前一批状态逐字节一致——`check-witness-distribution` 仍全绿，`Perception.js` 的视/听距硬截断是另一套量，本批未触碰、未受影响 | ✅ 已落地 | `js/behavior/BehaviorManager.js`；`js/behavior/Motor.js`；`js/behavior/SteeringDecision.js`；`js/behavior/BaseStateMachine.js`；`js/behavior/WalkMode.js`；`js/behavior/tasks/UseBenchTask.js`；`js/entity/vehicle/CyclistSpawner.js`；`js/npc/Athletes.js`；`assets/scene.json`；`scripts/check-invariants.mjs`（Rule 17）；`docs/contracts/movement.md`；`CLAUDE.md` |
| U-2b+U-2c（速度换算基准重校准 + movedLT 补债，用户反馈驱动） | **触发**：用户报告"走路速度看着完全不对，很缓慢，有的像撞了空气墙卡死"。**根因排查**：U-2 选的换算基准点 `NEAR_Y`（y=333，机动车道边界，scale 0.262）不是 NPC 实际漫游区——`CLAUDE.md` 明确 NPC 漫游区是远人行道（y≈240）和公园（y≈370–490）；远人行道实际有效 scale 仅 0.188（`depthScale(240)=0.221 × human.skeletonScale 0.85`），比基准低 28%，导致该区域步速比重构前慢约 30%（14–24px/s vs 原 20–34px/s，公园区因 scale 高于基准反而略快，不是全场均慢）。同时 `RECOVERY_RULES.progress_monitor.movedLT`（Motor.js，判定"1.5 秒内位移 <15px 视为卡死"）在 U-2 时被显式排除在换算范围外、仍是裸世界像素常数；U-2 把速度改骨架单位后，低 scale 区实际位移下降，一旦叠加 `SAFETY_RULES.lookahead.slowFactor=0.4` 的近墙减速（14–24 × 0.4 = 5.7–9.8px/s，1.5s 最多移动 14.7px），**必然**跌破 15px 阈值——NPC 一靠近障碍物/墙就被误判卡死触发重规划，重新贴回同一障碍物又立刻再触发，观感即"贴墙抖动/完全走不动"。**修复**：①换算基准从 `NEAR_Y`（0.262）改为主漫游区 `SIDEWALK_FAR_Y`（0.188），`BehaviorManager.js#register` 的 `rand(76,130)`→`rand(106,181)`（20/0.188≈106、34/0.188≈181），`Athletes.js`/`CyclistSpawner.js`/`scene.json` 里已换算的速度值同步按新基准重算（229→319、252→351、rand(363,458)→rand(505,638)、rand(420,496)→rand(585,692)）。②`Motor.js#RECOVERY_RULES.progress_monitor.movedLT` 改骨架单位并消费处乘 `npc.scale`（15/0.188≈80），带单位标注注释。`check-invariants.mjs` Rule 17 扫描范围扩至 `RECOVERY_RULES`（`LENGTH_FIELDS` 加入 `movedLT`，与 `SAFETY_RULES` 同用 Motor.js 一次扫描），`CLAUDE.md` 移除 movedLT 排除条目、补记 U-2b/U-2c。`ARRIVAL_RULES` 的 threshold 未一并重新校准——它们消费时按当帧 scale 换算成世界像素是设计意图内的相对量（到达判定该随 NPC 屏幕尺寸缩放），不像 walkSpeed/movedLT 那样有"全场恒定观感"的预期，本批不动。运行验证仅静态门（check-invariants Rule 17 全绿），未跑游戏实测（遵循默认禁止运行的项目约定）| ✅ 已落地 | `js/behavior/BehaviorManager.js`；`js/behavior/Motor.js`；`js/npc/Athletes.js`；`js/entity/vehicle/CyclistSpawner.js`；`assets/scene.json`；`scripts/check-invariants.mjs`（Rule 17）；`CLAUDE.md` |
| U-2d（补漏，真正主因；用户反馈"改了没用"驱动） | **触发**：用户测试 U-2b/U-2c 后反馈"还是不行，效果和之前差不多"。**根因排查**：重新沿 `bm.register()` 的两个分支反查——`BehaviorManager.js#register` 是 `npc.walkSpeed = npc.speed > 0 ? npc.speed : rand(106,181)`，U-2/U-2b 只换算了**兜底分支**（`rand(...)`），但 `grep 'speed:\s*\d'` 发现全库绝大多数 NPC 走的是**前一条分支**：`Pedestrians.js#spawnOnePedestrian`（`const speedRange = profile?.speedRange ?? [20,34]` 取自 `NpcProfile.js` 的 `PEDESTRIAN.speedRange:[20,34]`/`BUSINESSMAN.speedRange:[28,40]`/`TOURIST.speedRange:[16,26]`，`CHILD` 继承 `PEDESTRIAN`），覆盖 `pedestrians`（18 个）/`park_idlers`/`Director.js` 动态补充三处调用点——即游戏里绝大多数行人；另外 `DogWalker.js`（owner `speed:26`）、`sceneFeatures.js` stall_sellers（`speed:28`）同款字面量。这些值全部还是 U-2 之前的世界像素常数，从未跟着 U-2 换算，`register()` 把它们原样当骨架单位塞进 `walkSpeed`，实际速度只有设计值的 1/5～1/7（3–14px/s，而非 U-2b 修复后该有的 20–34px/s）——是"看着几乎不动/贴墙卡死"的真正主因，且不限于远人行道，是全场性的（U-2b/U-2c 处理的兜底分支和卡死阈值只是次要放大因素，从未被实际触发）。**修复**：`NpcProfile.js` 三档 `speedRange` 按 U-2b 同一基准（0.188）换算：`[20,34]→[106,181]`、`[28,40]→[149,213]`、`[16,26]→[85,138]`；`Pedestrians.js` 的防御性兜底 `[20,34]→[106,181]`；`DogWalker.js` owner `speed:26→138`；`sceneFeatures.js` stall_seller `speed:28→149`。**教训（已写入 CLAUDE.md）**：迁移"默认值兜底"类常数前必须先确认默认值分支是否真的会被触发，不能只改字面量出现的那一处。四门：check-invariants.mjs（除既有 Rule 2 未跟踪文件失败外全绿）、check-behavior-data.mjs 全绿；未跑游戏实测 | ✅ 已落地 | `js/npc/NpcProfile.js`；`js/npc/Pedestrians.js`；`js/npc/DogWalker.js`；`js/scenes/sceneFeatures.js`；`CLAUDE.md` |
| A/B/D/E/F/G/H/C（Activity 五 phase 契约化 + prop-as-host + WaitBus 单人移出，用户 tasks.md 批次，2026-08-07） | 单人道具使用移出 Activity（Patch A，`UseSmartPropTask`）；talk 播随机说话手势（Patch B）；旁观者移出 ChessActivity 成员制（Patch D，`ChessOnlookerTask`）；五 phase 契约化 admit/dismiss（Patch E）；Chess 动画换 ClipPlayer（Patch F）；`push`/`give_item`/`handshake`/`point_at` 从 TalkActivity 抽成独立 `ContactActivity`+`DuetStager`（Patch G）；stall 卖家独自守摊移出成 `StallSellerTask`，`StallActivity` 只在买家已到位时才 Create（Patch H，prop-as-host）；等车移出成单人 `WaitBusTask`，删除 `WaitBusActivity`（Patch C）。过程中顺带发现修复：`human_pet_dog` 误入 talk sub_event 池报错、Patch F 引入的 chess 落子姿势渲染错位、走路卡住两个独立成因（到达判定用错点/到达容差超障碍物安全边）。**本批次落地时未同步写入本表**（当时判断 `docs/roadmap.md` 是历史台账、按惯例只在有明确要求时追加），本行是事后补记，细节见各 patch 自身 commit message 与 `docs/contracts/activity-lifecycle-v1.md`/`docs/contracts/behavior.md` | ✅ 已落地（commit `2b16814`/`a41041b`/`ffab96d`/`4ac4343`/`7841002`/`99889d4`/`f41db04`/`7427999`） | `js/behavior/activities/`；`js/behavior/tasks/StallSellerTask.js`；`js/behavior/tasks/WaitBusTask.js`；`js/behavior/DuetStager.js`；`docs/contracts/activity-lifecycle-v1.md`；`docs/contracts/behavior.md` |
| W-8（TalkActivity 接触权重三缺陷修复，tasks.md P-1） | 缺陷 1：`_selectSubEvent` 读的 `this.a._profile` 在 npc 上从不存在（`_profile` 只是 `Agenda` 类实例的私有字段），`w` 恒为空对象，四种接触类型全部落到 `?? 0.05` 兜底，`NpcProfile.js` 四个 profile 各自声明的 `socialWeights` 从未生效——改读 `npc.mem('agenda').profile`，删除 `?? 0.05` 兜底（权重缺失即视为 0，不给隐性默认值）。缺陷 2：`_selectSubEvent` 原是"遍历 `Object.keys()`、第一个掷中就 return"，由插入序决定优先级而非真正加权抽样；改成一次性加权抽样：`total=Σweight` 即本轮发生接触的概率（`total≥1` 时 `chance()` 天然恒真），发生后按权重比例选具体类型。缺陷 3：`SocialLayer.js#_tryPairTalk` 的 `a._activity \|\| b._activity` 判据读取 npc 上不存在的裸字段、恒假，且与同函数前面已做过的 `mem('social').activity` 过滤重复，直接删除；连带三处陈旧注释（`SocialLayer.js` 头部、`TalkToTask.js` 两处）改用正确字段名。四门全绿；`_profile` 全库仅存于 `Agenda.js` 内部，`._activity` 全库零命中；未跑游戏（纯逻辑修复，不改变可观察分布形状，只改变此前从未生效的权重现在真的生效） | ✅ 已落地 | `js/behavior/activities/TalkActivity.js`；`js/behavior/SocialLayer.js`；`js/behavior/tasks/TalkToTask.js` |
| W-9（接触掷骰周期化 + socialWeights 重标定，tasks.md P-2） | 依赖 W-8（权重读取路径修复后才谈得上标定数值）。`TalkActivity.update()` 的掷骰调用点从"只在 `timer>=duration` 那一帧掷一次"改成"每 `SUB_EVENT_ROLL_INTERVAL=3` 秒掷一轮"（新增具名常量，注释写明依据：duration 是 rand(8,18)，3 秒周期让一场对话摇 2~6 轮）；`REACH_SLACK` 距离否决保持不变，但用 `this._followUp` 是否被设置判断这一轮是不是真正 handoff 成功——否决只当没掷中，继续说话等下一轮，不提前结束对话。`NpcProfile.js` 四个 profile 的 `socialWeights` 按统一比例 ×0.6 从旧值换算（旧值是"整场对话掷一次"口径，周期化后总命中率会暴涨），保留各 profile 内部/之间原有的相对高低关系；每处附新口径说明注释。用纯 Monte Carlo 概率计算（不涉及游戏/harness，200000 次抽样）核实：pedestrian/businessman/tourist 单场对话产出至少一次接触的概率落在 37.9%~40.6%，命中"三成到一半"目标；chess_onlooker 26.9%，略低于下限但符合"它本来就是四档里最低"的既有相对关系，未强行拉到 30% 以上破坏统一缩放比例的整洁性。四门全绿；未跑游戏 | ✅ 已落地 | `js/behavior/activities/TalkActivity.js`；`js/npc/NpcProfile.js` |
| W-10（Chess 加事件发出点，tasks.md P-3） | 打破"唯一事件生产者是 TalkActivity 系"。`EventDefs.js` 新增 `chess_move: {actorRoles:['mover','opponent'], category:'social'}`（下棋是双方合意的日常互动，不带攻击方向性，故归 `social` 而非 `conflict`，注释写明理由）。`ChessActivity.update()` 在既有的回合切换点（`waitMs>=CHESS_WAIT_MS`，落子动画播完+等待到期）以新增具名常量 `CHESS_EVENT_PROB=0.1` 的概率发一条 `chess_move`，actors 第一位是切换前 `this.active` 对应的落子方、第二位是对手；概率调低是因为一局棋回合切换数十次，逐回合发会刷爆 `EVENT_LOG_CAP=500` 且让证词被下棋淹没。不改 ChessActivity 的动画/回合逻辑本身，不改 ClaimDecisionTables.js（新 kind 走同一套 q→填槽表）。四门全绿；未跑游戏 | ✅ 已落地 | `js/behavior/activities/ChessActivity.js`；`js/behavior/data/EventDefs.js` |
| W-11（补齐 stall 买家路由 + 交易事件发出点，tasks.md P-4） | 核实 tasks.md 转述属实：`'stall_buyer'` 早就在三个 profile 的 `activities` 里声明、`StallActivity.js` 的 `onSlotArrival` 钩子也早就写好"买家到位就凑满 roster 创建双人 Activity"，但没有任何代码真的调用 `SocialLayer.onSlotArrival()` 把买家送到那个槽位——纯粹的死连接，不是新架构缺失。补法：新增 `StallBuyerTask.js`（形状抄 `UseSmartPropTask` 的 goto 阶段，`findAvailableSlot('stall', npc, 250, {role:'buyer'})` 找槽位后另外核实 `prop._stallSellerTask?.npc?.alive` 只挑"已有卖家守摊"的摊位——不能用 `findAvailableSlot` 的 `requireOccupied` 选项，那查的是 `prop._occupiedBy`，是 `UseSmartPropTask`（vending/trash）专用的单人占用标记，`StallSellerTask` 从不写它，误用会让该选项在 stall 上恒为空；到达后不自己演动作，直接调 `envQuery.socialLayer.onSlotArrival()` 交给既有钩子接手）；`ChainTask.js#USE_WHITELIST` 加 `stall_buyer` 条目；`BehaviorScripts.js` 加同名脚本（单步 `{op:'use', task:'stall_buyer'}`）；`NpcProfile.js` 的 pedestrian/businessman/tourist（child 继承 pedestrian）desires 数组补上 `'stall_buyer'`（此前只在 `activities` 声明，从未进过真正驱动路由的 `desires` 池，是路由死连接的另一半）。`BehaviorManager.js` 构造函数挂 `this.envQuery.socialLayer = this.socialLayer`——`envQuery` 是所有 Task/Agenda 共有的依赖，`StallBuyerTask` 借这条既有穿透点拿到 `socialLayer`，不新开参数链路。交易事件：`StallActivity._tickBuyer` 的 `'give'` 阶段两个 `ClipPlayer` 都播完那一刻发 `stall_trade`（`EventDefs.js` 新增，`category:'social'`），一场交易只发一次不降频。顺带给 `check-behavior-data.mjs` 加新校验：`profile.activities` 每条都须能在代码里找到实现（`BEHAVIOR_SCRIPTS` 条目 / 静态扫描到的 `registerActivity()` 类型 / 显式登记的 `DIRECT_TASK_WHITELIST` 直连 Task 例外）——跑起来额外抓到一个既有悬空条目：`CHESS_ONLOOKER` profile 的 `activities` 里 `'chess_watch'` 全库无任何实现（该 npc 类型实际路由是同数组里并存的同名 `'chess_onlooker'`，`chess_watch` 是命名历史遗留的死声明），经用户确认后直接删除该条目，不做兼容映射。四门全绿；未跑游戏 | ✅ 已落地 | `js/behavior/tasks/StallBuyerTask.js`；`js/behavior/tasks/ChainTask.js`；`js/behavior/data/BehaviorScripts.js`；`js/npc/NpcProfile.js`；`js/behavior/BehaviorManager.js`；`js/behavior/activities/StallActivity.js`；`js/behavior/data/EventDefs.js`；`scripts/check-behavior-data.mjs` |
| W-12（DuetStager 不再绕过 BLOCKED 兜底，tasks.md P-5） | M-1 删掉三层反应式避障后 `Motor.js#_slideMove` 是文档明文的唯一"绝不踏入 BLOCKED 格"硬兜底，但 `DuetStager._setX`（reach/play/release 三段位置插值）走的是 `Motor.setXY`——一个合法的 Motor.js API（不违反 Rule 9 的写保护门），却是绝对坐标裸写，从 `_slideMove` 的安全网旁边绕了过去，Patch G 落地以来一直如此，此前没人记录过这个缺口。改法：`_setX` 换成算好增量后调 `nudgeXY`（`_slideMove` 的对外壳）——两处语义差别都处理了：① 原来收绝对目标 x，现在内部用「目标 x − 当前实际 x」现算位移量喂给 `nudgeXY`；② `release` 阶段末尾和 `cancel()` 把 NPC 复位回 `_aOrigX`/`_bOrigX` 现在也走 `nudgeXY`，若复位路径上有阻挡可能到不了——按指示明确不为此加特例回退到 `setXY`（那样又会重新绕开兜底），到不了就停在能到的地方是正确行为，已写进文件头注释。`movement.md` 补了一段此前从未记录过的"`setXY` 与 `nudgeXY` 的 BLOCKED-avoidance 分野"历史注记（P-5 gap analysis），把这个长期存在但没写进契约的缺口和它的修复一并记录。不改 `Motor.js` 的 `setXY` 本身（`jaywalk_sprint`/`seat.js`/`StallSellerTask` 兜底等其他消费者还在用，这些场景需要精确落点、刻意不走安全网）、不改 `_slideMove` 实现、不改 `ContactActivity` 的 eject 逻辑。四门全绿；未跑游戏 | ✅ 已落地 | `js/behavior/DuetStager.js`；`js/behavior/Motor.js`（注释更新）；`docs/contracts/movement.md` |
| W-13（记忆变异层 + 第五个静态门，tasks.md P-6） | 实现 `witness-memory-v1.md`"复述使信念变强 / 记忆随时间失真"那部分。新增 `js/behavior/data/MemoryMutationTables.js`（声明式数据）：`MUTATION_TABLE` 数值原样照抄该文档第四节"Mutation 转移表"（四档 stay/distort/transfer/forget，每行和 1.0），`effectiveMutationProbs(slot,strength)` 在此之上叠加 strength 抗性——`STRENGTH_DECAY` 指数衰减"非不变"总概率、`STRENGTH_FLOOR` 兜底不完全免疫；`FABRICATE_PROB` 是原表没有的第五档，只对空槽（`sources[slot]===null`）生效。`Belief.js` 新增 `evolveMemory(npcs,ticks)`：对每条 claim 的每个槽独立掷一次——遗忘（值退 null，`sources`/`strength` 同步清空，重新变回 `injectSuggestion` 的注入口）、变形（`slotFidelity()` 新导出的纯字符串形状判定 fine→coarse 退化一档，复用既有 `_actorFidelityValue` 等序列化格式，不新发明一套；`action` 走 `EVENT_DEFS` 存在性判定，`time` 走新增的 `_timeToBucket`——`witness-memory-v1.md` 第一节早就声明了 time 有 `just_now`/`a_while_ago`/`long_ago` 三档粗粒度，只是此前从未有代码产出过）、转移（换成同一 NPC 的 `allClaims` 参数里别的 claim 同槽的值，作用域由调用方天然限定，不会跨 NPC；无同 NPC donor 则本轮放弃）、虚构（空槽自发填值，`sources` 标 `'fabricated'`——`Belief.js` 头部 CONTRACT 注释同批更新 `sources[slot]` 取值集合从 `'witness'\|'suggested'\|null` 扩到多一档；取值池分别借用 `NpcProfile.js#PROFILES` 键、`EVENT_DEFS` 的 category 去重集合、`ZONE` 键去掉 `BLOCKED`、time 桶名三选一）。周期常量 `MEMORY_EVOLUTION_INTERVAL_MIN`（游戏分钟非实秒）；`BehaviorManager.js` 新增帧序 1.6：用 `gameClock()` 帧间差值换算游戏分钟攒计时器触发（`movement-dataflow.md §1`/`contracts/behavior.md` 同步补记这一步）；`evolveMemory` 本身不持有计时状态，直接收 `ticks` 整数，供 P-8 调试面板"时间快进"直接算好 ticks 调用、不触碰 GameClock。新增第五个静态门 `scripts/check-memory-mutation.mjs`（形态照抄 `check-witness-distribution.mjs`）：场景①用 1000 个零 strength 的合成 claim 验证保真率随 ticks 推进单调下降且降速放缓（15/30/60 tick 三个检查点，实测 1.000→0.116→0.016→0.000）；场景②对比 strength=0 与 strength=10 两组 500 人样本在同样 20 tick 后的"槽值原样未变"存活率（实测 0.044 vs 0.640，差距 > 0.3 判定通过）；场景③两个带专属前缀的合成 NPC（各 6 条 claim）跑 300 tick 后断言零跨 NPC 串号、且确有槽值发生变化（阳性对照，避免测试因从未触发变异而假通过）。`witness-memory-v1.md` 同步：头部追加 v1.2 记录、第一节 `sources` schema 加 `'fabricated'`、第四节标题下加"已接线"说明（触发时机是`evolveMemory` 的周期性演化，不是原先设想的 NPC 间复述传播/SIR——两者概念不同，只是共用同一份先验数值，未来真做 SIR 时不应默认复用不重新论证）。CLAUDE.md"静态门"从四个改成五个并列出脚本名，Belief.js 一节补 `evolveMemory` 描述。五门全绿；未跑游戏。不改 `Perception.js`/`ClaimDecisionTables.js`/`selectWitnesses()` 目击者数量逻辑（`check-witness-distribution.mjs` 复跑确认仍全绿）、不改 `injectSuggestion` 既有语义 | ✅ 已落地 | `js/behavior/data/MemoryMutationTables.js`；`js/behavior/Belief.js`；`js/behavior/BehaviorManager.js`；`scripts/check-memory-mutation.mjs`；`CLAUDE.md`；`docs/design-plans/witness-memory-v1.md`；`docs/contracts/behavior.md`；`docs/contracts/movement-dataflow.md` |
| W-14（报道回流，tasks.md P-7） | 闭合"框架建构现实"：玩家发表的报道写回 NPC 的信念。依赖 W-13（回流写入的槽要走同一套 strength 演化）。先补一块地基缺口：`Belief.js#_fillClaim` 新增 `eventId` 字段（固定为 `WorldEventLog` 的 `event.id`），不属于 `SLOTS`、不受 `evolveMemory`/`injectSuggestion` 任何写入点改写——此前 claim 完全没有办法判断"两个不同 NPC 的 claim 是不是在说同一个事件"，`time` 字段会被 P-6 的变形/遗忘改写，不是稳定的关联键。新增 `js/news/NewsBackflow.js#propagateArticleToWitnesses(witnesses)`：按 `eventId` 把"本次报道贡献了 testimony 的目击者"分组，组内互相拿对方已确立的槽值去补自己还空着的槽（复用 `Belief.js#injectSuggestion`，来源标 `'suggested'`——报道和审问诱导认识论上是同一件事，不新开一种 source 值；不建新 claim，`injectSuggestion` 既有硬约束原样生效）。传播范围规则声明式表 `MemoryMutationTables.js#NEWS_BACKFLOW`（`maxFillsPerArticle` 单次上限）：只影响本来就对同一事件有 claim 的 NPC（这批目击者自身），不外溢给旁观者——tasks.md 给出的两个候选规则里，"事件发生地附近"那个需要给非目击者新建 claim，与 `injectSuggestion` 的既有语义冲突，未采用。唯一调用点在 `NewsUI.js` 的发布按钮（`this._archive.publishArticle(article)` 之后紧接着调），新增 `check-invariants.mjs` Rule 18 守住单一住址（同 Rule 15 对 `generateClaims()` 的做法）。第五个静态门加场景④：两个共享 `eventId` 的合成目击者互相缺对方那个槽，回流后 `sources==='suggested'` 数量从 0 增至 2；另建 800 人两组对照（`strength` 相同、来源分别是 `'suggested'`/`'witness'`）跑同样 tick 数，存活率差距 < 0.1（实测 0.237 vs 0.256）证明回流槽没有被代码特殊豁免。`witness-memory-v1.md` 同步：头部 v1.2 记录补一句、第一节 schema 加 `eventId` 字段说明、第七节追加"`injectSuggestion` 第二个调用方"小节。五门全绿；未跑游戏。不改 `providers` 层提示词、`NewsUI` 既有交互（除新增这一行回流调用） | ✅ 已落地 | `js/news/NewsBackflow.js`；`js/news/NewsUI.js`；`js/behavior/Belief.js`；`js/behavior/data/MemoryMutationTables.js`；`scripts/check-invariants.mjs`；`scripts/check-memory-mutation.mjs`；`docs/design-plans/witness-memory-v1.md`；`CLAUDE.md` |

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

~~遗留：`check-invariants.mjs` Rule 8 的三个字段名已全部消失，规则变为空守卫（恒绿），待 Z-2 系列改写。~~ 已在 M-1 改写，见下表「M-1」行。

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

---

### SE-1（编辑器 duet 导出修复）— 已落地

`exportJSON()` duet 分支导出的 JSON 缺 `kind` 字段，重新粘贴导入时 `_loadClipData` 的
`isDuet` 检测（依赖 `kind==='overlay'`）永远判定失败；同一分支给每个 role 编码
关节时也没respect `allowedJoints`，只编辑了 2 个关节的 role 会把其余全部关节的
零值噪声（依 defaultPose 微小偏差）一并写进导出 JSON。

- **`kind: 'overlay'`**：补进 duet 分支导出的顶层 `data` 对象，与 `participants` 同级。
- **`allowedJoints` 过滤**：`_encodeKfForSkel()` 编码结果在写入 `kf[roleInfo.role]` 前，
  若 `roleInfo.allowedJoints.size > 0` 则只保留落在该集合内的关节 key（`allowedJoints`
  本身已在 `_enterDuetMode` 载入 clip 时从既有 keyframes 反推出来，本次只是导出侧第一次
  真正用上它）。

代码锚点：`sth/stick-puppet/js/app.js#exportJSON`

---

### SE-2（多帧 sub-event 播放 + dx 位置同步）— 已落地

`decodeSubEvent` 此前只读 `keyframes[0]` 产生一对静态 `aDelta`/`bDelta`，`TalkActivity`
用 reach → hold(静止) → release 三段播放；无法表达"一段动作"，也从不同步两个 NPC 的
站位间距。改为消费整段 `keyframes` 序列，reach → play(逐帧步进) → release。

- **`PoseCacheBuilder.decodeSubEvent()`**：不再只解码 `kf0`，遍历全部 `keyframes`，
  每帧产出 `{dur, a:{joints}, b:{joints}}`（`a`/`b` 固定对应 `participants[0]`/`[1]`，
  关节 delta 仍用既有 `abs()` 转绝对坐标）；新增 `sustain`（`rawJson.sustain===true`）
  和 `designGap`（`participants[1].dx ?? 70`，与编辑器 `DUET_DEFAULT_DX` 同值）两个
  派生字段。旧的单帧 clip 原样走同一条解码路径，退化成 `frames.length===1`。
- **`TalkActivity.js`**：`SUB_EVENTS` 每个事件类型现持有 `frames`/`sustain`/`designGap`
  （来自 poseCache）+ 各自的 `reach`/`release`/`hold`(Range)`（沿用旧配置，未删）。
  - `_startSubEvent`：记录 `_aOrigX`/`_bOrigX`，按 `designGap` 算出 `_aTargetX`/
    `_bTargetX`（中点不变，维持原本左右相对顺序）；base pose 改成取全体帧联合关节集
    （`_unionJoints`），避免后续帧出现 base 里没有的关节。
  - `_tickSubEvent` 三段：`reach` 同时 lerp 关节到 `frames[0]` 和 x 到目标位置；
    `play`（原 `hold` 改名）按 `_currentFrameDur()` 逐帧步进、直接整帧覆盖
    `_talk_sub_event` modifier 的 joints（不做帧间插值）；播完末帧后
    `sustain:false` 自动转 `release`，`sustain:true` 停在末帧不动，只能靠外部
    `destroy()` 收尾；`release` lerp 回 base 姿态与原始 x。
  - `_currentFrameDur`：帧自带 `dur` 优先；单帧旧格式落回 `hold`/`holdRange`
    （随机量 `_holdDur` 仍在 `_startSubEvent` 里预先掷好，保证同一 hold 期间数值不跳变）；
    多帧新格式缺 `dur` 落回 0.15s。
  - `push` 事件在 reach→play 边界提前 release `b`（原逻辑不变，只是改名后的同一处
    if 块）；之后任何阶段一律 `!this._pushBReleased` 守卫跳过对 `b` 的 joints/x 写入。
  - `destroy()`：无论在哪个阶段被打断（含 `sustain` 停留态），统一清 modifier +
    把 `a`/`b` 的 x 立即复位到 `_aOrigX`/`_bOrigX`（`null` 说明从未进入 sub-event，
    跳过复位）。
- **兼容性**：`push`/`give_item`/`handshake`/`point_at` 四个既有单帧 clip 不用改
  JSON——`frames.length===1` 且无 `sustain` 字段时，reach→play→release 的时长来源和
  播放效果与改动前的 reach→hold→release 逐帧等价；唯一新增的可见效果是 x 会向
  `designGap`（无 `dx` 时回退 70px）收拢再还原，这是本批新加的通用行为，不是
  遗留 bug。

代码锚点：`js/behavior/PoseCacheBuilder.js#decodeSubEvent`；
`js/behavior/activities/TalkActivity.js`；`assets/animations/new_assets/docx.md`
「多帧 sub-event overlay 格式」节

---

### SE-3（sub-event 类型/role 名去硬编码）— 已落地

SE-2 落地后 `TalkActivity.js` 里还留了两处硬编码：`SUB_EVENTS`/`build()` 给四个
固定事件类型（`push`/`give_item`/`handshake`/`point_at`）手填 `reach`/`release`，
`_selectSubEvent` 也是这四个类型的固定候选列表；`frame.a`/`frame.b` 又把 clip JSON
里任意的 `participants[].role` 字面翻译死成 `a`/`b` 两个字。新增一个 sub-event
clip（改个 role 名、调个过渡时长）此前都要连带改代码。

- **`PoseCacheBuilder.decodeSubEvent()`**：`frames[i]` 的 key 从固定 `a`/`b` 改成
  `participants[].role` 的原始字符串（`{[role]: {joints}, dur}`）；新增 `roles`
  数组（`participants.map(p=>p.role)`，按声明顺序）随结构返回；`...rawJson` 展开
  本就带出 clip 自己写的 `reach`/`release`（如果有），不用额外处理。
  `push`/`give_item`/`handshake`/`point_at` 的 role 字面量本来就是 `"a"`/`"b"`，
  纯属既有 JSON 内容的巧合，不是新规则要求。
- **`TalkActivity.js`**：删 `SUB_EVENTS`/`build()`，`SUB_EVENT_POSES`（即
  `poseCache.sub_event`）本身当唯一配置源直接读。`_startSubEvent` 从
  `cfg.roles[0]/[1]` 取 role 名存 `this._roleA`/`this._roleB`，后续所有
  `frame[this._roleA]`/`frame[this._roleB]` 按位置取值，不再认字面量
  `a`/`b`。`_selectSubEvent` 改成遍历 `Object.keys(SUB_EVENT_POSES)`，权重从
  `profile.socialWeights[type] ?? 0.05` 取——新增/删除一个 sub-event clip 只用
  改 manifest 注册和（可选）`NpcProfile.js` 的 `socialWeights`，不用碰这个文件。
  `reach`/`release` 缺省统一回退 0.4s，`_currentFrameDur` 缺省统一回退 0.3s——
  不再有 `hold`/`holdRange`/单帧特例这套按事件类型手调的隐藏参数表；
  `push` 提前 release `b` 的特判逻辑保留（那是 `push` 这个具体动作的语义，不是
  可数据驱动的通用机制）。
- **兼容性代价**：四个既有 clip 无需改 JSON 就能继续被选中、播放，但过渡/停留
  时长从原先手调的数值（如 handshake hold 1.5s）退化成统一默认值（0.4s/0.3s）——
  这是本批明确接受的代价，想恢复某个事件的原手感，直接给对应 JSON 补
  `reach`/`release`/`keyframes[0].dur` 字段即可，不改代码。

代码锚点：`js/behavior/PoseCacheBuilder.js#decodeSubEvent`；
`js/behavior/activities/TalkActivity.js`；`assets/animations/new_assets/docx.md`
「多帧 sub-event overlay 格式」节

---

### O-1（世界单位重标，删除景深缩放坡）— 已落地

斜投影线（O 系列）第一刀：世界坐标从"屏幕像素 + 随 y 变化的景深缩放坡
（`depthScale`）"改成"骨架单位、各向同性"。本补丁只换坐标系，不改画面结构——
绘制仍是平贴画法，三面体积/倾角留给 O-2 起。

- **Layout.js**：新增 `UNITS_PER_METER`(84.70588) / `PX_PER_UNIT`(0.388889，
  唯一屏幕缩放常量) / `UNIT_REBASE_FACTOR`(5.294118，迁移脚本用)；删
  `depthScale`/`_FAR_SCALE`/`_NEAR_SCALE`；`depthT` 改线性（删 `_SEG` 分段锚点，
  只喂 `depthGray`/`depthLineWidth`/`depthLineColor` 三个画风消费者）；
  `depthLineWidth` 默认值 0.8/2.2 → 2.06/5.66（除以 `PX_PER_UNIT` 补偿容器缩放）；
  `LINE_FAR_WIDTH`/`LINE_NEAR_WIDTH` 同乘 1/`PX_PER_UNIT`；world/yBands 新默认值；
  `initLayout` 不再读 `config.depth`。28 份重复的 `lenv()` 收成本文件单一
  export，各 draw 文件改 import。
- **EntityManager.js**：`e.scale = depthScale(e.y) * (e.skeletonScale ?? 1)` →
  `e.scale = e.skeletonScale ?? 1`（成人 1.0、儿童 0.694）；~15 个 `depthScale`
  直接消费点（chessTable/phonebooth/fountain/vending/busstop/drawParkPath/
  mailbox/newsrack/stall/planter/hydrant/tree/trash/seat/Chess.js/
  sceneFeatures.js/SceneInitializer.js/VehicleEntity.js）按统一规则改写：
  `const ds = depthScale(e.y)` → `const ds = e.scale ?? 1`；
  `e.scale = depthScale(e.y)…` → `e.scale = 1`（或 `skeletonScale ?? 1`）；
  footprint() 内部的 `× ds` 数值本身不变（道具几何在无量纲空间声明，绘制时乘
  `prop.scale`，O-1 起该值恒为 1，道具不需要改尺寸——只有建筑是裸世界像素、
  需要重报）。
- **建筑重报**：`building.js` `INTRINSIC`(facadeH/bDepth/bWidth) 与 `ARCH` 表的
  `floorH`/`groundMax`、`BuildingEntity.js` 默认值、`drawBuilding.js` 内部窗格/
  门/屋顶细节的位置与尺寸常量，全部 × `UNIT_REBASE_FACTOR`；裸的
  `g.lineStyle()` 描边宽度字面量不在此列（留给 O-3/O-4 盒子模板化时一并处理）。
- **车辆**：`VehicleSpawner.js` car/bus 速度 rand(70,130)→rand(706,1059)
  30~45km/h，moto rand(100,150)→rand(1059,1412) 45~60km/h；
  `VehicleStateMachine.js` 蠕行目标 15→118，停车阈值 0.5→5；`VehicleEntity.js`
  车身浮动幅度 3→10，`scale` 恒为 1（不再随车道 y 变化）。骑手/行人 speedRange
  已是骨架单位（U-2/U-2d），未动。
- **相机 + Viewfinder**：`StreetScene._applyCamera` 的 `worldContainer` 额外乘
  `PX_PER_UNIT`；`_clampScroll`/`_getWorldCoords` 同步换算。`skyContainer` 整体
  `scale` 不受 `PX_PER_UNIT` 影响（天空/云/天际线仍是画风几何，O-6 天际线平贴层
  前不重绘），但其视差位移公式的 `scrollX`/`scrollY` 现在是骨架单位，仍同乘
  `PX_PER_UNIT` 以保持"比世界慢 0.45 倍"的视觉比例——这是唯一在字面"不受
  PX_PER_UNIT 影响"之外做的补偿，理由是这里的 `PX_PER_UNIT` 是无可选择的单位
  换算而非画风选择；见 `StreetScene.js` `_applyCamera` 上方注释。
  `Viewfinder` 默认/最小/最大宽高 × `UNIT_REBASE_FACTOR`。
- **scene.json**：一次性脚本 `scripts/rebase-scene-units.mjs`（保留在仓库供
  复核）原地重写：world/yBands 换成固定新值，`depth` 顶层键整体删除；x 类
  字段（位置横坐标/宽度/半径等）× `UNIT_REBASE_FACTOR`；y 类字段走 yBands
  新旧值构成的分段线性插值表；`ry`（椭圆纵深半轴）× 7.652；`yOffset`/
  `zones.overlays[].height` 等"相对偏移/长度"字段按其锚点所在分段的局部斜率
  变换（不是绝对位置查表——在锚点上重合时按偏移方向选入段/出段斜率，两者在
  `PARK_TOP` 处相差 24%，已用任务书给定的 `overlays.height: 28→296` 验证选对
  了方向）。**`props.*.w`/`.h`（含 `at[]` 内的覆盖值）与
  `layout.sidewalkTrees`/`parkTrees` 的半径 `r` 刻意不缩放**——同建筑重报一节
  的理由，这些是"尺寸"不是"位置"。
- **NavGrid**：`CELL` 10→53，`NPC_HALF_W` 7→37；核对 `SAFETY_RULES`（`Motor.js`/
  `SteeringDecision.js`）里标注"NavGrid 格"的常量——当前实际不存在此类常量
  （`facing.deadZone` 是骨架单位，`jaywalk_sprint.speedK` 是比例），`ARRIVAL_RULES`
  的 M-1b 安全边推导前提虽随 `npc.scale` 不再随 y 变化而过期，但按新
  `NPC_HALF_W`(37) 重算两条 threshold 仍在新安全边内（16×0.85=13.6、
  14×0.85=11.9，均 < 37），未发现"对不上"，故未改动 threshold 数值，仅更新
  注释记录前提已变（`SteeringDecision.js` O-1 后记）。
- **已知遗留（未在本补丁范围内，供后续参考）**：`js/core/sceneData.js` 的
  `FAR_STOP`/`NEAR_STOP` 公交站结构常量（`roofW`/`bayD` 等）未随本补丁重报——
  任务书明确"楼是唯一要重报尺寸的实体"，且 `roofW`/`pillarOffset` 在
  `drawBusStopRoof.js` 里实际是死配置（绘制硬编码 800/30/325，不读
  `p.roofW`），只有 `bayD`（用于从 `FAR_Y` 减出停靠点）在新 y 尺度下比例上
  比旧版更贴近路缘，是个已知但很小的几何误差。`EnvironmentQuery.js` 的半径
  常数仍是世界像素，是既有已知债务（U-2c 已记录），不因本补丁扩大。
- **预期副作用（不是 bug）**：世界屏幕高度 520→约 1195px（`VIEW_H` 仍 500，
  O-2 才用倾角压回去）；街道屏幕长度 2000→约 4118px（NPC 显得稀疏，
  `Director.PERIODS` 密度本补丁不调）；`chessPlaza`/`miniPark`/喷泉的椭圆纵
  半轴用全局线性近似，O-2 见真几何后再手调。

—— 验收（grep 可查，均已过）——
`grep -rn "depthScale" js` → 0；`grep -rn "scaleFar\|scaleNear" js assets` → 0；
`grep -n "function lenv" js` → 只有 `js/core/Layout.js`；`grep -n "PX_PER_UNIT"
js/scenes/StreetScene.js` → 6 处；`assets/scene.json` 无 `depth` 顶层键，
`world.width=10588`，`world.height=3072`；四个静态门全绿。

代码锚点：`js/core/Layout.js`；`js/core/EntityManager.js`；
`js/entity/building/{building,BuildingEntity,drawBuilding}.js`；
`js/behavior/VehicleSpawner.js`；`js/entity/vehicle/{VehicleEntity,
VehicleStateMachine}.js`；`js/scenes/StreetScene.js#_applyCamera`；
`js/camera/Viewfinder.js`；`scripts/rebase-scene-units.mjs`；
`js/behavior/nav/NavGrid.js`（`CELL`/`NPC_HALF_W`）

### O-1 遗留 bug 修复（相机跟随取景框，世界/屏幕单位混用）— 已修复

O-1 落地后实机验证发现：开局、取景框静止不动时相机仍会持续向右漂移。根因在
`StreetScene.js#update()` 的"取景框离屏幕边缘太近就跟着滚"逻辑——直接拿
`vfc.x`/`this.scrollX`（世界骨架单位）跟 `this.viewW`/`margin=80`（屏幕像素）
比大小。O-1 之前 `worldContainer` 只乘 `zoom`，两个空间数值上约等价，混着比较
凑巧是对的；O-1 之后 `worldContainer` 额外乘 `PX_PER_UNIT≈0.389`，两者不再
1:1，右侧"要跟着滚"的条件因此常年成立，表现为相机不停被判定为"取景框要跑出
右边界了"而持续右移，直到撞 `_clampScroll` 的上限。已改成把取景框中心投影后
在统一的屏幕像素空间比较（O-2 落地后该处又随相机整体重写一次，见下）。
代码锚点：`js/scenes/StreetScene.js#update`

### O-2（斜投影函数 + 相机）— 已落地

斜投影线（O 系列）第二刀：绘制从"世界 y 直接当屏幕 y"改成真正的斜投影
（倾角 + shear）。本补丁只验几何——所有实体先用纯灰色占位盒子/矩形，不画
三面体积，重点是倾角、深度排序、相机高度对不对；丑是预期状态，落地后停下等
实机验收，可能会调 `TILT_DEG`/`SHEAR`。

- **新建 `js/core/Projection.js`**：全项目唯一投影住址。`TILT_DEG=20`、
  `SHEAR=0.2`（暂定值）具名常量；`toScreen(x,y)` 世界→屏幕（
  `screenX=(x+(y-BUILDING_BASE_Y)*SHEAR)*PX_PER_UNIT`，
  `screenY=(y-BUILDING_BASE_Y)*PX_PER_UNIT*sin(TILT_DEG)`）；`toWorld()` 是其
  逆变换；`toScreenLength`/`toScreenHeight`（同一函数的语义别名）只乘
  `PX_PER_UNIT`，不参与 shear/tilt——高度/宽度这类"平长度"和纵深是两种量纲，
  这条区分是整个 O 系列的核心，写在文件头注释里。另导出两个形状助手供本补丁
  和 O-3 用：`circleToEllipseRy`（圆→椭圆竖半轴）、`projectGroundRect`（地面
  矩形→屏幕平行四边形顶点，直接喂 `drawPolygon`）；`sceneScreenBounds` 算全
  场景投影后的屏幕包围盒（含最高楼屋顶余量），供 `_clampScroll` 用。
- **相机重写（`StreetScene.js`）**：`worldContainer` 不再整体乘
  `PX_PER_UNIT`——那套仿射变换被 `Projection.toScreen` 取代，容器自己只剩
  `zoom` + 相机 pan（`toScreen(scrollX,scrollY)` 的屏幕像素值）。
  `_clampScroll` 改用 `sceneScreenBounds`（含屋顶余量，`_maxFacadeH` 在
  `create()` 内楼生成完后算一次）；`_getWorldCoords`/`_screenToWorld` 改走
  `toWorld` 逆变换；取景框跟随逻辑、`_takePhoto`（截图矩形改用取景框四角投影
  后的屏幕空间包围盒——平行四边形没法直接喂 `extract.canvas`）、
  `_clampViewfinderToViewport`（视口四角反投影后的世界空间 AABB 近似）一并
  跟着改。`VIEW_H` 500→720（main.js）：倾角压缩后世界竖直方向变短，之前
  O-1 拉长后 500 只能看到一小截。
- **`SceneRenderer.js` 地面带**：`ground.bands`/`edgeLines`/道路标线（路缘/
  车道虚线/斑马线）/人行道砖缝一律经 `projectGroundRect`/`toScreen` 画成
  平行四边形/投影线段；草丛的"叶片竖起"改用 `toScreenLength`（高度，不经
  shear/tilt）而非当成纵深点投影，否则会被所在 y 的 shear 拉歪成斜线。
  `drawChessPlaza`/`drawMiniPark`/`drawParkPaths`/`drawParkPlaza`/
  `drawBusStopBays` 这五个函数本补丁不调用真正内容（还没跟投影对齐，都在
  O-4 转换清单里）——棋盘广场/迷你公园改画一个投影后的灰色占位椭圆验证位置，
  其余三个（多段折线/散布装饰）直接跳过。
- **`EntityManager.js` 占位盒子**：`draw()` 不再调用 `e.draw(g)`，改画一个
  `toScreen(e.x,e.y)` 起、`toScreenLength(footprint宽高)` 大小的灰色矩形——
  实体真实 draw 函数还是按老的容器整体缩放假设写的，没跟投影对齐，硬调用会
  在投影后的场景里显得完全错位，留给 O-3/O-4 逐个转 `drawObliqueBox`。楼是
  唯一特殊分支：接地线在 `e.y+e.facadeH`（`BuildingEntity.y` 是立面顶部，
  不是地面接触点，历史既有约定），从那往上起 `facadeH` 高。ground pre-pass
  （`drawGround`，喷泉水面/井盖）与 `extras`（NPC 手持道具）同理跳过。
- **`Viewfinder.js` 取景框渲染**：`draw()` 改画 `projectGroundRect` 出的平行
  四边形（外框、角标、命中实体高亮描边）；十字准星/拍摄指示灯/缩放手柄是纯
  UI 装饰不代表贴地几何，仍轴对齐，只是定位点换成投影后的角点。
- **`Layout.js` 线宽撤销 O-1 补偿**：O-1 曾把线宽默认值除以 `PX_PER_UNIT`
  补偿 `worldContainer` 的整体缩放（`LINE_FAR/NEAR_WIDTH` 0.8/2.2→2.06/5.66，
  `depthLineWidth`/`lenv` 同理）；O-2 撤销了那套容器缩放，这些线宽调用点若不
  跟着改回原始屏幕像素值会画粗 ~2.57 倍——已全部改回 O-1 之前的原始值。
  各 `draw*.js` 文件内部自己的线宽覆盖值（如 `drawBuilding.js` 的 0.5/1.3）
  暂不改——这些函数本补丁没在调用，留给 O-3/O-4 转换时一并处理。
- **NavGrid 调试叠层**（`window.__navDebug`）：`drawNavDebug` 的格子矩形同样
  改用 `projectGroundRect`，顺手修，不属于四个静态门覆盖范围但避免留一个
  已知会错位的调试工具。

—— 已知近似/未处理项（不是 bug，供 O-3 起参考）——
`_clampViewfinderToViewport`/`_takePhoto` 用投影后四角的屏幕空间包围盒近似
平行四边形（`extract.canvas` 只能截轴对齐矩形，理论上没有更精确的解）；
`sceneScreenBounds` 的屋顶余量只取全场景最高楼一个值，不是逐楼精确包围盒；
NPC 占位盒子沿用 `Npc.js` 硬编码的 `width:40,height:80`（O-1 之前遗留的世界
像素常量，从未随 U-2/O-1 迁移脚本换算），相对 144 单位的真实骨架显得偏小，
不在本补丁范围内。

—— 验收 ——
`grep -rn "Math.sin\|Math.cos" js/entity js/scenes` → 0；`grep -rn
"TILT_DEG\|SHEAR" js` → 只有 `js/core/Projection.js` 里有定义；五个静态门
全绿（不含实机验收——TILT_DEG/SHEAR/占位盒子外观需要用户跑起来看）。

代码锚点：`js/core/Projection.js`；`js/scenes/StreetScene.js`（`_applyCamera`/
`_clampScroll`/`_getWorldCoords`/`_screenToWorld`/`update`/`_takePhoto`/
`_clampViewfinderToViewport`）；`js/scenes/SceneRenderer.js`；
`js/core/EntityManager.js`；`js/camera/Viewfinder.js`；`js/core/Layout.js`
（线宽常量）；`js/behavior/nav/NavGrid.js#drawNavDebug`；`js/main.js`（`VIEW_H`）

### 相机跟随取景框二次修复（收敛但仍可感知的开局自动平移）— 已修复

O-2 落地后 Hsinlung 实机复测，"镜头自己动"的症状仍在——不是同一个 bug 的
复发，是同一段跟随逻辑的第二个根因：默认取景框中心在世界 x≈2197，而相机
初始 `scrollX=0`（世界原点），二者相距较远。`update()` 的跟随逻辑本身这次
数学上是收敛的（不是死循环/跑出边界那种），但从 0 追到收敛点 scrollX≈478
按当前跟随速度要跑 190 帧左右（≈3.2 秒）——玩家看到的就是"打开页面镜头自己
滑了几秒"，跟修复前的观感没有本质区别，即便代码层面已经是"正确的有界收敛"
而不是"错误的无界发散"。

修法：开局别把相机留在世界原点等跟随逻辑去追，直接摆到默认取景框那——新增
`StreetScene._centerCameraOn(wx,wy)`，在 `create()` 里取景框创建后立即调用一次
（把取景框中心投影后摆到视口正中央，再 `_clampScroll` 收口），第一帧跟随逻辑
的条件就已经满足，不需要再动。跟随逻辑本身保留，供以后玩家拖动取景框到屏幕
边缘时使用。

代码锚点：`js/scenes/StreetScene.js#_centerCameraOn`（新增）、`create()`（调用点）

### O-3（盒子模板）— 已落地

一个模板函数把"报三个尺寸"变成三面体积，压掉 O-4 剩余 25 个 draw 函数的
工作量。本补丁只转三个样板，覆盖三种情况：`drawBuilding`（大盒子 + 正面贴
原有窗格 + 屋顶细节挪到顶面）、`drawBench`（小盒子 + 正面保留原有细节）、
`drawManhole`（纯地面、走椭圆助手）。其余 draw 函数保持 O-2 的占位状态不动。

- **`Projection.js` 新增**：`drawObliqueBox(g,x,y,w,depth,h,fillFront)`——底面
  矩形（中心 x、前沿 y、宽 w、进深 depth）+ 高度 h，生成正面/顶面/侧面三个
  面；灰度固定分配（顶面 `FILL_MID`、侧面 `FILL_SHADE` 写死不给选，正面色
  由调用方传入）；`LIGHT_DIR='upper-left'` 具名常量，侧面永远画在世界 +x
  一侧（屏幕右边）。另配两个坐标代理，供"正面/顶面细节完全不改内部逻辑，
  只换坐标映射"复用：`frontFaceGraphics(g,anchorX,groundY)`——正面沿世界
  y=常数展开不受 shear 影响，代理数学上纯粹是 scale+translate；
  `topFaceGraphics(g,anchorX,anchorFarY,liftH)`——顶面因 shear 是平行四边形，
  `drawRect` 在这里转发成 `drawPolygon`。
- **`drawBuilding.js`**：入口函数改调用上面三者；`_facade`/`_windows*`/
  `_balcony`/`_laundry`/`_ground`（正面细节）与 `_roofAC`/`_roofWaterTower`/
  `_roofBillboard`/`_roofSolar`（屋顶细节）**函数体一行未改**，只是通过代理
  接到投影后的正面/顶面。屋顶细节原来的局部坐标原点用 `top=building.y-d`
  （老扁平画法的参照点，在真投影里没有几何意义），改用 `farY=baseY-d`
  （地面线往回推一个进深，真正落在屋顶正下方对应的地面位置）。O-1 文档里
  "描边宽度字面量留给 O-3/O-4 处理"的顾虑本次一并解决——不需要额外换算，
  O-2 起容器不再整体缩放，这些字面量已经是最终屏幕像素值。
- **`drawBench.js`**：同样只有入口变了，正面细节（腿/座板/靠背/扶手）搬进
  `_frontDetail()`，函数体不变。新增 `js/core/propDefaults.js#PROP_DEPTH`
  存道具进深默认值（bench: 60，骨架单位）——进深是这批转换才引入的新维度，
  没有历史数据可继承，铁律是写在这个文件里不写死在 draw 函数内部（O-4 tasks.md
  原文要求，提前落地）。**险情记录**：`propDefaults.js` 早在 Scene-1 就已存在
  （`PROP_DEFAULTS`，scene.json 展开期的类型默认值权威，`sceneData.js`/
  stick-puppet 编辑器都在用），第一版误当"新文件"直接整份 Write 覆盖，
  把 `PROP_DEFAULTS` 连同 `USE_TRASH`/`USE_VENDING`/`STALL_DEF` 全部冲掉，
  只剩新加的 `PROP_DEPTH`——五个静态门全部照样绿（没有任何一个门会实际执行
  `expandSceneData()` 走到这张表），这类"改了个早就存在但没被静态门覆盖的
  文件"的破坏本应该在跑游戏时才会暴露。用 `git show HEAD:<path>` 找回原内容
  合并回去才发现问题，属于侥幸没有真的丢东西。教训：写文件前只要不确定
  "这是不是新文件"，先 `Glob`/`git log --oneline -- <path>` 查一遍，不能
  凭"没读过就当没有"。
- **`drawManhole.js`**：老版本自己拍了 `ry=rx*0.45` 的扁平化近似，现在改用
  `Projection.circleToEllipseRy(rx)` 换算真实倾角下的椭圆。
- **`EntityManager.js`**：新增 `CONVERTED_PROP_TYPES`（`bench`）/
  `CONVERTED_GROUND_TYPES`（`manhole`）两个白名单，已转换的实体（含楼，用
  `typeof e.facadeH === 'number'` 判定）改调用真实 `draw()`/`drawGround()`，
  其余仍走 O-2 的占位盒子。顺手修了占位盒子的楼分支：`building.x` 是左边缘
  （老约定），O-2 占位代码误当中心处理多减了半个楼宽，位置一直偏——这次已
  转换的楼不再走占位分支，但占位分支本身也顺手修正，以防万一。

—— 验收（tasks.md 给的，均已过）——
`grep -rn "drawObliqueBox" js/entity` → `drawBuilding.js`/`drawBench.js` 各一处
真实调用；三个被转的文件里不再自己算顶面/侧面几何；五个静态门全绿。

落地后按任务书要求停下，等 Hsinlung 在 `sth/preview.html` 里看这三样东西画
出来像不像、盒子的灰度分配顺不顺眼，可能会调侧面/顶面灰度或 `SHEAR`。

不要动（本补丁未动）：其余 25 个 draw 函数、NPC 绘制、车辆绘制。

代码锚点：`js/core/Projection.js`（`drawObliqueBox`/`frontFaceGraphics`/
`topFaceGraphics`/`LIGHT_DIR`）；`js/core/propDefaults.js`（新增 `PROP_DEPTH`
导出，`PROP_DEFAULTS` 是 Scene-1 就有的既有内容）；
`js/entity/building/drawBuilding.js`；`js/entity/seat/drawBench.js`；
`js/entity/manhole/drawManhole.js`；`js/core/EntityManager.js`

### 相机跟随取景框功能删除 — 已完成

两轮修复（O-1 单位混用 bug、O-2 二次修复的"数学收敛但仍可感知"）之后
Hsinlung 仍不满意"镜头自己动"的观感，决定不修了，直接删掉这个功能。
`StreetScene.js#update()` 里"取景框离屏幕边缘太近就自动平移相机"那段逻辑
整段删除，相机现在只由方向键 / 滚轮缩放改变，没有任何自发移动。取景框本身
的拖动/缩放不受影响（`Viewfinder.js` 的输入处理跟相机无关，一直是独立的）。
`_centerCameraOn`（O-2 加的开局初始定位，`create()` 里只调一次）保留——那不
是"跟随"，是初始位置选择，发生在首帧渲染之前，没有可感知的移动过程。

五个静态门全绿。

代码锚点：`js/scenes/StreetScene.js#update`
