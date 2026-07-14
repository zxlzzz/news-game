> **SNAPSHOT** — 2026-07-11. 迁移已完成；本文件为历史记录，不再维护。

# NPC `_` 字段普查 — NpcState 迁移准备

扫描日期：2026-07-10  
分支：`claude/animation-cleanup-batch-slhxuf`

---

## 迁移目标

将 NPC 对象上散落的 `_xxx` 临时字段统一纳入 `npc.mem(ns)` 命名空间：
- 消除全局字段污染；状态切换时 `clearMem(ns)` 自动回收
- 跨 namespace 只读原则（owner = 主写模块；写者即 owner）
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

> **owner**: `BehaviorManager.js`（写）；Director 通过参数传入，不直接写 NPC 字段  
> 主题：NPC 生命周期、任务链、离场逻辑、路线注册

| 字段 | 写模块 | 读模块 | 备注 |
|------|--------|--------|------|
| `_profile` | BehaviorManager.js | WalkMode.js, GotoTask.js, BaseStateMachine.js, ModifierLayer.js, DebugOverlay.js | 广泛只读，owner 唯一 |
| `_agenda` | BehaviorManager.js | BehaviorManager.js | — |
| `_runner` | BehaviorManager.js | BehaviorManager.js | — |
| `_lifespan` | Director.js→BM参数→BM写, BaseStateMachine.js(extend) | BehaviorManager.js, Pedestrians.js | BaseStateMachine 只做 `+= N` 延长，语义一致 |
| `_ageTimer` | BehaviorManager.js, Director.js(init) | BehaviorManager.js | init 视为初始化 |
| `_departing` | BaseStateMachine.js | BehaviorManager.js, WalkMode.js, WaitForBusLayer.js, DebugOverlay.js | — |
| `_pendingDeparture` | BaseStateMachine.js | BaseStateMachine.js | — |
| `_exitBias` | BehaviorManager.js(via Director param) | ExitSceneTask.js | — |
| `_exitRegistry` | BehaviorManager.js(via Director param) | ExitSceneTask.js | 裁决：BM.register() 唯一写者；Director 经参数传入，不直接写 NPC |
| `_busStops` | BehaviorManager.js(via Director param) | ExitSceneTask.js | 同上 |
| `_waitForBusLayer` | BehaviorManager.js(via Director param) | ExitSceneTask.js | 同上 |
| `_preferExitType` | ExitSceneTask.js, BaseStateMachine.js(clear) | BaseStateMachine.js | clear 视为释放 |

> **⚠️ 待迁出（超出本次范围，记录备查）**  
> `_exitRegistry` / `_busStops` / `_waitForBusLayer` 本质是场景级服务引用，
> 每个 NPC 身上存的是同一个对象 —— 这是把服务定位器摊到实体上的反模式。
> 正解：BM 持有服务引用，经 context/envQuery 传给状态机；NPC 上不保存任何服务指针。
> 待下次重构状态机签名时顺手收掉。

---

## namespace: `modifier`

> **owner**: `ModifierLayer.js`（写者即 owner，不并入 loiter）

| 字段 | 写模块 | 读模块 | 备注 |
|------|--------|--------|------|
| `_gestureCooldown` | ModifierLayer.js | ModifierLayer.js | — |
| `_heldCooldown` | ModifierLayer.js | ModifierLayer.js | — |

---

## `_extraTags` — 删除，改为 mem 聚合

**现状**：五处写者（Motor.js、LoiterBehavior.js、WalkMode.js、StallActivity.js、UsePropActivity.js），
各写不同语义标签，互相覆盖；共享可变数组是根本病灶，换 API 只是礼貌地踩踏。

**裁决**：删除 `_extraTags` 字段。各 owner 写入自己 namespace 的 `tags` 子字段，
`getTags()` 聚合所有 `npc._mem[*].tags`（若存在）再拼静态 `this.tags`。

```js
// Npc.js — getTags() 聚合逻辑（新增）
if (this._mem) {
  for (const ns of Object.values(this._mem)) {
    if (ns.tags) for (const t of ns.tags) out.add(t);
  }
}

// 原写者改写示例 — LoiterBehavior.js
npc.mem('loiter').tags = ['loitering'];

// WalkMode.js（crossing 状态）
npc.mem('motor').tags = ['crossing'];

// StallActivity.js
npc.mem('social').tags = ['shopping'];

// clearMem 天然清理对应 ns 的 tags，无需额外逻辑
```

写权天然归各 namespace owner，无覆盖问题；`belief`/未来 namespace 的 tags 即插即用。

---

## 迁移后访问模式示例

```js
// LoiterBehavior.js — 读写同 namespace
const m = npc.mem('loiter');
m.dir ??= 1;
m.elapsed += dt;
if (m.elapsed > m.dur) { /* ... */ }

// ChessActivity.js
npc.mem('social').chessSlot = slot;

// 跨 namespace 只读（Motor.js 需要知道 loiter 是否激活）
const loiterDir = npc.mem('loiter').dir;  // ✓ 只读

// clearMem 由 BaseStateMachine.setState() 在状态切换时调用
npc.clearMem('loiter');
npc.clearMem('social');
```

---

## 最终字段总计

| namespace | 字段数 | 说明 |
|-----------|--------|------|
| `motor`   | 16 | ⚠️ `_walkMode` 两处写，语义一致，可接受 |
| `loiter`  | 7  | — |
| `social`  | 11 | — |
| `agenda`  | 12 | ⚠️ `_exitRegistry` 等三件套待迁出（服务引用上收） |
| `modifier`| 2  | ModifierLayer 独立 namespace（写者即 owner） |
| 不迁移    | 3  | `_sortY`、`_motorInstalled` 渲染接口 |
| 删除      | 1  | `_extraTags` → 各 ns 的 `.tags` 子字段 + getTags 聚合 |
| **合计**  | **52** | |
