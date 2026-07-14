# Movement Dataflow Contract

> Normative. Describes present behavior; no fixes.
>
> Frame order anchor: `StreetScene#update` (`behaviorManager.update`, line 356) **then** `StreetScene#update` (`entityManager.update → integratePhysics`, line 362). BM runs first; integratePhysics is the last movement step of the same frame.

---

## 1 · Per-Frame Execution Order

| # | Caller | Function | What moves |
|---|--------|----------|-----------|
| 1 | `StreetScene.update` → `BehaviorManager.update` | `SocialLayer.update` | activity pair/tick |
| 2 | BM | `WaitForBusLayer.update` | bus waiter tick |
| 3 | BM per-NPC | lifespan check → `triggerDeparture` → `_routeToExit` | sets `ag.departing`; saves + expands bounds (edge exits); sets `mot.routeTarget` |
| 4 | BM per-NPC | `Agenda.tick` | selects next desire (no-op if `sc.activity`) |
| 5 | BM per-NPC | `TaskRunner.tick` | ExitSceneTask / TalkToTask monitor |
| 6 | BM per-NPC | `tickBaseState`: `stateTimer += dt` | timer advance; `_evaluateTransitions` → may call `setState` |
| 7 | BM → `_tickState` | `tickWalkMode` | `direct._elapsed`; `path_follow.pauseTimer` |
| 8 | BM → `_tickState` → `steerRoam` — **routing** branch | `setSpeed(0)`; timeout check; path plan; `nudgeXY` → `_slideMove` | position committed this step |
| 9 | BM → `_tickState` → `steerRoam` — **walk/run/jog** branch | writes `mot.vel = {vx,vy}`; `setSpeed(hypot(vx,vy))`; `npc.vy = vy`; updates `npc.direction` (with `dirCD` gate) | no position change yet |
| 10 | BM per-NPC | `checkZoneTransition` | `pushWalkMode` on road/bike-lane intrusion |
| 11 | BM per-NPC | `tickModifiers` | overlay gestures |
| 12 | BM | `_separate` → `nudgeXY` → `_slideMove` | separation pushes committed this step; uses positions from steps 8/9 |
| 13 | `StreetScene.update` → `EntityManager.update` → `Npc.update` → **`integratePhysics`** | consume `mot.vel` (vx channel) + `npc.vy` (vy channel) → `_slideMove` | **final position commitment of the frame** |

---

## 2 · Movement Variable Inventory

| Variable | Namespace | Writer | Reader | Cleared / overwritten | Unit | Active at step |
|----------|-----------|--------|--------|-----------------------|------|----------------|
| `x`, `y` | `npc` (protected `_mw`) | `setXY`, `nudgeXY` → `_slideMove` | `steerRoam`, `integratePhysics`, `_separate` | next write | px | 8, 12, 13 |
| `speed` | `npc` (protected) | `setState` (speed lookup in `STATE_DEFS`); `setSpeed`; `setSpeed(0)` in routing `steerRoam` | `integratePhysics` (scalar fallback path) | `setState`; `setSpeed(0)` at routing entry | px/s | set 6–9, read 13 |
| `direction` | `npc` | `steerRoam` (walk branch, `dirCD` gate); `triggerDeparture`; `planCrossing` | `integratePhysics` (scalar fallback) | next write | ±1 | written 9, read 13 |
| `vy` | `npc` | `setState` (=0); `steerRoam` walk branch (= `lookahead.vy`); `planCrossing`; bounce clamp in `integratePhysics` | `Motor#integratePhysics` (tentY probe, line 297; dy assignment, line 303) | `setState` (=0); bounce clamp | px/s | written 9, read 13 |
| `mot.vel` | `motor` | `steerRoam` walk branch: `= {vx, vy}` | `Motor#integratePhysics`: only `.vx` is used (`.vy` is ⚠ dead — see §3) | consumed `= null` by `Motor#integratePhysics` (line 288), same frame | px/s | written 9, consumed 13 |
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

## 3 · Goal-Directed → Scalar Compression and vy Dead-Code

`steerRoam` walk branch (step 9) writes three fields:

```
mot.vel  = { vx, vy }           // computed from applyLookahead
setSpeed(npc, hypot(vx, vy))    // scalar magnitude stored in npc.speed
npc.vy   = vy                   // explicit copy into vy channel
```

`integratePhysics` (step 13, same frame):

```js
if (wm && mot.vel) {
  dx = mot.vel.vx * dt;   // vx channel — used
  dy = mot.vel.vy * dt;   // ⚠ DEAD: overwritten unconditionally two lines later
  mot.vel = null;          // clears mot.vel → !mot.vel is now true
}
// … bounce-clamp npc.vy (may modify it) …
if (!mot.vel) dy = npc.vy * dt;   // always true after vel branch; overwrites dy above
_slideMove(npc, dx, dy);
```

**Actual data flow:**
- **vx** travels via `mot.vel.vx` → `dx`
- **vy** travels via `npc.vy` (bounce-clamped) → `dy`; `mot.vel.vy` is never consumed

**Compression point:** after `_slideMove`, the full `{vx, vy}` vector is gone. `npc.speed = hypot(vx, vy)` retains the magnitude, and `npc.direction` retains only `sign(vx)` (with hysteresis). vy information survives only as the displacement already applied to `npc.y`.

---

## 4 · Known Conflict Zones ⚠

| # | Variable | Conflict |
|---|----------|----------|
| a | `mot.vel`, `npc.speed`, `npc.vy` | **steer skipped** (`sc.activity` or other `continue`): `tickBaseState` is not called → `steerRoam` does not run → `mot.vel` is not set. `integratePhysics` falls to the scalar path: `dx = npc.direction × npc.speed × dt` where `npc.speed = hypot(vx, vy)` from the last steer call. The NPC moves at full vector magnitude in a purely horizontal direction. `npc.vy` (stale from last steer) still contributes `dy`, but `npc.speed` is the hypot scalar, so horizontal motion is inflated if the last steer had significant vy. |
| b | `npc.x`, `npc.y` | **steer uses pre-separation positions**: `steerRoam` (step 9) computes velocity from NPC position before `_separate` (step 12) has run. `integratePhysics` (step 13) then applies that velocity to the post-separation position. The steering direction may be slightly stale relative to the committed position. |
| c | `npc.stateTimer` | **one-frame delay on progress-monitor trigger**: `integratePhysics` writes `stateTimer = 9999` at step 13; `steerRoam`'s timeout check (`stateTimer > abandonAfter`) runs at step 8 in the **next** frame's BM pass. The 9999 value has no effect in the frame it is written. |