> **status: snapshot** — 盘点截止 2026-07-15；新增功能批次请同步更新本表。

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
| 速度统一 V-2 | 消费者迁移（D2/D3/D4）：`npc.vy/speed` 物理角色删除；StuckProbe gate 改 state 集；zone 门改读 `mot.vel?.vy`；`updateFacing` 单写入点（routing + wander 共用）；dead-code `!mode` 分支删除 | ✅ 已落地 | `js/behavior/BaseStateMachine.js`；`js/behavior/Motor.js`；`js/behavior/StuckProbe.js`；`js/debug/MovementAudit.js`；`docs/contracts/movement-dataflow.md` |
| T1/T2/T3（动画&朝向清理） | walk clip 水平质心归零（T1，shift=+18）；`updateFacing` 提取为 BaseStateMachine 函数（T2）；check-invariants Rule 4（walk-state clip `|meanX|≤4`）（T3） | ✅ 已落地 | `scripts/recenter-clips.py`；`assets/animations/cycle/walk.json`；`scripts/check-invariants.mjs` |
| F1–F4（足迹统一） | footprint 扩展 `shape/blocks/sortDY`（F1）；PropEntity 收敛 `this.footprint`，删 `collisionRX/RY`，`_sortY` 由 `sortDY` 派生（F2）；NavGrid 改读 `e.footprint`，`OBS_MARGIN=1` → `NPC_HALF_W=7`，shape 分发（F3）；check-invariants Rule 5/6（F4） | ✅ 已落地 | `js/core/PropEntity.js`；`js/behavior/nav/NavGrid.js`；`js/entity/*/`；`scripts/check-invariants.mjs` |
| 速度统一 V-3 | 清理 + 不变量（D5/D6）：内联路径 CONTRACT（D5）；check-invariants V1–V3 gate（no-direct-xy / no-direction-in-physics / no-npc.vy-in-steer）；死字段/死 API 删除 | 🔲 待实施 | 设计见 `docs/design-plans/velocity-unification-design-v1.md §2 V-3`；check-invariants 基础设施已备（Rules 1–6 ✅） |
| 挂饰 attachment schema | NPC 可拾取/佩戴道具的声明式 schema | 🔲 定稿未落盘，待从历史找回 | — |

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
