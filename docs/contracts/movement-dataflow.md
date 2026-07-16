# Movement Dataflow Contract

> Normative. Describes present behavior; no fixes.
>
> Frame order anchor: `StreetScene#update` (`behaviorManager.update`, line 356) **then** `StreetScene#update` (`entityManager.update → integratePhysics`, line 362). BM runs first; integratePhysics is the last movement step of the same frame.

---

## 1 · Per-Frame Execution Order

| # | Caller | Function | What moves |
|---|--------|----------|-----------|
| 1 | `StreetScene.update` → `BehaviorManager.update` | `SocialLayer.update` | activity pair/tick |
| 2 | BM | `WaitForBusLayer.update` | bus-waiter zone scan (waiter tick → `WaitBusActivity.update` at step 1) |
| 3 | BM per-NPC | lifespan check (`!sc.activity` gate) → `triggerDeparture` → `_routeToExit` | sets `ag.departing`; saves + expands bounds (edge exits); sets `mot.routeTarget`; skipped while NPC is in an Activity (age accumulates, triggers on next frame after activity ends) |
| 4 | BM per-NPC | `Agenda.tick` | selects next desire (no-op if `sc.activity`) |
| 5 | BM per-NPC | `TaskRunner.tick` | ExitSceneTask / TalkToTask monitor |
| 6 | BM per-NPC | `tickBaseState`: `stateTimer += dt` | timer advance; `_evaluateTransitions` → may call `setState` |
| 7 | BM → `_tickState` | `tickWalkMode` | `direct._elapsed`; `path_follow.pauseTimer` |
| 8 | BM → `_tickState` → `steerRoam` — **routing** branch | timeout check; path plan; `applyLookahead` → `rvx/rvy`; `updateFacing(rvx, spd, dt)`; `nudgeXY` → `_slideMove` | position committed this step |
| 9 | BM → `_tickState` → `steerRoam` — **walk/run/jog** branch | writes `mot.vel = {vx,vy}` (after `applyLookahead`); `updateFacing(vx, total, dt)` updates `npc.direction` (with `dirCD` gate) | no position change yet |
| 10 | BM per-NPC | `checkZoneTransition` | `pushWalkMode` on road/bike-lane intrusion |
| 11 | BM per-NPC | `tickModifiers` | overlay gestures |
| 12 | BM | `_separate` → `nudgeXY` → `_slideMove` | separation pushes committed this step; uses positions from steps 8/9 |
| 13 | `StreetScene.update` → `EntityManager.update` → `Npc.update` → **`integratePhysics`** | `mot.vel` present: clamp `vel.vy` at Y boundary, consume `{vx,vy}` → `_slideMove`; `mot.vel` absent: stationary (no `_slideMove`) | **final position commitment of the frame** |

---

## 2 · Movement Variable Inventory

| Variable | Namespace | Writer | Reader | Cleared / overwritten | Unit | Active at step |
|----------|-----------|--------|--------|-----------------------|------|----------------|
| `x`, `y` | `npc` (protected `_mw`) | `setXY`, `nudgeXY` → `_slideMove` | `steerRoam`, `integratePhysics`, `_separate` | next write | px | 8, 12, 13 |
| `speed` | `npc` (protected) | `setState` (speed lookup in `STATE_DEFS`); `planCrossing` (`setSpeed` for jaywalk) | `planCrossing` crossing speed | `setState` | px/s | set 6, read WalkMode |
| `direction` | `npc` | `updateFacing(npc, vx, spd, dt)` called from both routing (step 8) and walk/run/jog (step 9) branches of `steerRoam` — `dirCD` 0.45 s hysteresis, `|vx|>spd×0.35` threshold; `triggerDeparture`; activity direct writes; `spot.facing`/`exit.facing` snapshots | `steerRoam` audit check; rendering | next write | ±1 | written 8, 9 |
| `vy` | `npc` | `setState` (=0); dead post-V-2 (routing writes removed) | none — `checkZoneTransition` migrated to `mot.vel?.vy` in V-2 | `setState` (=0) | px/s | — |
| `mot.vel` | `motor` | `steerRoam` walk branch: `= {vx, vy}` after `applyLookahead` | `Motor#integratePhysics`: both `.vx` and `.vy` consumed; Y boundary clamps `vy` before apply | consumed `= null` by `Motor#integratePhysics`, same frame | px/s | written 9, consumed 13 |
| `mot.walkMode` | `motor` | `setWalkMode`, `pushWalkMode`, `popWalkMode` | `steerRoam`, `integratePhysics` (progress + vel gate), `tickWalkMode`, `_separate._sepScale` | `setWalkMode(null)` at departure; `_defaultOnExit` clears stack on `setState` | — | 7–12 |
| `mot.walkModeStack` | `motor` | `pushWalkMode`, `popWalkMode` | `popWalkMode` | `_defaultOnExit` on `setState` | — | 7–12 |
| `mot.routeTarget` | `motor` | `_routeToExit` (step 3) | `steerRoam` routing branch (step 8) | cleared on arrival, timeout, or abort | — | 3, 8 |
| `mot.routePts` / `routeIdx` | `motor` | `steerRoam` routing branch (one-shot plan) | `steerRoam` routing branch | cleared on arrival/timeout | — | 8 |
| `mot.navPath` / `navIdx` / `navGoalX` / `navGoalY` | `motor` | `steerRoam` walk branch | `steerRoam` walk branch | cleared on roamTarget change, arrival, or progress-monitor stuck | — | 9 |
| `mot.dirCD` | `motor` | `steerRoam` walk branch (decremented by dt; reset to 0.45 on flip) | `steerRoam` walk branch | decremented by dt each call | s | 9 |
| `mot.progressAnchor` / `progressAcc` | `motor` | `integratePhysics` | `integratePhysics` | reset every 1.5 s | px / s | 13 |
| `mot.routeReplan` | `motor` | `integratePhysics` progress monitor (0 → 1 on first stuck, 1 → 0 + `stateTimer=9999` on second) | `integratePhysics` | reset to 0 when displaced ≥ 15 px | 0\|1 | 13 |
| `mot.savedBounds` | `motor` | `_routeToExit` (edge exits, step 3) | `restoreDepartureBounds` | cleared by `restoreDepartureBounds` | — | 3 |
| `npc.roamTarget` | `npc` | `pickModeTarget`, `onPathArrival`; `= null` on mode switch / arrival / progress stuck | `steerRoam` walk branch | null on goal change or stuck detection | {x,y}\|null | 9 |
| `npc.minX` / `maxX` / `minY` / `maxY` | `npc` | `_routeToExit` (E1 edge-exit expansion, step 3); `restoreDepartureBounds` | `_slideMove`, `integratePhysics` (bounce clamp / direction flip) | restored after departure or abort | px | 3, 8, 13 |
| `npc.stateTimer` | `npc` | `setState` (=0); `tickBaseState` (+=dt, step 6); `integratePhysics` (=9999 on second stuck, step 13) | `steerRoam` timeout check (step 8); `_evaluateTransitions` (step 6) | `setState` (=0) | s | 6, 8, 13 |

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
  _slideMove(npc, vx * dt, vy * dt);
}
// else: no vel → stationary this frame (no _slideMove called)
```

**Data flow:**
- Both **vx** and **vy** travel via `mot.vel` directly into `_slideMove`.
- `_slideMove` additionally clamps X displacement at `minX`/`maxX`.
- `npc.direction` carries only `sign(vx)` (with `dirCD` hysteresis) and is set in step 9.
- `npc.speed` is set by `setState` on state entry; routing/pausing branches no longer write it after V-2.
- `npc.vy` is reset to 0 by `setState` only; effectively dead post-V-2 (routing writes removed; `checkZoneTransition` reads `mot.vel?.vy`).

---

## 4 · Known Conflict Zones ⚠

| # | Variable | Conflict |
|---|----------|----------|
| a | `mot.vel` | **steer skipped** (`sc.activity` or other `continue`): `tickBaseState` is not called → `steerRoam` does not run → `mot.vel` is not set. `integratePhysics` finds `mot.vel` absent → NPC is stationary that frame. No stale scalar drift (the `direction × speed` scalar fallback was removed in V-1). |
| d | `ag.departing` + `npc.state` | **departure-activity race** (resolved in S-1): if `triggerDeparture` fired while `sc.activity` was set, `npc.state` would be set to `routing` but `tickBaseState` would be skipped → routing could never advance; when the Activity ended, `destroy()` would call `setState(walk)`, leaving `ag.departing=true` with no routeTarget (orphan). Fix: step 3 lifespan trigger gated on `!sc.activity`; age still accumulates so departure fires on the frame the Activity ends. |
| b | `npc.x`, `npc.y` | **steer uses pre-separation positions**: `steerRoam` (step 9) computes velocity from NPC position before `_separate` (step 12) has run. `integratePhysics` (step 13) then applies that velocity to the post-separation position. The steering direction may be slightly stale relative to the committed position. |
| c | `npc.stateTimer` | **one-frame delay on progress-monitor trigger**: `integratePhysics` writes `stateTimer = 9999` at step 13; `steerRoam`'s timeout check (`stateTimer > abandonAfter`) runs at step 8 in the **next** frame's BM pass. The 9999 value has no effect in the frame it is written. |