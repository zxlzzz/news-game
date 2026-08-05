# Movement Dataflow Contract

> Normative. Updated through N-3c; routing chain deleted; Npc.js inline movement deleted; CYCLIST profile added; W-7a adds step 1.5 (event → witness claim consumption).
>
> Frame order anchor: `StreetScene#update` (`behaviorManager.update`, line 356) **then** `StreetScene#update` (`entityManager.update → integratePhysics`, line 363). BM runs first; integratePhysics is the last movement step of the same frame.

---

## 1 · Per-Frame Execution Order

| # | Caller | Function | What moves |
|---|--------|----------|-----------|
| 1 | `StreetScene.update` → `BehaviorManager.update` | `SocialLayer.update` | activity pair/tick |
| 1.5 | BM | `WorldEventLog.drainNewEvents` → `Belief.generateClaims` (W-7a) | converts events emitted this frame (currently only `TalkActivity.js#emitEvent`) into witness claims written to `npc.mem('belief').claims`; `event.actors[]` ids resolved against `this.npcs` (missing → `null`, `Belief` tolerates); no position/state change |
| 2 | BM | `WaitForBusLayer.update` | bus-waiter zone scan (waiter tick → `WaitBusActivity.update` at step 1) |
| 3 | BM per-NPC | lifespan check (`!sc.activity` gate) → `triggerDeparture` → `_routeToExit` | sets `ag.departing`; saves + expands bounds (edge exits); publishes `mot.goal` (via `publishGoal`); skipped while NPC is in an Activity (age accumulates, triggers on next frame after activity ends) |
| 4 | BM per-NPC | `Agenda.tick` | selects next desire (no-op if `sc.activity`) |
| 5 | BM per-NPC | `TaskRunner.tick` | ExitSceneTask / TalkToTask monitor |
| 5.5 | BM per-NPC | `ensurePath(npc)` (`PlanService.js`) | syncs `mot.path` with `mot.goal`; fires 'blocked' if planner fails; resets `mot.needReplan` |
| 6 | BM per-NPC | `tickBaseState`: `stateTimer += dt` | timer advance; `_evaluateTransitions` → may call `setState` |
| 7 | BM → `_tickState` | `tickWalkMode` | `path_follow.pauseTimer`; wander `maxDuration` elapsed |
| 8 | BM → `_tickState` → `steerRoam` — **walk/run/jog** branch | writes `mot.vel = {vx,vy}` (after `applyLookahead`); advances `mot.path.idx`; on goal arrival (distance or offWorld spatial) clears `mot.goal` + fires `onDone`; on `ZONE.ROAD` cell applies `SAFETY_RULES.jaywalk_sprint` (speedK×2.4, anim 'run') | no position change yet; `npc.direction` untouched here since L-1 — see step 13 |
| 8b | BM → `_tickState` — **ride** branch (N-3c) | writes `mot.vel = { vx: direction × speed, vy: 0 }` directly; no steerRoam, no goal, no path; CYCLIST profile `separate:false` skips `_separate` | no position change yet |
| 10 | BM per-NPC | `checkZoneTransition` | stateless `mot.vel` override: ejects wander NPC from road/bike-lane each frame (no push/pop stack) |
| 11 | BM per-NPC | `tickModifiers` | overlay gestures |
| 12 | BM | `_separate` → `nudgeXY` → `_slideMove` | separation pushes committed this step; uses positions from steps 8/9; NPCs with `profile.separate === false` excluded from both movers and statics |
| 13 | `StreetScene.update` → `EntityManager.update` → `Npc.update` → **`integratePhysics`** | `mot.vel` present: clamp `vel.vy` at Y boundary, consume `{vx,vy}` → **`_lookaheadDeflect`** (NavGrid read: probes `SAFETY_RULES.wall_avoid.probeCells` cells ahead; if blocked and current cell walkable, rotates velocity 90° to clear perpendicular side; counts `avoid_steer`; no-op if both sides blocked) → `_slideMove` → **`_updateDirection(npc, realDx)`** (L-1: `realDx = npc.x` before/after `_slideMove`; in `walk`/`run`/`jog`/`ride` states only, accumulates real dx into `mot.faceAcc`, flips `npc.direction` past `SAFETY_RULES.facing.deadZone × npc.scale`, resets accumulator on flip; also counts `dir_mismatch` when `sign(realDx) !== npc.direction`); `mot.vel` absent: stationary (no `_slideMove`, no facing update); progress monitor uses `RECOVERY_RULES.progress_monitor` (window 1.5 s, movedLT 15 px); Npc.js inline movement deleted in N-3c — all registered NPCs use this path | **final position commitment of the frame; final facing commitment of the frame (L-1)** |

---

## 2 · Movement Variable Inventory

| Variable | Namespace | Writer | Reader | Cleared / overwritten | Unit | Active at step |
|----------|-----------|--------|--------|-----------------------|------|----------------|
| `x`, `y` | `npc` (protected `_mw`) | `setXY`, `nudgeXY` → `_slideMove` | `steerRoam`, `integratePhysics`, `_separate` | next write | px | 8, 12, 13 |
| `speed` | `npc` (protected) | `setState` (speed lookup in `STATE_DEFS`) | BaseStateMachine ride 状态（`mot.vel` 构造）；BehaviorManager 出生時 `walkSpeed` 初始化 | `setState` | px/s | set 6, read WalkMode |
| `direction` | `npc` | `Motor.js#_updateDirection(npc, realDx)` (L-1) — **sole writer while `state ∈ {walk,run,jog,ride}`**: space dead-zone over real x displacement (`mot.faceAcc`, threshold `SAFETY_RULES.facing.deadZone × npc.scale`), no time hysteresis; outside those states: `triggerDeparture`; activity direct writes; `spot.facing`/`exit.facing` snapshots | `_updateDirection` `dir_mismatch` audit check; rendering | next write | ±1 | written 13 |
| `vy` | `npc` | **deleted V3-a** (was dead post-V-2; `setState`归零行与字段同步删除) | — | — | — | — |
| `mot.vel` | `motor` | `steerRoam` walk branch: `= {vx, vy}` after `applyLookahead` | `Motor#integratePhysics`: both `.vx` and `.vy` consumed; Y boundary clamps `vy` before apply | consumed `= null` by `Motor#integratePhysics`, same frame | px/s | written 8, consumed 13 |
| `mot.goal` | `motor` | `PlanService.publishGoal` (sole writer; clears on arrival/timeout/blocked) | `steerRoam` walk branch (arrival + timeout fire), `integratePhysics` (elapsed tick + timeout + progress two-hit), `BehaviorManager._sepScale` | cleared by whichever path fires result first; `onDone` callback called exactly once | — | 5.5, 8, 13 |
| `mot.path` | `motor` | `PlanService.ensurePath` / `ensureWanderPath` (sole writers) | `steerRoam` walk branch (idx advance + vel computation) | null on replan, blocked, arrival, or wander-roamTarget change | — | 5.5, 8 |
| `mot.needReplan` | `motor` | `integratePhysics` progress monitor first hit (→ `true`); cleared by `ensurePath` | `ensurePath` (step 5.5) | cleared by `ensurePath` after replan | bool | 5.5, 13 |
| `mot.walkMode` | `motor` | `setWalkMode` | `steerRoam`, `integratePhysics` (vel gate), `tickWalkMode`, `checkZoneTransition` | `setWalkMode(null)` at departure; `_defaultOnExit` clears tags on `setState` | — | 7–12 |
| `mot.faceAcc` | `motor` | `Motor.js#_updateDirection` (accumulate real dx each frame in `walk`/`run`/`jog`/`ride`; reset to 0 on flip) — replaces the deleted `mot.dirCD` time cooldown (L-1) | `Motor.js#_updateDirection` | reset to 0 on flip; stale-but-inert outside the four facing states | px (world, at current depth scale) | 13 |
| `mot.progressAnchor` / `progressAcc` | `motor` | `integratePhysics` | `integratePhysics` | reset every `RECOVERY_RULES.progress_monitor.window` (1.5 s) | px / s | 13 |
| `mot.savedBounds` | `motor` | `_routeToExit` (edge exits, step 3) | `restoreDepartureBounds` | cleared by `restoreDepartureBounds` | — | 3 |
| `npc.roamTarget` | `npc` | `pickModeTarget`, `onPathArrival`; `= null` on mode switch / arrival / progress stuck | `steerRoam` walk branch | null on goal change or stuck detection | {x,y}\|null | 9 |
| `npc.minX` / `maxX` / `minY` / `maxY` | `npc` | `_routeToExit` (E1 edge-exit expansion, step 3); `restoreDepartureBounds` | `_slideMove`, `integratePhysics` (bounce clamp / direction flip) | restored after departure or abort | px | 3, 8, 13 |
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
  // Motor-level lookahead deflect (責任3-E): NavGrid read, perpendicular 90° rotation,
  // fires after separation (step 12) which can push NPC near walls.
  const defl = _lookaheadDeflect(npc, vx, vy);
  const _prevX = npc.x;
  _slideMove(npc, defl.vx * dt, defl.vy * dt);
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
| b | `npc.x`, `npc.y` | **steer uses pre-separation positions**: `steerRoam` (step 9) computes velocity from NPC position before `_separate` (step 12) has run. `integratePhysics` (step 13) then applies that velocity to the post-separation position. The steering direction may be slightly stale relative to the committed position. |
| c | `npc.stateTimer` | **one-frame delay on progress-monitor trigger**: `integratePhysics` writes `stateTimer = 9999` at step 13; `steerRoam`'s timeout check (`stateTimer > abandonAfter`) runs at step 8 in the **next** frame's BM pass. The 9999 value has no effect in the frame it is written. |