# News Game — 项目指南

## 一句话概述

2.5D 街道场景模拟器：PixiJS 原生（无打包器）+ ES modules，NPC 自主行为驱动，玩家用取景框捕捉"新闻场景"。

---

## 技术栈

- **PixiJS 5**，纯浏览器，无 bundler，直接 `<script type="module">`
- 运行：`start.bat`（Windows）或直接打开 `index.html`（需本地 HTTP）
- 无 TypeScript，无测试框架；调试靠 `js/behavior/DebugLog.js` + DebugOverlay

---

## 目录结构

```
assets/
  scene.json          场景数据（建筑/道具/路线/公交站/斑马线）
  animations/         火柴人动画 JSON（StickRenderer 读取）
js/
  core/
    Layout.js         全局坐标常量（唯一真值源）
    EntityManager.js  实体管理，按 Y 深度排序渲染
    PropEntity.js     通用道具实体（含 smartDef / _slots）
    StickRenderer.js  火柴人渲染器（不动）
  behavior/
    BehaviorManager.js  NPC 行为协调器（主循环入口）
    BaseStateMachine.js 状态机（setState / tickBaseState / steerRoam）
    WalkMode.js         走路模式（wander/direct/path_follow/planCrossing）
    SocialLayer.js      配对 / Activity / 棋局 / 摊位
    ModifierLayer.js    叠加动作（phone/smoke/gesture）
    EnvironmentQuery.js 空间查询（bench/slot/wall/obstacle）
    RouteSelector.js    路线选取（scene.json routes）
    NpcProfile.js       NPC 档案（行为参数）
    ActivityRegistry.js Activity 类型注册
  entity/             各类道具实体（busstop / vehicle / seat / …）
  npc/                NPC spawner（Pedestrians / Chess / DogWalker / Athletes）
  scenes/
    StreetScene.js      主场景（game loop）
    SceneInitializer.js 场景初始化（建筑/道具/NPC/路线）
    SceneRenderer.js    场景渲染（背景/地面/斑马线）
  ui/                 取景框、快门、UI 层
sth/
  stick-puppet/       火柴人动画编辑器
  anim-preview/       双栏动画调试工具
```

---

## Y 轴分带常量（`js/core/Layout.js`）

| 分带 | Y 范围 | 关键常量 |
|------|--------|---------|
| 天空 | 0 – 210 | `SKY_Y=100`, `BUILDING_BASE_Y=210` |
| 远人行道 | 210 – 248 | `SIDEWALK_FAR_Y=240` |
| 远自行车道 | 248 – 268 | `BIKE_LANE_FAR_TOP=248` |
| 机动车道 | 268 – 333 | `FAR_Y=268`, `NEAR_Y=333` |
| 近自行车道 | 333 – 353 | `BIKE_LANE_NEAR_BOTTOM=353` |
| 公园 | 353 – 520 | `PARK_TOP=353` |

NPC 漫游区：远人行道（y≈240）和公园（y≈370–490）。机动车道禁止驻留（`isRoadZone` 守卫）。

---

## 绘制规则

### 灰阶调色板（铁律：只用 Layout 常量，不许出现魔法数字）

```js
FILL_PAPER = 0xd8d8d8   // 最亮：建筑立面
FILL_LIGHT = 0xc4c4c4   // 次亮：玻璃/草地斑块/树影
FILL_MID   = 0xaaaaaa   // 中灰：屋顶/遮篷/车身
FILL_SHADE = 0x888888   // 最暗：门板/阴影
ENV_LINE_LIGHT = 0x90   // 环境线条（浅）
ENV_LINE_DARK  = 0x40   // 环境线条（深）
```

### 深度缩放（铁律：`depthT` 是唯一深度源）

```js
// 唯一正确写法：
import { depthScale, depthT } from '../core/Layout.js';
prop.scale = depthScale(prop.y);   // EntityManager 每帧自动调用
```

禁止出现第二套深度公式（如 `1 + (y - FAR_Y) / 200`）。

### PixiJS 绘图约定

```js
g.lineStyle(1, ENV_LINE_DARK, 0.6);
g.beginFill(FILL_PAPER, 1);
g.drawRect(x, y, w, h);
g.endFill();
```

---

## 动画规则

- `assets/animations/` 下每个 JSON 是一段火柴人动画（帧序列 + 关节坐标）
- **StickRenderer 不动**：无状态渲染器，只读 `npc.animation` + `npc.frameIndex` + `npc.overlayPose`
- 关节坐标写在 JSON 里；`anchorMode` 决定 Y 锚点（`hip` / `back` / `foot`）
- 新增动画：只改 JSON，不改 StickRenderer

---

## 实体模板（以 seat 为例）

```js
// js/entity/seat/seat.js
export function spawnBench(em, x, y) {
  const e = em.add(new PropEntity({
    propType: 'bench',
    x, y,
    width: 40, height: 12,
    obstacle: true, collisionRX: 20, collisionRY: 8,
  }));
  e.scale = depthScale(y);
  return e;
}
```

新增道具摆放：**写进 `assets/scene.json` 的 `props` 数组，不许硬编码坐标到 JS**。

---

## 行为系统（当前实现）

```
BehaviorManager
  ├── BaseStateMachine  — 状态机（15 状态冻结）
  ├── WalkMode          — 走路模式（wander/direct/path_follow）
  │     └── planCrossing — 守法/闯红灯过马路
  ├── SocialLayer       — Talk / Chess / Stall 配对
  ├── ModifierLayer     — 叠加动作（phone/smoke）
  ├── EnvironmentQuery  — 空间查询（只读）
  └── RouteSelector     — 路线池（scene.json routes）
```

目标架构（分层重构蓝图）见 [docs/behavior-design.md](./docs/behavior-design.md)。
完整状态规格见 [docs/npc-states.md](./docs/npc-states.md)。

### 关键约定

- **帧率归一**：所有每帧概率判定用 `Math.random() < p * dt * 60`
- **区域守卫**：`_resolveTimeout` 入口检查 `isRoadZone(npc.y)`，在路上不切状态
- **槽位释放**：NPC 离场前调 `releaseAllHoldings(npc, envQuery)`
- **过马路**：跨侧路由必须经 `planCrossing`，禁止直接 teleport

---

## 场景数据（`assets/scene.json`）

新增内容必须写进 scene.json：

```jsonc
{
  "buildings": [...],
  "props": [
    { "propType": "bench", "x": 780, "y": 418 },
    { "propType": "trash", "x": 1460, "y": 465 }
  ],
  "routes": [...],          // RouteSelector 读取
  "crosswalks": [           // initCrosswalks 读取
    { "x": 350 }, { "x": 1050 }, { "x": 1700 }
  ],
  "busStops": [...]
}
```

---

## 工具

- `sth/stick-puppet/` — 火柴人动画编辑器（逐帧拖拽关节）
- `sth/anim-preview/` — 双栏动画调试工具（多 NPC 同屏预览 + 帧控制）
