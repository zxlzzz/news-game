# Movement Dataflow Contract

> Normative. Updated through N-3c; routing chain deleted; Npc.js inline movement deleted; CYCLIST profile added; W-7a adds step 1.5 (event → witness claim consumption); tasks.md P-6 adds step 1.6 (memory mutation).
>
> **O-1 速度单位段（世界单位重标）**：本文件 §2 变量表里标 `px` / `px/s` 的字段
> （`x`/`y`、`speed`、`mot.vel`、`mot.faceAcc`、`minX/maxX/minY/maxY`）从 O-1 起
> 语义未变——一直是"世界坐标 / 世界坐标每秒"，只是 O-1 之前世界坐标恰好与屏幕
> 像素 1:1（无独立屏幕缩放层），`px` 是准确的口语说法。O-1 起世界坐标改为骨架
> 单位、各向同性，屏幕像素只在渲染最后一步经 `Layout.js#PX_PER_UNIT` 换算——
> 这些字段的**数值和消费路径全部不变**，只是不能再叫"px"，下表 Unit 列统一改
> 标"world units"/"world units/s"。裸世界像素常数迁移见 `docs/roadmap.md` O-1 条目。
>
> **M-1「信任路径」重构**：删除三层反应式避障 + 位置分离 + 卡死重规划——
> step 8 的 `applyLookahead`（Lookahead.js，含 35° 旋转 + 近墙减速）、step 12 `_separate`、
> step 13 的 `_lookaheadDeflect`（90° 偏转）与 progress-monitor（含 RECOVERY_RULES）。
> A* 路径已无碰撞，steerRoam 直接朝 waypoint 出速度；`_slideMove` 仍是"绝不踏入
> BLOCKED 格"硬兜底。不可达目标规划期即处理（goal→`_fireBlocked`，wander→steerRoam
> 丢 roamTarget）。下表 step 8/12/13、§3 代码、§2 变量表已按此更新。
>
> Frame order anchor: `StreetScene#update` (`behaviorManager.update`, line 356) **then** `StreetScene#update` (`entityManager.update → integratePhysics`, line 363). BM runs first; integratePhysics is the last movement step of the same frame.
>
> **M-1b（走路卡死修复，2026-08-07）**：step 8 的"Final destination arrival"改判
> `path.pts[path.pts.length-1]`（路径真实终点），不再判 `mot.goal.dest`/`roamTarget`
> 原始请求点——后者落在 `ZONE.BLOCKED`/`ROAD` 格时 `PathPlanner.plan()` 会把路径终点
> 吸附到最近可走格，原始点从此不可达，NPC 卡在吸附点永远判不到达、原地抖动直到
> goal 超时。同批把 `SteeringDecision.js#ARRIVAL_RULES` 的 `nav_waypoint`（30→16）
> `walk_goal`（23→14）调紧至不超过 `NPC_HALF_W` 换算的世界像素上限，见
> movement.md `NPC_HALF_W` 条目下的耦合注记——原阈值在人形骨架最大 scale 下会
> 超出安全边，让 NPC 停在贴近障碍物边缘的位置，下一腿走位被两侧都挡死。

---

## 1 · Per-Frame Execution Order

| # | Caller | Function | What moves |
|---|--------|----------|-----------|
| 1 | `StreetScene.update` → `BehaviorManager.update` | `SocialLayer.update` | activity pair/tick |
| 1.5 | BM | `WorldEventLog.drainNewEvents` → `Belief.generateClaims` (W-7a) | converts events emitted this frame (currently `TalkActivity.js`/`ContactActivity.js`, `ChessActivity.js` (P-3), `StallActivity.js` (P-4) call `emitEvent`) into witness claims written to `npc.mem('belief').claims`; `event.actors[]` ids resolved against `this.npcs` (missing → `null`, `Belief` tolerates); no position/state change |
| 1.6 | BM | `Belief.evolveMemory` (tasks.md P-6) | per-claim, per-slot memory mutation (forget/distort/transfer/fabricate); gated by an accumulator of elapsed *game* minutes (`gameClock()` delta this frame × 60, not real `dt`) crossing `MEMORY_EVOLUTION_INTERVAL_MIN`; runs independently of whether step 1.5 drained any events this frame; no position/state change |
| 2 | BM | `WaitForBusLayer.update` | bus-waiter zone scan only; waiter tick is a per-NPC `WaitBusTask` (Patch C), driven at step 5 like any other task |
| 3 | BM per-NPC | lifespan check (`!sc.activity && !sc.waitingBusStop` gate) → `triggerDeparture` → `_routeToExit` | sets `ag.departing`; saves + expands bounds (edge exits); publishes `mot.goal` (via `publishGoal`); skipped while NPC is in an Activity or waiting for a bus (age accumulates, triggers on next frame after either ends; `sc.waitingBusStop` half added in Patch C since waiting is now a Task and doesn't set `sc.activity`) |
| 4 | BM per-NPC | `Agenda.tick` | selects next desire (no-op if `sc.activity` or `runner.primary` already set) |
| 5 | BM per-NPC | `TaskRunner.tick` | ExitSceneTask / TalkToTask / WaitBusTask / StallSellerTask / ChessOnlookerTask / GotoTask etc. |
| 5.5 | BM per-NPC | `ensurePath(npc)` (`PlanService.js`) | syncs `mot.path` with `mot.goal`; fires 'blocked' if planner fails; resets `mot.needReplan` |
| 6 | BM per-NPC | `tickBaseState`: `stateTimer += dt` | timer advance; `_evaluateTransitions` → may call `setState` |
| 7 | BM → `_tickState` | `tickWalkMode` | `path_follow.pauseTimer`; wander `maxDuration` elapsed |
| 8 | BM → `_tickState` → `steerRoam` — **walk/run/jog** branch | writes `mot.vel = {vx,vy}` (**M-1**: 直接朝当前 waypoint，无 applyLookahead); advances `mot.path.idx`; wander 目标不可达（ensureWanderPath 失败）→ 丢 roamTarget 当帧 return（M-1，取代 progress-monitor wander 分支）; on goal arrival (distance or offWorld spatial) clears `mot.goal` + fires `onDone`; on `ZONE.ROAD` cell applies `SAFETY_RULES.jaywalk_sprint` (speedK×2.4, anim 'run') | no position change yet; `npc.direction` untouched here since L-1 — see step 13 |
| 8b | BM → `_tickState` — **ride** branch (N-3c) | writes `mot.vel = { vx: direction × speed, vy: 0 }` directly; no steerRoam, no goal, no path | no position change yet |
| 10 | BM per-NPC | `checkZoneTransition` | stateless `mot.vel` override: ejects wander NPC from road/bike-lane each frame (no push/pop stack) |
| 11 | BM per-NPC | `tickModifiers` | overlay gestures |
| ~~12~~ | ~~BM~~ | ~~`_separate`~~ | **M-1 删除**：NPC 位置分离已移除（C1 直接穿过）。`profile.separate` 字段随之惰性。 |
| 13 | `StreetScene.update` → `EntityManager.update` → `Npc.update` → **`integratePhysics`** | `mot.vel` present: clamp `vel.vy` at Y boundary, consume `{vx,vy}` → `_slideMove` (**M-1**: 无 `_lookaheadDeflect`；`_slideMove` 是唯一"绝不踏入 BLOCKED 格"硬兜底) → **`_updateDirection(npc, realDx)`** (L-1: `realDx = npc.x` before/after `_slideMove`; in `walk`/`run`/`jog`/`ride` states only, accumulates real dx into `mot.faceAcc`, flips `npc.direction` past `SAFETY_RULES.facing.deadZone × npc.scale`, resets accumulator on flip; also counts `dir_mismatch` when `sign(realDx) !== npc.direction`); `mot.vel` absent: stationary (no `_slideMove`, no facing update); **M-1: progress-monitor 已删除**（不可达目标规划期处理）; Npc.js inline movement deleted in N-3c — all registered NPCs use this path | **final position commitment of the frame; final facing commitment of the frame (L-1)** |

---

## 2 · Movement Variable Inventory

| Variable | Namespace | Writer | Reader | Cleared / overwritten | Unit | Active at step |
|----------|-----------|--------|--------|-----------------------|------|----------------|
| `x`, `y` | `npc` (protected `_mw`) | `setXY`, `nudgeXY` → `_slideMove` | `steerRoam`, `integratePhysics`, `_separate` | next write | world units | 8, 12, 13 |
| `speed` | `npc` (protected) | `setState` (speed lookup in `STATE_DEFS`) | BaseStateMachine ride 状态（`mot.vel` 构造）；BehaviorManager 出生時 `walkSpeed` 初始化 | `setState` | world units/s | set 6, read WalkMode |
| `direction` | `npc` | `Motor.js#_updateDirection(npc, realDx)` (L-1) — **sole writer while `state ∈ {walk,run,jog,ride}`**: space dead-zone over real x displacement (`mot.faceAcc`, threshold `SAFETY_RULES.facing.deadZone × npc.scale`), no time hysteresis; outside those states: `triggerDeparture`; activity direct writes; `spot.facing`/`exit.facing` snapshots | `_updateDirection` `dir_mismatch` audit check; rendering | next write | ±1 | written 13 |
| `vy` | `npc` | **deleted V3-a** (was dead post-V-2; `setState`归零行与字段同步删除) | — | — | — | — |
| `mot.vel` | `motor` | `steerRoam` walk branch: `= {vx, vy}` after `applyLookahead` | `Motor#integratePhysics`: both `.vx` and `.vy` consumed; Y boundary clamps `vy` before apply | consumed `= null` by `Motor#integratePhysics`, same frame | world units/s | written 8, consumed 13 |
| `mot.goal` | `motor` | `PlanService.publishGoal` (sole writer; clears on arrival/timeout/blocked) | `steerRoam` walk branch (arrival + timeout fire), `integratePhysics` (elapsed tick + timeout + progress two-hit), `BehaviorManager._sepScale` | cleared by whichever path fires result first; `onDone` callback called exactly once | — | 5.5, 8, 13 |
| `mot.path` | `motor` | `PlanService.ensurePath` / `ensureWanderPath` (sole writers) | `steerRoam` walk branch (idx advance + vel computation) | null on replan, blocked, arrival, or wander-roamTarget change | — | 5.5, 8 |
| `mot.needReplan` | `motor` | **M-1: 不再由任何写者置 `true`**（progress-monitor 已删）；仅 `ensurePath`/`publishGoal`/task 清为 `undefined` | `ensurePath` (step 5.5) | 通道保留待未来重规划触发 | bool | 5.5 |
| `mot.walkMode` | `motor` | `setWalkMode` | `steerRoam`, `integratePhysics` (vel gate), `tickWalkMode`, `checkZoneTransition` | `setWalkMode(null)` at departure; `_defaultOnExit` clears tags on `setState` | — | 7–12 |
| `mot.faceAcc` | `motor` | `Motor.js#_updateDirection` (accumulate real dx each frame in `walk`/`run`/`jog`/`ride`; reset to 0 on flip) — replaces the deleted `mot.dirCD` time cooldown (L-1) | `Motor.js#_updateDirection` | reset to 0 on flip; stale-but-inert outside the four facing states | world units | 13 |
| ~~`mot.progressAnchor` / `progressAcc`~~ | ~~`motor`~~ | **M-1 删除**（progress-monitor 整体移除） | — | — | — | — |
| `mot.savedBounds` | `motor` | `_routeToExit` (edge exits, step 3) | `restoreDepartureBounds` | cleared by `restoreDepartureBounds` | — | 3 |
| `npc.roamTarget` | `npc` | `pickModeTarget`, `onPathArrival`; `= null` on mode switch / arrival / **M-1: wander 目标不可达时（steerRoam）** | `steerRoam` walk branch | null on goal change or unreachable target | {x,y}\|null | 8 |
| `npc.minX` / `maxX` / `minY` / `maxY` | `npc` | `_routeToExit` (E1 edge-exit expansion, step 3); `restoreDepartureBounds` | `_slideMove`, `integratePhysics` (bounce clamp / direction flip) | restored after departure or abort | world units | 3, 8, 13 |
| `npc.stateTimer` | `npc` | `setState` (=0); `tickBaseState` (+=dt, step 6) | `_evaluateTransitions` (step 6) | `setState` (=0) | s | 6 |

---

## 3 · Unified vel Path (V-1)

`steerRoam` walk branch (step 9) writes one field:

```
mot.vel  = { vx, vy }           // computed from applyLookahead; only writer
```

`integratePhysics` (step 13, same frame):

```js
if (mot.vel) {
  let vx = mot.vel.vx, vy = mot.vel.vy;
  // Y boundary clamp: stop at minY/maxY (walkMode semantics — no bounce)
  const tentY = npc.y + vy * dt;
  if (npc.maxY != null && tentY > npc.maxY && npc.y <= npc.maxY) vy = 0;
  else if (npc.minY != null && tentY < npc.minY && npc.y >= npc.minY) vy = 0;
  mot.vel = null;
  // M-1: 无 _lookaheadDeflect——直接消费速度，_slideMove 为唯一"绝不踏入 BLOCKED 格"硬兜底。
  const _prevX = npc.x;
  _slideMove(npc, vx * dt, vy * dt);
  _updateDirection(npc, npc.x - _prevX);   // L-1: real-displacement facing, walk/run/jog/ride only
}
// else: no vel → stationary this frame (no _slideMove, no facing update)
```

**Data flow:**
- Both **vx** and **vy** travel via `mot.vel` directly into `_slideMove`.
- `_slideMove` additionally clamps X displacement at `minX`/`maxX`.
- `npc.direction` in `walk`/`run`/`jog`/`ride` states is derived from the *real* x
  displacement `_slideMove` just committed (space dead-zone over `mot.faceAcc`,
  L-1) — not from `vx`'s sign, and not set in step 9 anymore.
- `npc.speed` is set by `setState` on state entry only.
- `npc.vy` 已在 V3-a 删除（字段及 setState 归零行均移除；`checkZoneTransition` 早于此已迁至 `mot.vel?.vy`）。

---

## 4 · Known Conflict Zones ⚠

| # | Variable | Conflict |
|---|----------|----------|
| a | `mot.vel` | **steer skipped** (`sc.activity` or other `continue`): `tickBaseState` is not called → `steerRoam` does not run → `mot.vel` is not set. `integratePhysics` finds `mot.vel` absent → NPC is stationary that frame. No stale scalar drift (the `direction × speed` scalar fallback was removed in V-1). |
| d | `ag.departing` + `mot.goal` | **departure-activity race** (resolved in S-1, still applies): `triggerDeparture` is gated on `!sc.activity`; age accumulates while in Activity, so departure fires on the frame the Activity ends. N-3b: departing NPCs now in `walk` state with `mot.goal`; `_resolveTimeout` guards against spurious walk→stand transitions while `ag.departing && mot.goal` (G-1: narrowed from `ag.departing` — goal absent = anomalous state, allow normal selection). G-1: TRANSITIONS 'no-drive' (priority 8) converts walk/run with no walkMode + no goal → stand after 2s, preventing permanent frozen walk. |
| ~~b~~ | ~~`npc.x`, `npc.y`~~ | **M-1 消除**：`_separate`（step 12）已删除，steer 与积分之间不再有分离推挤，此"steer 用分离前位置"冲突不复存在。 |
| ~~c~~ | ~~`npc.stateTimer`~~ | **M-1 消除**：progress-monitor 已删除，其触发时序冲突不复存在。 |