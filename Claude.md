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
公园广场  333–500   NPC 主活动区：棋摊广场 + 小公园(喷泉) + 草地/小摊
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
    ├── BehaviorManager.js    # 行为系统薄协调器（组合 behavior/ 各层，register/update）
    ├── behavior/             # 分层行为系统：NpcProfile / EnvironmentQuery /
    │                         #   BaseStateMachine / OverlayLayer / SocialLayer(Activity) /
    │                         #   CameraReactionLayer(占位) / DebugLog
    ├── DebugOverlay.js       # 行为调试可视层（D 键切换；浮标 + 全局面板）
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
- **道具**（`PropEntity`）：路灯（加高）/长椅/垃圾桶/招牌/报刊架/消防栓/邮筒/花坛/井盖/排水沟/椅子/棋桌/树；公园 fountain/stall + 4 条园路（各 1 把长椅）；前人行道新增 vending/phonebooth。（slide/picnic 已移除：仅贴图浮于地面致穿模，待后续做成实体）
- **车辆**：6 辆机动车循环行驶 + 自行车/外卖电动车火柴骑手。
- **NPC**：公园 12 名自由漫游者（BehaviorManager 转向随机目标）+ 前人行道 3 名 + 横穿者 + 棋手/遛狗/运动者。

## 关键交互

- `← →` 滚动相机；拖动取景框、拖右下角缩放。
- `P` 导出**整条街长图**：离屏 DynamicTexture 合成 sky+bg+entity 三层后 snapshot 成 PNG（不含 HUD/调试层）。
- `D` 切换**行为调试 overlay**（见下文）。

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

## 分层行为系统（`js/behavior/`，依据 `NPC BEHAVIOR SYSTEM.md`）

`BehaviorManager` 是薄协调器，行为差异全部由 **Profile 数据** 驱动，所有 NPC 共用同一引擎。
每帧顺序：`behaviorManager.update()`（决策状态/动画/速度/朝向）→ `entityManager.update()`（推进位移/帧）。

| 模块 | 职责 |
|------|------|
| `NpcProfile.js` | `PROFILES` 字典 + `getProfile(name)`；每个 profile = `allowedStates / transitions(权重表) / overlays / activities / traits`。7 类：pedestrian/businessman/tourist/chess_player/chess_onlooker/dog_owner/athlete |
| `BaseStateMachine.js` | `tickBaseState(npc,profile,envQuery,dt)` + `setState`。按 transitions 权重选下一状态，`allowedStates` 过滤，环境前置不满足则回退 stand。`STATE_DEFS` 定义每个状态的动画/速度/时长 |
| `OverlayLayer.js` | `tickOverlay(npc,profile,dt)`：随机 overlay（计时触发/消失）+ 持久特征 overlay（`npc.persistentOverlay` 回退）+ trait 门控 + `chanceMultiplier` |
| `EnvironmentQuery.js` | 语义空间查询：`isNearBench / isNearWall / nearestFreeBench / nearestProp / nearbyNPCs / findVacantProp`。道具占用标记用 `prop._occupiedBy` |
| `SocialLayer.js` | Activity 统一模型：`Activity` 基类 + `TalkActivity / ChessActivity / DogWalkActivity`。`join` 锁定 NPC（`npc._activity`），`createActivity / interruptActivity`，周期 `_tryPairTalk` |
| `CameraReactionLayer.js` | 镜头反应层，占位（待社会稳定度系统） |
| `DebugLog.js` | localStorage 门控的结构化日志（见「行为调试工具」） |

**关键约定**
- NPC 上行为字段：`_profile / _activity / _traits / persistentOverlay / _extraTags`（下划线前缀，避免与既有字段冲突）；`npc.bond` 保留兼容 `getTags()`。
- `register(npc, profileName)` 纳入框架；被 Activity 锁定的 NPC（`_activity` 非空）跳过 BaseStateMachine/OverlayLayer。
- spawner 分工：创建 NPC + 道具 → `register` 指定 profile → 需要协作的调 `socialLayer.createActivity(...)`。Chess/Dog/Athlete 已迁移，横穿者仍是 `customUpdate` 路径脚本。
- 不改 StickRenderer/Entity/EntityManager/VehicleEntity/Viewfinder/SceneConfig。

### 批次 0：移动基础修复（避障 / 分离 / 道具对齐，已完成）

修复 NPC 穿过道具、NPC 互相穿模、坐下不对齐长椅三个基础问题，并重画长椅。

- **道具避障（椭圆碰撞）**：`PropEntity` 新增 `obstacle` + 椭圆碰撞体 `collisionRX/RY`（喷泉/摊位=占地半轴、长椅=长×0.5 & 高 8 的扁椭圆、树≈15、中型 14/12、小型 10；`collisionRadius`=最大半轴供广相）。扁宽道具用椭圆避免圆形把公园纵带堵死。`EnvironmentQuery` 加 `getObstacles / pointBlocked(椭圆) / raycastObstacle`（按 X 200px 分桶缓存）。`pickRoamTarget` 避开障碍（重试 5 次），`steerRoam` 用归一化椭圆空间做**切向绕行** steering（穿入则精确弹回椭圆表面，前方障碍切向为主+少量径向）。
- **防左右乱闪**：①朝向冷却——翻转后 0.45s 内不再翻且水平分量需 > 0.35×速度；②漫游 NPC 到活动区边界只夹取位置、不再翻转 direction（`NPC.update` 中 `!this.roam` 才 bounce）；③切向避障消除"顶着障碍原地抖"。
- **NPC 间分离**：`BehaviorManager._separate(dt)` 对移动中（walk/run/jog）的自由 NPC 做 O(n²) 排斥（<24px 互推，越近越强）；跳过 Activity 锁定 / 静止 / leash 从属。
- **sit_bench 道具对齐**：进入 sit_bench 时 `enterSitBench` 调 `nearestFreeBench`（以 `bench._occupiedBy` 判空闲）→ 标记占用 + snap 到椅心（夹在 NPC 自身 minX/maxX/minY/maxY 内）；无空椅回退 stand；离开 sit_bench/lie_bench 之外的状态时在 `setState` 释放占用。`lean_wall/lie_bench` 的 snap 留 TODO。
- **长椅重画 + 放大 ~3× + 朝向**：`PropEntity` 构造里把 bench 宽×3、高=24；新增 `facing`（'up'/'down'/'left'/'right'=椅面朝向，scene.json 按邻路走向指定）。`_drawBench` 用局部 (u=椅长, w=椅背高) 坐标经 `P()` 按 facing 做轴对齐映射绘制（4 向均不产生斜矩形）；竖放(left/right)时碰撞椭圆长短轴互换。
- **公园园路**：`StreetScene._drawParkPaths`（Catmull-Rom 平滑曲线 + 宽描边 width 26）画 4 条带弧度步道——A 棋摊广场右缘↔喷泉广场左缘、B 棋摊左缘向左、C 喷泉广场右缘向右、D 上沿步道↓接入 C。**端点落在广场/喷泉的椭圆边缘自然汇入（以 MINI_PARK rx210/ry78 为基准），不穿过广场中心**。每条路边缘各放一把长椅（朝向对应邻路：A/B/C 椅面朝上、D 椅面朝右），其余长椅已删；阻路的树/摊位已挪到草地（scene.json）。
- **未做（不急）**：NPC 尚未"沿路行走"——园路目前是地面贴图，NPC 只避开实体障碍、不偏好沿步道。若要做需把路网数据喂给行为层让 `pickRoamTarget` 偏向路点。
- **未触碰**：SocialLayer/Activity、车辆、StickRenderer；不改 scene.json 道具位置/数量；无 A* 寻路（steering 足够）。

### 批次 1：路人基础行为完善（依据 `1.md`，已完成）

在分层架构上扩展 pedestrian/businessman/tourist 的日常行为集：

- **新增基础状态**（`STATE_DEFS` + 各 profile.transitions）：
  `squat`(蹲) / `sit_ground`(坐地，暂复用 squat 动画，TODO 待 `sit_ground.json`) / `lean_wall`(靠墙) / `lie_bench`(躺椅) / `get_up`(起身过渡)。
- **环境前置**（pickNext 内检查，不满足回退 stand）：
  `sit_bench` 需附近有椅；`sit_ground` 需附近无椅；`lean_wall` / `squat` 需 `isNearWall`（仅前人行道带，公园行人永不触发=方案 B；squat 权重也已调低）；`lie_bench` 需 `sit_bench` 已持续 >12s。
- **动画驱动转换**：`fall→lie_ground`、`lie_ground→get_up→stand`（`get_up` 由 animDone 进 stand）。
- **新增 overlay**：`phone_call`（与 phone_look 互斥）；`smoke`（需 `_traits.smoker`，`lean_wall` 时概率×2）；`hold_bag`（持久特征，由 spawner 按概率设 `npc.persistentOverlay`，空档时回退显示）。
- **traits / 持久特征注入**：`Pedestrians.js` 按类型概率给 `_traits.smoker`、`persistentOverlay='hold_bag'`（前人行道带 smoker 概率调高以演示靠墙抽烟）。
- **标签**：新状态映射见 `NPC.js` 的 `STATE_TAGS`；overlay 额外标签 `smoke→smoking`、`hold_bag→carrying`；`lie_bench` 临时附加 `resting`（20% 叠加 `homeless`），存于 `npc._extraTags` 随状态生灭。
- **仅置标志位**：phone_call/smoke/hold_bag 的视觉（overlayPose/drawExtra）留 TODO，未改关节。
- **未触碰**：SocialLayer(talk) / CameraReactionLayer / Chess·Dog·Athlete 的 profile / 动画文件（缺的用替代+TODO）。

---

## 行为调试工具

### D 键可视 overlay（`js/DebugOverlay.js`，默认关闭）
- **NPC 头顶浮标**（世界坐标，随镜头平移）：`[profile] state | overlay | activity`，
  例 `[pedestrian] walk | phone_look | -`、`[chess_player] - | - | chess#3(player_a)`。
  自由 NPC 白字，被 Activity 锁定的黄字。遍历所有带 `renderer` 的实体（含骑行者）。
- **左上角全局面板**（`setScrollFactor(0)`）：托管/自由/锁定计数、上次配对扫描结果
  （`SocialLayer.lastScanInfo`）、活跃 Activity 列表（`chess#3: player_a=NPC12, ...`）。
- 用 Phaser Text 对象池绘制；**不参与 P 键长图导出**（导出只合成 sky+bg+entity）。

### console 结构化日志（`js/behavior/DebugLog.js`，localStorage 开关）
- `localStorage.setItem('npc-debug','1')` 开启，默认关闭；Node 单测下自动禁用（无 localStorage）。
- 状态转换（`BaseStateMachine.setState`）：`[NPC-12] walk → stand (dur=4.2s, trigger=timeout)`，
  trigger ∈ timeout/anim-done/activity-end；进 `lie_bench` 时附 `extra_tags=[resting]`。
- Activity 生命周期（`SocialLayer`）：`[Activity chess#3] created` / `destroyed(reason=natural)`。
- `BehaviorManager.update` 每帧调 `refreshDebugFlag()` 缓存开关，避免反复读 localStorage。
