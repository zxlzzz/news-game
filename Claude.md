# CLAUDE.md

## 项目概述

新闻记者模拟器，灵感来自 "We Become What We Behold"。玩家在 2.5D 俯视街景里用取景框捕捉实体（NPC/建筑/道具/车辆），断章取义生成新闻。最终目标：接入 Claude API 生成标题与社会反应。

当前状态：完整的灰度老街区场景 + 取景框标签系统；新闻生成仍是本地模板占位。

## 技术栈

- **Phaser 3.80**（CDN，全局 `Phaser`）
- **ES Modules**，纯前端无构建；本地 `python -m http.server 8080` 启动
- **火柴人动画**：运行时用 Graphics 直接画骨架，不用 sprite sheet

## 美术 / 世界（锁定决策）

- **纯黑白灰**（忽略任何彩色需求；唯一例外是取景框命中时的红色高亮）
- **世界约 2000×500，可左右滚动**；远景天空/天际线做视差
- **NPC 在公园内自由二维漫游**（按 Y 缩放排序），不再固定横线

### 纵向分带（见 `js/SceneConfig.js`，屏幕高 500，Y 越大越近）

```
天空      0–100     视差层（天空底色 + 远景剪影楼 + 云）
建筑街墙  100–210   连续街墙（19 栋，6 原型），底边 BUILDING_BASE_Y=210
前人行道  210–268   缓冲带：行人/树/邮箱/售货机/电话亭   FAR_Y=268
双行道    268–333   机动车 + 自行车（上行右/下行左）     NEAR_Y=333
公园广场  333–500   NPC 主活动区：棋摊广场 + 小公园(喷泉/滑梯) + 草地野餐/小摊
```

NPC/车辆生成位置多由 SceneConfig 常量派生（改常量自动跟随）；`scene.json` 道具与 `_drawTrees` 等为硬编码 Y，需手动适配。

## 项目结构

```
news-game/
├── index.html
├── assets/
│   ├── scene.json            # 建筑/道具的静态布局数据
│   └── animations/*.json     # StickPuppet 火柴人动画
└── js/
    ├── main.js               # Phaser.Game 配置
    ├── SceneConfig.js        # 全部分带常量、灰度色板、CHESS_PLAZA/MINI_PARK、roadY()
    ├── StickRenderer.js      # 火柴人渲染器（无状态，勿改）
    ├── Entity.js             # 实体基类（x/y/size/tags/getBounds/draw）
    ├── NPC.js                # 动态人物（动画/位移/scaleMul/锚点/标签）
    ├── BuildingEntity.js     # 6 原型沿街楼（resi/oldmix/modern/clinic/convenience/bookstore）
    ├── PropEntity.js         # 静态道具（propType 分发绘制）
    ├── VehicleEntity.js      # 机动车（car/taxi/bus/moto，按路深缩放、循环行驶）
    ├── EntityManager.js      # 统一管理：每帧写深度 scale、按 Y 排序绘制、矩形查询
    ├── BehaviorManager.js    # 普通行人状态机（walk/run/stand/sit/talk + 二维漫游转向）
    ├── Viewfinder.js         # 取景框（拖拽/缩放、AABB 捕获、标签聚合）
    ├── npcs/                 # Pedestrians / Athletes / Chess / DogWalker / Vehicles / util
    └── scenes/StreetScene.js # 主场景：地面绘制、实体生成、相机、UI、导出
```

## Entity 架构

所有可见元素继承 `Entity`，统一进 `EntityManager`：
- `entity.y` = 底部接触点，用于深度排序（Y 升序绘制 = 近的后画压上面）。
- `EntityManager.update()` 每帧对 `!static && 'scale' in e` 的实体写入 `depthScale(y)*scaleMul`；建筑/道具是 static 不受影响。
  - **NPC.scaleMul**：前人行道行人 ×0.65、横穿者 ×0.55，拉开远近差距。
  - **VehicleEntity** 用自己的 `baseScale + roadCenterY/roadHalfHeight + scaleMul` 在 update 里覆盖 scale（按路深远小近大）。
- 取景框 `getCapturedTags()` 聚合框内实体 tags 去重 → 供新闻生成。

## 场景内容速览

- **建筑**（`BuildingEntity` + `scene.json`）：19 栋连续街墙，6 原型，高度/窗/招牌均不统一；屋顶可有水箱/太阳能/广告牌/空调；底边 ±6 抖动 + 巷道暗缝；两处侧路缺口。
- **道具**（`PropEntity`）：路灯（加高）/长椅/垃圾桶/招牌/报刊架/消防栓/邮筒/花坛/井盖/排水沟/椅子/棋桌/树；公园新增 fountain/slide/picnic/stall；前人行道新增 vending/phonebooth。
- **车辆**：6 辆机动车循环行驶 + 自行车/外卖电动车火柴骑手。
- **NPC**：公园 12 名自由漫游者（BehaviorManager 转向随机目标）+ 前人行道 3 名 + 横穿者 + 棋手/遛狗/运动者。

## 关键交互

- `← →` 滚动相机；拖动取景框、拖右下角缩放。
- `P` 导出**整条街长图**：离屏 DynamicTexture 合成 sky+bg+entity 三层后 snapshot 成 PNG（不含 HUD）。

## 动画数据（StickPuppet JSON）

坐标相对 body（髋部，恒 [0,0]），y 向下为正，火柴人总高约 170px。骨骼：body→neck→{head,l/r_elbow→hand}；body→l/r_knee→foot。多个 NPC 共享同一份动画数据，**StickRenderer 无状态、勿改**。

## 待开发

- [ ] 接入 Claude API 生成新闻标题
- [ ] NPC 语义标签组合 → AI 生成新闻
- [ ] 社会稳定度 + 个人财富数值系统
- [ ] NPC 对事件的反应（看到警察走开、围观等）
- [ ] 漫游覆盖更多角色（遛狗/运动者）；过马路等行为丰富

## 编码规范

- 中文注释；类 PascalCase，函数/变量 camelCase；模块职责单一、构造注入依赖。
- 新增实体类型：继承 Entity，覆盖 getBounds()/draw()，在 StreetScene `_spawnXxx()` 注册。
- 改 SceneConfig 分带常量会联动 NPC/车辆/道路；scene.json 与硬编码 Y 需手动核对。

---

## NPC 行为系统重构计划（依据 `NPC BEHAVIOR SYSTEM.md`）

目标：把单体 `BehaviorManager` 重构为**分层 + Profile 驱动 + Activity 统一**的架构，所有 NPC 纳入同一框架。
**本次只搭骨架、行为表现需与重构前完全一致；不新增任何尚未实现的状态，不实现镜头反应逻辑。**

### 现状要点（实施前已确认）
- `BehaviorManager.js`：含 `STATE_DEFS`、`SocialBond`、`_setState/_steerRoam/_pickRoamTarget/_tick/_tickOverlay/_nearBench/_tryPairTalk/_enterTalk`。每帧顺序 `behaviorManager.update()` → `entityManager.update()`。
- `NPC.js`：已有字段 `state/overlay/bond/overlayPose/npcType/roam/roamTarget/customUpdate/leashTarget/leashOffset`。新增字段一律用下划线前缀（`_profile`/`_activity`）。`getTags()` 仍检查 `npc.bond`，须保留兼容。
- `EntityManager`：暴露 `entities`、`depthScale(y)`、`queryRect`、`getAlive()`，无语义化空间查询 → 由 `EnvironmentQuery` 包装。
- `Chess.js`：棋手行为用 `customUpdate` 硬编码（A/B 轮流 `startPlay/freezeAt0` + `WAIT_MS`）；桌椅道具用棋手锚点反推。
- `DogWalker.js`：owner 走路，dog 用 `leashTarget`/`leashOffset` 跟随 + `drawExtra` 画绳。
- `Athletes.js`：直接 `makeNPC`，未注册进 BehaviorManager（纯 jog 动画位移）。
- `Pedestrians.js`：返回 `managed[]`，含公园漫游者(`roam=zone`)、前人行道行人、横穿者(`customUpdate` 路径脚本)。
- `StreetScene._spawnNPCs()`：`spawnPedestrians` 后 new BehaviorManager 并 `register` 漫游者；chess/dog/athlete/vehicles 各自 spawn。

### 实施步骤（按依赖顺序，逐步验证）

**第 1 步 — 新建 `js/behavior/NpcProfile.js`（纯数据，无依赖）**
- 导出 `PROFILES` 字典 + `getProfile(name)`（缺失回退 `pedestrian`）。
- 定义 7 个 profile：`pedestrian/businessman/tourist/chess_player/chess_onlooker/dog_owner/athlete`，含 `allowedStates/transitions/overlays/activities/traits/cameraReaction`。
- `transitions` 权重与 `overlays.phone_look`(chance 0.004, dur[5,25]) 复刻现有 `_tick/_tickOverlay` 概率，保证行为不变。

**第 2 步 — 新建 `js/behavior/EnvironmentQuery.js`（依赖 EntityManager）**
- `constructor(entityManager)`；实现 `nearestProp/nearbyNPCs/isNearWall/isNearBench/findVacantProp`。
- `isNearBench` 复刻现有 `_nearBench`（bench, |dx|<60, |dy|<80）。
- 占用判定读 `prop._occupiedBy`（下划线，不在 PropEntity 上加公开属性）。

**第 3 步 — 新建 `js/behavior/BaseStateMachine.js`（依赖 Profile + EnvironmentQuery）**
- 导出 `tickBaseState(npc, profile, envQuery, dt)` + 内部 `setState`（迁移 `_setState` 逻辑）。
- 迁移 `_steerRoam/_pickRoamTarget`；状态转换按 `profile.transitions` 权重随机，`allowedStates` 过滤。
- 前置条件：`sit_bench` 需 `envQuery.isNearBench` 否则回退 `stand`；`fall→lie_ground`(animDone)；`lie_ground→stand`(计时)；`run` 极低概率 `fall`。

**第 4 步 — 新建 `js/behavior/OverlayLayer.js`（依赖 Profile）**
- 导出 `tickOverlay(npc, profile, dt)`，读 `profile.overlays` 配置，复刻现有 `_tickOverlay`。

**第 5 步 — 新建 `js/behavior/SocialLayer.js`（核心，依赖 EnvironmentQuery）**
- `Activity` 基类：`join/release/update/interrupt/destroy`，`join` 设 `npc._activity=this`。
- `TalkActivity`：复刻 `SocialBond`（faceEachOther + 计时），创建时同时设 `npc.bond` 兼容 `getTags()`。
- `ChessActivity`：迁移 Chess.js 的 A/B 轮流落子 + WAIT_MS 子状态机；onlooker 子行为（站立↔走动↔观看）；`interrupt` 走 cleanup 释放参与者与道具。
- `DogWalkActivity`：包装现有 leash 逻辑（owner 走/dog 跟随）。
- `SocialLayer`：`update(npcs, dt)`（tick Activity + 周期 `_tryPairTalk`）、`createActivity/interruptActivity`；空棋桌配对本次留桩。

**第 6 步 — 新建 `js/behavior/CameraReactionLayer.js`**
- 仅空壳 `update(npcs, viewfinder, stability, dt) { /* TODO */ }`。

**第 7 步 — 重构 `js/BehaviorManager.js` 为薄协调器**
- import 上述各层；`constructor(em)` 组合 `envQuery/socialLayer/cameraLayer`。
- `register(npc, profileName='pedestrian')`：设 `_profile/_activity`、初始化 `walkSpeed`、入列。
- `update(delta)`：① socialLayer.update ② 自由 NPC(`!npc._activity`) 走 tickBaseState+tickOverlay ③ cameraLayer（留注释）。
- 提供 `socialLayer` 访问入口供 spawner 调用 `createActivity`。

**第 8 步 — 改 spawner**
- `StreetScene._spawnNPCs()`：先 `this.behaviorManager = new BehaviorManager(em)`，再把它传给各 spawn 函数；删掉外层 `for...register`。
- `Pedestrians.js`：生成后 `bm.register(npc, profileName)`（pedestrian/businessman/tourist）；横穿者保留 customUpdate 不注册。
- `Chess.js`：保留桌椅道具创建；棋手 `register('chess_player')`、旁观者 `register('chess_onlooker')`，再 `socialLayer.createActivity('chess', ...)`；**删除 customUpdate**。
- `DogWalker.js`：owner `register('dog_owner')`；dog 不注册；`createActivity('dog_walk', [owner, dog])`。
- `Athletes.js`：`register('athlete')`。

### 约束与验证
- 不改 NPC.js/Entity.js/EntityManager.js/StickRenderer.js/Viewfinder.js/VehicleEntity.js/SceneConfig.js（接入仅在 spawner/BehaviorManager）。
- 所有 Activity 子类都实现 `interrupt(reason)`，即使本次不触发。
- 验证（`python -m http.server 8080` 后浏览器目测）：行人漫游/停/坐/跑/摔/看手机、前人行道横走、横穿、棋手轮流落子+观棋、遛狗跟随、运动者跑、两人靠近触发对话、取景框标签正常——表现与重构前一致，无新 bug。
