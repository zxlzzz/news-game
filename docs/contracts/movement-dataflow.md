# Movement Dataflow Contract

> Normative. Describes present behavior; no fixes.

---

## 1 · Per-Frame Execution Order

| # | Caller | Function | What moves |
|---|--------|----------|-----------|
| 1 | `EntityManager.update` | `Npc.update` → `integratePhysics` | **Positions committed**: consumes `mot.vel` (if set) or `direction×speed`; calls `_slideMove` |
| 2 | `BehaviorManager.update` | `SocialLayer.update` | activity pair/tick |
| 3 | BM | `WaitForBusLayer.update` | bus waiter tick |
| 4 | BM per-NPC | lifespan check → `triggerDeparture` | sets `ag.departing`, expands bounds (E1), sets `mot.routeTarget` |
| 5 | BM per-NPC | `Agenda.tick` | selects next desire (no-op if `sc.activity`) |
| 6 | BM per-NPC | `TaskRunner.tick` | ExitSceneTask / TalkToTask monitor |
| 7 | BM per-NPC | `tickBaseState` | `stateTimer+=dt` → `_evaluateTransitions` → `setState` |
| 8 | BM → `_tickState` | `tickWalkMode` | `direct._elapsed`, `path_follow.pauseTimer` |
| 9 | BM → `_tickState` | `steerRoam` — **routing** branch | `nudgeXY` → `_slideMove` (position committed this frame) |
| 10 | BM → `_tickState` | `steerRoam` — **walk/run/jog** branch | ⚠ writes `mot.vel`, `setSpeed`, `npc.vy` — **consumed next frame by step 1** |
| 11 | BM per-NPC | `checkZoneTransition` | `pushWalkMode` if road/bike-lane intrusion |
| 12 | BM per-NPC | `tickModifiers` | overlay gestures |
| 13 | BM | `_separate` | inter-NPC `nudgeXY` → `_slideMove` |

---

## 2 · Movement Variable Inventory

| Variable | Namespace | Writer | Reader | Cleared / overwritten | Unit | Active at step |
|----------|-----------|--------|--------|-----------------------|------|----------------|
| `x`, `y` | `npc` (protected) | `_mw` via `setXY` / `nudgeXY` / `_slideMove` | `steerRoam`, `integratePhysics`, `_separate` | next write | px | 1, 9, 13 |
| `speed` | `npc` (protected) | `setState`, `setSpeed` | `integratePhysics` | `setState`(=speedK×walkSpeed); `setSpeed(0)` at routing entry | px/s | set 7–10, read 1 |
| `direction` | `npc` | `steerRoam` (±1 with `dirCD` gate), `triggerDeparture`, `planCrossing` | `integratePhysics` (scalar path), renderer | next steer write | ±1 | written 9–10, read 1 |
| `vy` | `npc` | `setState`(=0), `steerRoam`, `planCrossing`; `integratePhysics` (bounce clamp) | `integratePhysics` | `setState`(=0) | px/s | written 9–10, read 1 |
| `mot.vel` | `motor` | `steerRoam` walk branch (`= {vx,vy}`) | `integratePhysics` | ⚠ consumed `= null` by step 1 of **next** frame | px/s | written 10, consumed 1 (+1 frame) |
| `mot.walkMode` | `motor` | `setWalkMode`, `pushWalkMode`, `popWalkMode` | `steerRoam`, `integratePhysics` (progress), `tickWalkMode`, `_separate._sepScale` | `setWalkMode(null)` at departure; `_defaultOnExit` pops stack on `setState` | — | 8–11 |
| `mot.walkModeStack` | `motor` | `pushWalkMode`, `popWalkMode` | `popWalkMode` | `_defaultOnExit` on `setState` (if target is walk/run) | — | 8–11 |
| `mot.routeTarget` | `motor` | `_routeToExit` | `steerRoam` | cleared on arrival, timeout, or abort | — | 4, 9 |
| `mot.routePts` / `routeIdx` | `motor` | `steerRoam` (one-shot plan) | `steerRoam` | cleared on arrival/timeout | — | 9 |
| `mot.navPath` / `navIdx` / `navGoalX` / `navGoalY` | `motor` | `steerRoam` walk branch | `steerRoam` | cleared on roamTarget change or arrival | — | 10 |
| `mot.dirCD` | `motor` | `steerRoam` walk branch | `steerRoam` | decremented by dt | s | 10 |
| `mot.progressAnchor` / `progressAcc` | `motor` | `integratePhysics` | `integratePhysics` | reset every 1.5 s | px / s | 1 |
| `mot.routeReplan` | `motor` | `integratePhysics` (progress monitor) | `integratePhysics` | cleared after second stuck interval (triggers `stateTimer=9999`) | 0\|1 | 1 |
| `mot.savedBounds` | `motor` | `_routeToExit` (edge exits) | `restoreDepartureBounds` | cleared by `restoreDepartureBounds` | — | 4 |
| `npc.roamTarget` | `npc` | `pickModeTarget`, `onPathArrival` | `steerRoam` | `null` on mode switch, arrival, or `setState` with wander mode | {x,y}\|null | 10 |
| `npc.minX` / `maxX` / `minY` / `maxY` | `npc` | `_routeToExit` (E1 expansion), `restoreDepartureBounds` | `_slideMove`, `integratePhysics` (direction bounce) | restored post-departure or abort | px | 1, 4, 9 |
| `npc.stateTimer` | `npc` | `setState`(=0); `tickBaseState`(+=dt); ⚠ `integratePhysics`(=9999 on double-stuck) | `steerRoam` (timeout), `_evaluateTransitions` | `setState`(=0) | s | 1, 7, 9 |

---

## 3 · Goal-Directed → Scalar Compression Point

`steerRoam` (walk/run/jog branch, step 10) computes a full velocity vector `{vx, vy}` via `applyLookahead` and writes:

```
mot.vel = { vx, vy }          // goal-directed, full 2-D vector — survives until step 1 next frame
setSpeed(npc, hypot(vx, vy))  // scalar magnitude (speed field)
npc.vy = vy                   // Y component duplicated into npc.vy
npc.direction = sign(vx)      // ⚠ compression: X direction collapsed to ±1 with hysteresis gate
```

`integratePhysics` (step 1, **next** frame):

```
dx = mot.vel.vx * dt          // goal-directed path — vy still intact
dy = mot.vel.vy * dt
mot.vel = null                // ⚠ information destroyed here: after _slideMove only x/y remain
```

**Information loss** occurs at `mot.vel = null`. After that point, the original `{vx, vy}` is gone; only the resulting position and `direction` (±1) persist. The routing branch (step 9) never writes `mot.vel`; it calls `nudgeXY` directly, so no one-frame lag exists there.

---

## 4 · Known Conflict Zones ⚠

| Variable | Conflict | Row above |
|----------|----------|-----------|
| `mot.vel` | Written by `steerRoam` at step 10; consumed by `integratePhysics` at step 1 of the **next** frame. If `sc.activity` blocks `tickBaseState` this frame, old `mot.vel` is consumed by step 1 instead of fresh steer output. | `mot.vel` |
| `mot.vel` | If routing branch fires (`nudgeXY` direct, step 9) on an NPC that still has a stale `mot.vel` from the previous frame's walk-branch steer, `integratePhysics` consumes the stale `mot.vel` first (step 1) before routing begins — one frame double-move. | `mot.vel` |
| `npc.direction` | Compressed from `vx` to ±1 at step 10 with a 0.45 s cooldown gate (`dirCD`). Y-axis goal information is not reflected in `direction`; `audit.dir_mismatch` fires when `sign(vx) ≠ npc.direction` mid-move. | `direction` |
| `npc.stateTimer` | Force-set to 9999 by `integratePhysics` progress monitor (step 1) after two consecutive stuck intervals — bypasses `tickBaseState`'s normal increment and triggers `abandonAfter` check in `steerRoam` (step 9) on the same frame's BM pass. | `npc.stateTimer` |
