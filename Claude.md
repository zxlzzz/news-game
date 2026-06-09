# news-game

2D 街景浏览器游戏。玩家扮演记者，拍摄 NPC 场景生成新闻报道。核心机制：相同的火柴人跑步动作可以被取景框框为警察、罪犯或任何人，实现"误导性构图"玩法。

## 技术栈

PixiJS + 原生 Canvas 2D。无构建系统，裸 ES module 直接 serve。无类型检查、无测试。

## 目录结构

```
js/
  main.js                 唯一入口

  core/                   引擎层（不含游戏逻辑）
    Entity.js               实体基类
    EntityManager.js        实体管理 + Y 排序绘制
    StickRenderer.js        骨骼渲染（纯渲染器，禁止修改）
    Layout.js               世界常量 + depthT 系列函数（单一深度源）
    PropEntity.js           道具实体（含 smartDef 槽位）
    PixiText.js             文字渲染封装

  entity/<name>/           每个世界物体一个目录
    draw<Name>.js            绘制（纯函数，不含行为）
    <name>.js                行为 + INTRINSIC 尺寸（如有）
    其他相关文件              如 VehicleStateMachine.js、WaitForBusLayer.js

  npc/                     NPC 相关
    Npc.js                   NPC 实体类
    NpcProfile.js            行为档案
    Pedestrians.js           行人生成
    Athletes.js              跑步者生成
    Chess.js                 棋局生成
    DogWalker.js             遛狗生成
    SpawnManager.js          动态出入场
    ExitRegistry.js          出口注册
    LoiterBehavior.js        逗留微行为
    npcUtil.js               NPC 工具函数
    props/                   NPC 附件视觉（BagProp, PhoneProp 等）

  behavior/                行为引擎
    BehaviorManager.js       顶层协调器
    BaseStateMachine.js      状态机（转换表 + 状态 tick）
    WalkMode.js              移动模式（wander/direct/path_follow）
    RouteSelector.js         路线选择
    ModifierLayer.js         trait/held/gesture 修饰器
    SocialLayer.js           Activity 配对 + 生命周期
    ActivityRegistry.js      Activity 工厂注册
    ClipPlayer.js            动画片段播放器
    EnvironmentQuery.js      场景查询接口（委托给各 entity 模块）
    PoseCacheBuilder.js      姿势缓存构建
    VehicleSpawner.js        机动车生成
    TrafficSignal.js         交通信号
    DebugLog.js              结构化日志
    activities/              各 Activity 实现

  camera/                  取景框 + 镜头反应
    Viewfinder.js
    CameraReactionLayer.js

  scenes/                  场景管理
    StreetScene.js           主场景（加载/创建/主循环）
    SceneInitializer.js      实体生成
    SceneRenderer.js         静态背景绘制（仅道路/天空/人行道/斑马线）

  fx/                      粒子特效
  ui/                      HUD / 调试面板

assets/
  scene.json               场景数据（建筑/道具/路线/布局）
  animations/              骨骼动画 JSON
```

## 核心规则

### 绝对禁止
- **StickRenderer.js 禁止修改**。它是纯无状态渲染器。
- **不在 JS 文件里硬编码关节坐标或动作数据**。所有 NPC 动作数据来自 assets/animations/ 下的 JSON。
- **不添加第二个深度公式**。Layout.js 的 depthT(y) 是唯一深度源，所有视觉属性从它派生。
- **不使用 Phaser 风格 API**。全项目已迁移到 PIXI 原生 API，不存在兼容层。

### Entity 组织模式
每个世界物体放在 entity/<name>/ 下：
- draw<Name>.js — 纯绘制函数，不 import 任何行为模块
- <name>.js — 行为逻辑 + INTRINSIC 尺寸常量 + 所有权注释
- 复合实体（如公交站）所有子部件相对锚点定位，改锚点坐标时全体跟随
- **样板参考**：entity/seat/seat.js + entity/seat/drawBench.js

### 所有权规则
每个可变字段有且只有一个写入者，在文件头注释标明。其他模块只读。违反即 bug。

### 绘制规则（PIXI 原生 API）
- 使用：beginFill/endFill/drawRect/drawCircle/drawEllipse/drawRoundedRect/moveTo/lineTo/lineStyle
- **填充图形前必须 g.lineStyle(0)**：PIXI 的 drawCircle/drawEllipse/drawRect 会继承当前 lineStyle 描边。纯填充图形（阴影、头部、烟雾、树冠等）前必须关描边
- drawEllipse 参数是半轴（不是全宽全高）

### 数据流（单向）
JSON → 解析 → 只读场景数据 → 运行时实体 → 渲染。下游不反向修改上游。

### 命名规范
| 类别 | 规范 | 示例 |
|------|------|------|
| JS 文件（类） | PascalCase | NpcProfile.js |
| JS 文件（工具/draw） | camelCase | drawTree.js, npcUtil.js |
| Entity 目录 | kebab-case（= propType） | entity/chess-table/ |
| 常量 | UPPER_SNAKE | WORLD_WIDTH |
| NPC 状态名 | snake_case | sit_bench, lie_ground |
| JSON key | camelCase | propType, activityType |

## 世界坐标系

2000×520px 世界。Y 轴向下为正。火柴人原生高度 144 单位 = 1.7m，1m ≈ 85 单位。

| 区域 | Y 值 |
|------|------|
| BUILDING_BASE_Y | 210 |
| SIDEWALK_FAR_Y | 240 |
| BIKE_LANE_FAR_TOP | 248 |
| FAR_Y（远车道边） | 268 |
| NEAR_Y / BIKE_LANE_NEAR_TOP | 333 |
| BIKE_LANE_NEAR_BOTTOM / PARK_TOP | 353 |
| PARK_BOTTOM | 520 |

## 姿势/动画系统

- 所有 JSON 在 assets/animations/，PoseCacheBuilder.js 有内置 MANIFEST
- Pose JSON 存绝对坐标（与 single.json 一致，body=[-1,12]）；加载时转 delta；渲染时 bodyPos + delta
- sub_event 格式 {aDelta, bDelta} 已是 delta，SocialLayer 直接应用
- 新动画 = 新 JSON 文件 + MANIFEST 注册，不改逻辑代码

## NPC 行为系统

已实现 15 个状态：walk / run / stand / loiter / sit_bench / lean_wall / squat / sit_ground / lie_bench / lie_ground / fall / get_up / talk / routing / departing

状态转换优先级：1–9 日常 / 10–49 环境 / 50–98 社交 / 99+ 强制

Smart Object：PropEntity + smartDef{activityType, slots, routing}。routing 字段驱动自动注册。

Modifier 优先级：trait=5 / held=10 / gesture=20

## 待办

1. CameraReactionLayer（游戏核心玩法，占位空壳）
2. 新闻生成（Vision AI 截图 → DeepSeek 生成 → 玩家编辑 → 评分）
3. NPC 状态封装（NpcState 类，33 个字段集中管理 + 写入者标注）
4. lean_wall / sit_ground 对齐
5. 比例微调

## 工具

- sth/stick-puppet：骨骼编辑器 + MediaPipe 动捕
- sth/anim-preview：Animator Debugger
- CC 分支用 claude/ 前缀