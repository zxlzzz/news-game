# News Game — Branch claude/lucid-mayer-0ojqE 改动总结

## 概览

本分支在基础场景之上新增了 NPC 行为系统的多个核心模块，并修复了若干运动/对齐 bug。
所有改动均在 `js/` 目录下，不影响资产文件。

---

## 1. Loiter 微行为状态 (`dc48b21`)

**文件**: `js/behavior/BaseStateMachine.js`

为 NPC 新增 `loiter`（原地逗留）状态，包含内部四阶段微行为循环：

- 四个微阶段：`look_around → micro_action → look_around → check_around`
- `micro_action` 根据 NPC 特征分派不同行为（打电话 / 看手机 / 抽烟 / 换包手）
- `check_around` 阶段短暂转身（方向翻转），离开时自动恢复原朝向
- 全程覆盖 `overlayPose`（骨架关节）实现视觉差异
- `loiterChance` / `loiterDurationRange` 由 `NpcProfile` 配置

**NpcProfile 新增字段**（`js/behavior/NpcProfile.js`）：
- `loiterChance`: NPC 到达漫游目标点时触发 loiter 的概率
- `loiterDurationRange`: loiter 持续时间范围 [min, max]（秒）

---

## 2. Animator Debugger 工具 (`5d0bd32`)

**目录**: `sth/anim-preview/`

将原动画预览页重写为双栏调试工具：
- 左栏：动画选择列表 + 播放控制（帧速/暂停/单步）
- 右栏：多 NPC 同屏预览，可分别设置动画、朝向、缩放
- 动画状态可视图（当前帧高亮显示）

---

## 3. Smart Object 系统（路由到道具槽位）(`ffb86b6`)

**核心思路**：NPC 自行发现空闲道具（棋桌），走过去（`routing` 状态），到位后触发 Activity。

### 新增 / 改动文件

| 文件 | 改动 |
|---|---|
| `js/PropEntity.js` | 新增 `smartDef` + `_slots[]` 初始化（`{index, role, dx, dy, reserved}`） |
| `js/behavior/EnvironmentQuery.js` | 新增 `findAvailableSlot(activityType, npc, radius)` / `releaseSlotReservation(npc)` |
| `js/behavior/BaseStateMachine.js` | 新增 `routing` 状态定义；`steerRoam` 新增 routing 分支（向量直线移动）；`setState` 中 `routing` 使用 `walkSpeed` 计算速度 |
| `js/behavior/SocialLayer.js` | `onSlotArrival(npc, prop, slot)` — 到槽位后等其他参与者；全到齐后 `createActivity` |
| `js/behavior/NpcProfile.js` | pedestrian / tourist 新增 `'chess'` 到 `activities`；businessman 明确排除 chess |
| `js/npcs/Chess.js` | 棋桌 `smartDef` — 两个玩家槽位 `player_a / player_b`，dx = `±gap/2` |
| `js/BehaviorManager.js` | `registerTransition` 注入 smart-object routing 规则；路由触发守卫 `!npc._departing` |

### `routing` 状态设计

```
STATE_DEFS.routing = { anim: 'walk', speedK: 1.0, once: false, dur: null }
```

NPC 进入 routing 后，`steerRoam` 接管，每帧直线奔赴 `_routeTarget`：
- `abandonAfter`：超时自动回退 `walk`（槽位路由 30s，离场 999s）
- `onArrive`：到达回调（槽位路由 → `onSlotArrival`；离场路由 → `alive=false`）
- `arriveThreshold`：building 出口 20px，edge 出口 / 槽位 8px

---

## 4. Departure（离场）系统 (`2a0bbdd`)

**核心思路**：NPC 有寿命（`_lifespan`），时间到后走向出口并消失（`alive=false`）。

### 新增 / 改动文件

| 文件 | 改动 |
|---|---|
| `js/behavior/ExitRegistry.js` | **新文件** — `register(exitPoint)` / `findExit(npc, preferType)` |
| `js/behavior/BaseStateMachine.js` | `_routeToExit(npc, exit)` — 清漫游、清 overlay、进 routing；`triggerDeparture(npc, exitRegistry)` — 坐/躺者先站起（`_pendingDeparture`）再路由 |
| `js/BehaviorManager.js` | 寿命计时器：每帧 `_ageTimer += dt`，超 `_lifespan` 调 `triggerDeparture`；离场中跳过 `tickOverlay` |
| `js/behavior/SocialLayer.js` | `_tryPairTalk` 排除 `_departing` NPC |
| `js/behavior/NpcProfile.js` | 新增 `departure` 字段：`{ lifespanRange, preferExitType }`；businessman `preferExitType: 'building'`，其余 `null` |
| `js/npcs/Pedestrians.js` | 每个 NPC 生成后设置 `_ageTimer / _lifespan / _departing` |
| `js/scenes/StreetScene.js` | 创建并填充 `ExitRegistry`（2 个边缘出口 + 4 个建筑出口），赋值给 `bm.exitRegistry` |
| `js/DebugOverlay.js` | 浮标显示 `routing→(x,y)` + `[DEPT]` 标记；面板显示离场计数 |

### ExitPoint 结构

```js
{ x, y, type: 'edge'|'building', facing: 1|-1, yZone: [y0, y1] | null }
```

---

## 5. Bug 修复（本次）

### Bug 1 — Routing 双重移动 / 方向漂移

**文件**: `js/behavior/BaseStateMachine.js` — `steerRoam` routing 分支

**根因**：`setState('routing')` 将 `npc.speed` 设为 `walkSpeed`（约 26），
`steerRoam` routing 分支直接对 `npc.x/y` 做向量位移后返回，
但 `NPC.update()` 仍因 `speed > 0` 再次叠加 `direction * speed * dt` 到 `npc.x`。
同时，routing 时 `npc.roam = null`，`NPC.update` 边界检查会在越界时翻转 `direction`，
导致下一帧 steerRoam 计算出与移动方向相反的朝向，引发方向抖动/漂移。

**修复**：在 routing 分支开头加 `npc.speed = 0; npc.vy = 0;`，
并将速度来源改为 `npc.walkSpeed`（原为 `npc.speed`，被清零后会回退 26）。

```js
if (npc.state === 'routing') {
  npc.speed = 0;   // 防 NPC.update 叠加位移 + 边界翻向
  npc.vy    = 0;
  // ...
  const spd = npc.walkSpeed || 26;
  npc.x += (dx / dist) * spd * dt;
  npc.y += (dy / dist) * spd * dt;
}
```

### Bug 2 — `lie_bench` 躺椅位置对不上

**文件**: `js/behavior/BaseStateMachine.js` — `_resolveTimeout`

**根因**：`sit_bench` 动画 `anchorMode='hip'`，`npc.y = bench.y` 时 body 关节渲染于 `bench.y`。
`lie_bench` 动画 `anchorMode='back'`（无竖向偏移），同样 `npc.y = bench.y` 时
body 关节渲染于 `bench.y + body.y * scale ≈ bench.y + 35px`，人体整体下沉约 35px。

**修复**：从 `sit_bench → lie_bench` 时，在 `_resolveTimeout` 中重新对齐 `npc.y`：

```js
if (next === 'lie_bench' && npc._bench) {
  // 令 lie_bench body 关节 = bench.y（与坐姿体心对齐）
  const bodyY = npc.renderer?.getAnimation('lie_bench')?.frames[0]?.body[1] ?? 79;
  npc.y = clamp(npc._bench.y - Math.round(bodyY * npc.scale), npc.minY, npc.maxY);
}
```

---

## 架构关键点

- **BehaviorManager** 持有所有 NPC；每帧调 `tickBaseState` + `tickOverlay` + 寿命检查
- **StateStateMachine** 纯函数模块（无类）；状态转换规则通过 `registerTransition` 外部注入，避免循环依赖
- **SocialLayer** 管理配对（Talk/Chess）；通过 `registerTransition` 在 BehaviorManager 构造时注入路由触发规则
- **EnvironmentQuery** 只读场景查询接口（bench / wall / obstacle / slot）；不持有状态
- **ExitRegistry** 只读出口查询；`findExit(npc, preferType)` 按 `yZone` 过滤 + `preferType` 加权随机
- **Smart Object 槽位语义**：`reserved`（NPC 路由中，防抢占）vs `_occupiedBy`（Activity 进行中，防坐下）

---

## 尚未实现（预留接口）

- NPC 入场（从屏幕边缘进入），对应 ExitRegistry 的反向路由
- `lean_wall` / `sit_ground` 的 prop 对齐（TODO 注释已在 `_resolveTimeout` 附近）
- `CameraReactionLayer`（镜头反应，priority 50~98 预留位）
