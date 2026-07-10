# NPC `_` 字段普查 — NpcState 迁移准备

扫描日期：2026-07-10  
分支：`claude/animation-cleanup-batch-slhxuf`

---

## 迁移目标

将 NPC 对象上散落的 `_xxx` 临时字段统一纳入 `npc.mem(ns)` 命名空间：
- 消除全局字段污染；状态切换时 `clearMem(ns)` 自动回收
- 跨 namespace 只读原则（owner = 主写模块）
- 多处写 = 设计异味，单独标注

---

## 不迁移字段（实体接口 / 渲染层）

| 字段 | 用途 | 理由 |
|------|------|------|
| `_sortY` | EntityManager / NpcPropManager 读取排序深度 | 渲染接口字段，PropEntity/BuildingEntity 共享同名字段，迁入 mem 会破坏接口 |
| `_motorInstalled` | Motor.js 安装守卫；Npc.update() 内联判断 | NPC 核心渲染逻辑直接用，迁走影响 update() 热路径可读性 |
| `_renderY()` | 方法，非字段 | — |

---

## namespace: `motor`

> **owner**: `Motor.js` / `BaseStateMachine.js`  
> 主题：运动状态机、导航路径、进度累计

| 字段 | 写模块 | 读模块 | 备注 |
|------|--------|--------|------|
| `_walkMode` | Motor.js, BaseStateMachine.js | WalkMode.js, BehaviorManager.js | ⚠️ 两处写（状态机 + Motor）；BaseStateMachine 在状态切换时写，Motor 在安装时写；语义相同，可接受 |
| `_walkModeStack` | Motor.js | Motor.js | 仅 Motor 内部使用 |
| `_navPath` | BaseStateMachine.js, Motor.js(reset) | BaseStateMachine.js, Motor.js | reset 视为清理，不算多 owner |
| `_navGoalX` | BaseStateMachine.js | BaseStateMachine.js | — |
| `_navGoalY` | BaseStateMachine.js | BaseStateMachine.js | — |
| `_navIdx` | BaseStateMachine.js | BaseStateMachine.js | — |
| `_dirCD` | BaseStateMachine.js | BaseStateMachine.js | 转向冷却计时器 |
| `_progressAcc` | Motor.js | Motor.js | 移动进度计量 |
| `_progressCum` | Motor.js | Motor.js | — |
| `_progressLast` | Motor.js | Motor.js | — |
| `_routeIdx` | BaseStateMachine.js, Motor.js(reset) | BaseStateMachine.js | — |
| `_routePts` | BaseStateMachine.js, Motor.js(reset) | BaseStateMachine.js | — |
| `_routeReplan` | Motor.js | Motor.js | — |
| `_routeTarget` | BaseStateMachine.js | BaseStateMachine.js, DebugOverlay.js | DebugOverlay 只读 |
| `_wallSpot` | BaseStateMachine.js | Motor.js(clear) | clear 视为清理 |
| `_motor` | Motor.js | Motor.js | 内部暂存对象，Motor 自身管理 |

---

## namespace: `loiter`

> **owner**: `LoiterBehavior.js`  
> 主题：徘徊微行为（方向、时长、overlay、微阶段）

| 字段 | 写模块 | 读模块 | 备注 |
|------|--------|--------|------|
| `_loiterDir` | LoiterBehavior.js, Motor.js(init/clear) | LoiterBehavior.js, Motor.js | init/clear 视为初始化，owner 仍为 LoiterBehavior |
| `_loiterDur` | LoiterBehavior.js, Motor.js(init null) | LoiterBehavior.js | — |
| `_loiterElapsed` | LoiterBehavior.js, Motor.js(init 0) | LoiterBehavior.js | — |
| `_loiterOverlay` | LoiterBehavior.js | LoiterBehavior.js | — |
| `_microPhase` | LoiterBehavior.js, Motor.js(init null) | LoiterBehavior.js | — |
| `_microPhaseName` | LoiterBehavior.js | DebugOverlay.js | — |
| `_microTimer` | LoiterBehavior.js, Motor.js(init 0) | LoiterBehavior.js | — |

---

## namespace: `social`

> **owner**: `Activity.js` / `ChessActivity.js` / `SocialLayer.js` / `WaitForBusLayer.js` / `seat.js`  
> 主题：社交活动、坐座位、等公交槽位

| 字段 | 写模块 | 读模块 | 备注 |
|------|--------|--------|------|
| `_activity` | Activity.js(join/release), BehaviorManager.js(init null) | BehaviorManager.js, SocialLayer.js, WaitForBusLayer.js, TalkToTask.js, DebugOverlay.js | init null 视为初始化 |
| `_bench` | seat.js | seat.js, BaseStateMachine.js, UseBenchTask.js | 跨模块只读符合约定 |
| `_chessSlot` | ChessActivity.js | ChessActivity.js | — |
| `_onlookerDur` | ChessActivity.js | ChessActivity.js | — |
| `_onlookerTimer` | ChessActivity.js | ChessActivity.js | — |
| `_slotWaitProp` | SocialLayer.js, BehaviorManager.js(clear) | SocialLayer.js, BehaviorManager.js | clear 视为释放 |
| `_slotWaitTimer` | SocialLayer.js | SocialLayer.js | — |
| `_waitingBusStop` | WaitForBusLayer.js | WaitForBusLayer.js, BehaviorManager.js | — |
| `_boardingBus` | WaitForBusLayer.js | WaitForBusLayer.js | — |
| `_waitTimer` | WaitForBusLayer.js | WaitForBusLayer.js | — |
| `_nextFidget` | WaitForBusLayer.js | WaitForBusLayer.js | — |

---

## namespace: `agenda`

> **owner**: `BehaviorManager.js` / `Director.js`  
> 主题：NPC 生命周期、任务链、离场逻辑、路线注册

| 字段 | 写模块 | 读模块 | 备注 |
|------|--------|--------|------|
| `_profile` | BehaviorManager.js | WalkMode.js, GotoTask.js, BaseStateMachine.js, ModifierLayer.js, DebugOverlay.js | 广泛只读，owner 唯一 |
| `_agenda` | BehaviorManager.js | BehaviorManager.js | — |
| `_runner` | BehaviorManager.js | BehaviorManager.js | — |
| `_lifespan` | Director.js, BaseStateMachine.js(extend) | BehaviorManager.js, Pedestrians.js | BaseStateMachine 只做 `+= N` 延长，语义一致 |
| `_ageTimer` | BehaviorManager.js, Director.js(init) | BehaviorManager.js | init 视为初始化 |
| `_departing` | BaseStateMachine.js | BehaviorManager.js, WalkMode.js, WaitForBusLayer.js, DebugOverlay.js | — |
| `_pendingDeparture` | BaseStateMachine.js | BaseStateMachine.js | — |
| `_exitBias` | Director.js | ExitSceneTask.js, Director.js | — |
| `_exitRegistry` | BehaviorManager.js, Director.js | ExitSceneTask.js | ⚠️ 两处写：BM 和 Director 各自注册 |
| `_busStops` | BehaviorManager.js, Director.js | ExitSceneTask.js | ⚠️ 同上 |
| `_waitForBusLayer` | BehaviorManager.js, Director.js | ExitSceneTask.js | ⚠️ 同上（BM/Director 均可注入） |
| `_preferExitType` | ExitSceneTask.js, BaseStateMachine.js(clear) | BaseStateMachine.js | clear 视为释放 |

---

## namespace: `modifier`（原 `_gestureCooldown` / `_heldCooldown`）

> **owner**: `ModifierLayer.js`  
> 可并入 loiter 或单独 modifier namespace，取决于实装偏好

| 字段 | 写模块 | 读模块 | 备注 |
|------|--------|--------|------|
| `_gestureCooldown` | ModifierLayer.js | ModifierLayer.js | — |
| `_heldCooldown` | ModifierLayer.js | ModifierLayer.js | — |

---

## 设计异味 ⚠️

| 字段 | 问题 |
|------|------|
| `_extraTags` | 写者五处：Motor.js、LoiterBehavior.js、WalkMode.js、StallActivity.js、UsePropActivity.js，各写不同语义标签；无单一 owner。建议：改为 `npc.mem('loiter').extraTags` / `npc.mem('social').extraTags` 分拆，或引入 addTag/removeTag API 统一管理 |
| `_exitRegistry` / `_busStops` / `_waitForBusLayer` | BehaviorManager 和 Director 均写入，存在初始化顺序假设；建议明确只由 BehaviorManager.register() 写，Director 通过参数传入 |

---

## 迁移后访问模式示例

```js
// LoiterBehavior.js
const m = npc.mem('loiter');
m.dir ??= 1;
m.elapsed += dt;
if (m.elapsed > m.dur) { /* ... */ }

// ChessActivity.js
const m = npc.mem('social');
m.chessSlot = slot;

// 跨 namespace 只读示例（Motor.js 读 loiter.loiterDir）
const dir = npc.mem('loiter').loiterDir ?? 0;  // ✓ 只读

// clearMem 在状态切换时由 BaseStateMachine 调用
npc.clearMem('loiter');
npc.clearMem('social');
```

---

## 字段总计

| namespace | 字段数 | 异味数 |
|-----------|--------|--------|
| motor     | 16     | 1 (_walkMode 两处写，可接受) |
| loiter    | 7      | 0 |
| social    | 11     | 0 |
| agenda    | 12     | 3 (_exitRegistry 等) |
| modifier  | 2      | 0 |
| 不迁移    | 3      | — |
| **合计**  | **51** | **4** |

---

*审核要点：namespace 归属是否合理？`_extraTags` 处理策略？`_exitRegistry` 三件套的 owner 归一方案？*
