# Movement Subsystem Contract

verified at ddc77846154d3cb51fef63ba83f06feeb0accd0c (V-1 velocity unification)

All writers listed as `file#symbol (line)`. Line numbers are parenthetical
annotations only — anchor is the symbol name. Verified by grep on HEAD.

---

## Shared State Registry

### `npc.x` / `npc.y`

| | |
|---|---|
| **Semantic** | World-coordinate ground-contact point; `y` is the pixel line where the NPC's feet touch the ground. Rendering formula: `screen_y = npc.y + joint[1] * scale` (joint y=0 = ground). |
| **Owner** | `Motor.js#_mw` — sole authorised writer gate |
| **Writers** | `Motor.js#setXY` (253), `Motor.js#_slideMove` (207-250, all move branches), `Motor.js#integratePhysics` (278 leash path); `seat.js#_setXY` (36) — conditional fallback only when `_motorInstalled` is false (cyclists hit this path) |
| **Readers** | All rendering code, `StuckProbe.js`, `BehaviorManager.js#_separate`, `EnvironmentQuery.js`, `WalkMode.js`, `NavGrid.js`, `BaseStateMachine.js#steerRoam`, `seat.js` |
| **Invariant** | Must not be written outside Motor.js API (`setXY`/`nudgeXY`). `npc.y` offsets must never compensate for clip ground-contact errors — fix the clip JSON instead. |

---

### `npc.speed`

| | |
|---|---|
| **Semantic** | Scalar speed magnitude in pixels/second; sign-free (direction carries sign). Zero means stationary. |
| **Owner** | `Motor.js` |
| **Writers** | `Motor.js#setState` (154, via `_mw`), `Motor.js#setSpeed` (263) — routing entry and `path_follow` pausing write `setSpeed(0)`; walk branch no longer writes speed after V-1 |
| **Readers** | `Motor.js#integratePhysics` progress monitor (`speed === 0` audit), `BaseStateMachine.js#steerRoam` (audit guard), `StuckProbe.js` (26) |
| **Invariant** | Only via `setState` or `setSpeed`. Raw `npc.speed =` anywhere else is a contract violation. |

---

### `npc.state`

| | |
|---|---|
| **Semantic** | Current behaviour state string: `walk`, `run`, `jog`, `stand`, `sit_bench`, `lie_bench`, `lean_wall`, `squat`, `sit_ground`, `lie_ground`, `get_up`, `fall`, `talk`, `loiter`, `routing`, `chess`, `chess_onlooker`. Full definitions in `Motor.js#STATE_DEFS`. |
| **Owner** | `Motor.js` |
| **Writers** | `Motor.js#setState` (154, via `_mw`) — sole write path |
| **Readers** | `BaseStateMachine.js#_tickState` (176), `BaseStateMachine.js#steerRoam` (188), `BaseStateMachine.js#tickBaseState` (363), `BehaviorManager.js#update` (143), `WaitForBusLayer.js` (46, 59, 63), `UseBenchTask.js` (60), `StuckProbe.js` (26, 27) |
| **Invariant** | All state transitions go through `setState(npc, state, trigger)`. `npc.state =` anywhere except `Motor.js` and `Npc.js` constructor is a violation. |

---

### `npc.animation`

| | |
|---|---|
| **Semantic** | Current clip id string (from `manifest.json`). `StickRenderer` uses this as the lookup key — no alias layer. Default is `'stand'` (not `'idle'`). |
| **Owner** | `Motor.js` |
| **Writers** | `Motor.js#setState` (154, via `_mw`), `Motor.js#setAnimation` (268) |
| **Readers** | `Npc.js#update` (animation loop), `StuckProbe.js` (51), rendering layer |
| **Invariant** | Must be a valid clip id from `manifest.json`. Only `setState` or `setAnimation` may write it. |

---

### `npc.direction`

| | |
|---|---|
| **Semantic** | Horizontal facing: `1` = right, `-1` = left. Used for physics `dx` and rendering mirror. |
| **Owner** | Unprotected — multiple owners by convention |
| **Writers** | `Npc.js` constructor (65 — init), `Npc.js#update` (254 — leash sync, 281-282 — bounds fallback); `Motor.js#_defaultOnExit` (141 — loiter dir restore), `Motor.js#integratePhysics` (278 — leash sync, 287-288 — bounds bounce, 335 — reversal); `Pedestrians.js#spawnOnePedestrian` (107 — spawn facing); `LoiterBehavior.js#tickLoiter` (42 — micro-phase dir restore); `TalkActivity.js#_faceEachOther` (74-75 — mutual face); `StallActivity.js#activate` (60 — seller face, 61 — buyer face); `UsePropActivity.js#activate` (33 — face prop); `ChessActivity.js#start` (65 — face table); `Director.js#_spawnNPC` (157 — spawn facing); `BaseStateMachine.js#_resolveTimeout` (118 — lean_wall spot facing), `BaseStateMachine.js#steerRoam` (238 — steer direction, 323 — desired facing), `BaseStateMachine.js#_routeToExit` (332 — exit facing) |
| **Readers** | `CigaretteProp.js` (29, 41), `seat.js#alignLie` (101), `BaseStateMachine.js#steerRoam` (audit check, direction update) |
| **Invariant** | Value must always be exactly `1` or `-1`. No floating-point normalisation. |

---

### `npc.vy`

| | |
|---|---|
| **Semantic** | Vertical velocity in pixels/second (positive = downward in screen space). Used for road crossing control; no longer read by `integratePhysics` after V-1 (consumed path uses `mot.vel.vy`). |
| **Owner** | Shared: `Motor.js` (reset on setState) and `BaseStateMachine.js` (crossing control) |
| **Writers** | `Motor.js#setState` (166 — reset to 0); `BaseStateMachine.js#steerRoam` (routing reset to 0 on entry/exit); `WalkMode.js#planCrossing` (sets non-zero crossing vy) |
| **Readers** | `WalkMode.js#planCrossing` (goingDown test) |
| **Invariant** | Reset to 0 on every `setState`. Only `planCrossing` and routing entry/exit legitimately set values. Not read by `integratePhysics`; Y motion driven by `mot.vel.vy` in the unified vel path. |

---

### `npc.roamTarget`

| | |
|---|---|
| **Semantic** | Current short-range steer target `{x, y}` for `steerRoam`. `null` when no target; `steerRoam` calls `pickModeTarget` when null (unless `pausing=true` in path_follow mode). |
| **Owner** | `WalkMode.js` (target lifecycle) and `Motor.js` (reset on mode change) |
| **Writers** | `WalkMode.js#pickModeTarget` (219 — direct, 236 — path_follow, 247 — null fallback, 255 — wander random); `WalkMode.js#_pickRandom` (258 — null on fail); `WalkMode.js#onPathArrival` (286, 288 — null); `WalkMode.js#tickWalkMode` (335 — null on arrival); `Motor.js#setWalkMode` (77), `Motor.js#pushWalkMode` (85), `Motor.js#popWalkMode` (92), `Motor.js#_defaultOnExit` (101), `Motor.js#setState` (173), `Motor.js#integratePhysics` (319, 324 — progress monitor) |
| **Readers** | `BaseStateMachine.js#steerRoam` (251, 252, 254), `StuckProbe.js` (46) |
| **Invariant** | Nulled on every `setWalkMode`/`pushWalkMode`/`popWalkMode`. Never left as stale non-null from a previous walk mode. |

---

### `npc.mem('motor').walkMode`

| | |
|---|---|
| **Semantic** | Current walk mode descriptor: `{kind:'wander',...}`, `{kind:'direct',...}`, `{kind:'path_follow',...}`, or `null` for raw physics only. |
| **Owner** | `Motor.js` (API: `setWalkMode` / `pushWalkMode` / `popWalkMode`) |
| **Writers** | `Motor.js#setWalkMode` (73), `Motor.js#pushWalkMode` (80), `Motor.js#popWalkMode` (88, stack pop), `Motor.js#_defaultOnExit` (101, stack pop on walk/run) |
| **Readers** | `WalkMode.js#checkZoneTransition` (178), `WalkMode.js#pickModeTarget` (205), `WalkMode.js#_pickRandom` (228), `WalkMode.js#tickWalkMode` (327); `BehaviorManager.js#_sepScale` (160); `BaseStateMachine.js#_tickState` (181); `Motor.js#setState` (157), `Motor.js#integratePhysics` (266, 287, 299, 308, 324, 335) |
| **Invariant** | Never written directly — always via `setWalkMode`/`pushWalkMode`/`popWalkMode`. Switching walk mode always nulls `npc.roamTarget`. |

---

### `npc.mem('motor').walkModeStack`

| | |
|---|---|
| **Semantic** | LIFO stack of suspended walk mode descriptors. `pushWalkMode` saves current mode before priority interrupt; `popWalkMode` restores it. |
| **Owner** | `Motor.js` |
| **Writers** | `Motor.js#setWalkMode` (74 — init), `Motor.js#pushWalkMode` (82-84 — push), `Motor.js#popWalkMode` (88-91 — pop), `Motor.js#_defaultOnExit` (100-101 — pop on walk/run transition) |
| **Readers** | `Motor.js#popWalkMode` (88), `Motor.js#_defaultOnExit` (100), `WalkMode.js#tickWalkMode` (340) |
| **Invariant** | Only modified via `pushWalkMode`/`popWalkMode`. Crossing (`planCrossing`) pushes before starting; `popWalkMode` or `_defaultOnExit` restores. |

---

### `npc.mem('motor').navPath` / `.navIdx` / `.navGoalX` / `.navGoalY`

| | |
|---|---|
| **Semantic** | Sub-path from `PathPlanner#plan` for `steerRoam` to follow toward `roamTarget`. `navPath` is `[{x,y}]`; `navIdx` is current waypoint index; `navGoalX/Y` cache-invalidation key (replanned when mismatched). |
| **Owner** | `BaseStateMachine.js#steerRoam` |
| **Writers** | `BaseStateMachine.js#steerRoam` (257-261 — goal mismatch replan, 269-270 — store result, 285 — arrival clear); `Motor.js#integratePhysics` (298, 303 — progress monitor clear) |
| **Readers** | `BaseStateMachine.js#steerRoam` (257, 276-277, 284-285) |
| **Invariant** | Nulled on goal change (`navGoalX/Y` mismatch) and on progress-monitor stuck. `steerRoam` replans next frame after null. |

---

### `npc.mem('motor').routeTarget` / `.routePts` / `.routeIdx`

| | |
|---|---|
| **Semantic** | High-level routing destination `{x, y, exitType?, abandonAfter?}` set by callers before entering `routing` state. `routePts` is the computed waypoint sequence; `routeIdx` is current index. |
| **Owner** | `BaseStateMachine.js#steerRoam` (consumes), set by callers before entering `routing` |
| **Writers** | `BaseStateMachine.js#triggerDeparture` (336 — set destination); `WaitForBusLayer.js#_startBoarding` (127, via inner `routeToDoor`); `BaseStateMachine.js#steerRoam` (200, 229 — clear on arrival/timeout); `Motor.js#integratePhysics` (312, 313 — clear on stuck) |
| **Readers** | `BaseStateMachine.js#steerRoam` (194, 195), `DebugOverlay.js` (79, 80), `StuckProbe.js` (40, 48) |
| **Invariant** | `routeTarget` must be set before `setState(npc, 'routing')`. `abandonAfter` cap is 60s. Cleared on arrival, timeout, or `routing_no_target` fallback. |

---

### `npc.mem('motor').tags`

| | |
|---|---|
| **Semantic** | Optional string array for motor-layer behaviour labels: `['resting']`, `['resting','homeless']`, `['jaywalking']`, `['crossing_road']`. Surfaced via `npc.getTags()`. |
| **Owner** | `Motor.js` (cleared in `_defaultOnExit`) and `WalkMode.js` (crossing tags) |
| **Writers** | `Motor.js#_defaultOnExit` (97 — clear to null); `Motor.js#setState` (176 — set `['resting'...]` on `lie_bench`); `WalkMode.js#planCrossing` (93 — `['jaywalking']`, 95 — `['crossing_road']`, 97 — null clear, 108 — null on complete) |
| **Readers** | `Motor.js#setState` (189 — dlog), aggregated by `npc.getTags()` |
| **Invariant** | Cleared to `null` on every state exit (`_defaultOnExit`). Only set during `setState` or `planCrossing`. |

---

### `npc.mem('motor').wallSpot`

| | |
|---|---|
| **Semantic** | `{building, side}` recording which wall slot the NPC occupies in `lean_wall` state. Cleared by `lean_wall`'s `onExit` hook which also releases the building slot. |
| **Owner** | `BaseStateMachine.js` (write) / `Motor.js#_defaultOnExit` for `lean_wall` (clear) |
| **Writers** | `BaseStateMachine.js#_resolveTimeout` (111 — set on lean_wall entry); `Motor.js#STATE_DEFS.lean_wall.onExit` (104-108 — clear and release) |
| **Readers** | `Motor.js#STATE_DEFS.lean_wall.onExit` (104) |
| **Invariant** | Must be `null` when NPC is not in `lean_wall` state. `lean_wall` `onExit` always clears it before releasing the slot. |

---

### `npc.mem('motor').progressAnchor` / `.progressAcc`

| | |
|---|---|
| **Semantic** | Anchor-based stuck monitor: `progressAnchor` is the NPC's position at the start of each 1.5s window; `progressAcc` accumulates `dt`. When the window fires, net displacement < 15px with an active goal triggers stuck recovery. |
| **Owner** | `Motor.js#integratePhysics` |
| **Writers** | `Motor.js#integratePhysics` (287 — lazy init anchor, 289 — accumulate, 290-293 — window fire + anchor reset) |
| **Readers** | `Motor.js#integratePhysics` (292 — compute moved, 296 — threshold test) |
| **Invariant** | `progressAcc` resets to 0 each window. `progressAnchor` updated to current position each window regardless of movement. |

### `npc.mem('motor').vel`

| | |
|---|---|
| **Semantic** | One-frame velocity vector `{vx, vy}` written by `steerRoam` so `integratePhysics` can apply diagonal movement directly, bypassing the `direction × speed` scalar path. Consumed (set to `null`) by `integratePhysics` on the same frame it is read. |
| **Owner** | `Motor.js#integratePhysics` (consumer) / `BaseStateMachine.js#steerRoam` (producer) |
| **Writers** | `BaseStateMachine.js#steerRoam` walk branch (sets `{vx,vy}` after `applyLookahead`); `Motor.js#integratePhysics` (clears to `null` after consuming) |
| **Readers** | `Motor.js#integratePhysics` (consumes when `mot.vel` is set — both `.vx` and `.vy` are used) |
| **Invariant** | Only written when `walkMode` is active. `null` between frames — `integratePhysics` always clears it. When absent, `integratePhysics` does not move the NPC (stationary frame). Non-`walkMode` paths (riders, inline physics) never set it. |

### `audit.count(npc, 'dir_mismatch')` (diagnostic counter)

Incremented in `BaseStateMachine.js#steerRoam` (walk/run/jog branch only) when
`Math.sign(vx) !== npc.direction` after `applyLookahead`. Records frames where
the steering vector opposes the NPC's current facing. Used for before/after
comparison during the speed-channel refactor; expected to approach zero once
direction and speed are driven from the same vector.

---

### NavGrid singleton (`getNavGrid()` / `setNavGrid()`)

| | |
|---|---|
| **Semantic** | Module-level `_instance` holding the single `NavGrid` cost map for the current scene. Cost encoding: 0=BLOCKED, 1=walkable, 8=grass, 250=ROAD (passable but not plannable). |
| **Owner** | `NavGrid.js` |
| **Writers** | `NavGrid.js` module (35-36 — `getNavGrid`/`setNavGrid` exports); `SceneInitializer.js` (96 — sole call to `setNavGrid`) |
| **Readers** | `Motor.js#_slideMove` (200), `WalkMode.js#pickModeTarget` (202, 230), `PathPlanner.js#getPlanner` (199), `Lookahead.js#applyLookahead` (32), `EnvironmentQuery.js` (126, 135), `Pedestrians.js#spawnOnePedestrian` (67), `StrollTask.js` (26), `StuckProbe.js` (15) |
| **Invariant** | Set exactly once at scene initialisation. `null` before init — all consumers must guard (`grid && ...`). Must not be replaced mid-scene. |

---

### `WALK_PATHS`

| | |
|---|---|
| **Semantic** | Module-level dict `{key → {waypoints, loop?, ...}}` of named walkable paths loaded from `assets/scene.json`. Used by `modePathFollow`. |
| **Owner** | `WalkMode.js` |
| **Writers** | `WalkMode.js#initWalkPaths` (125 — bulk init, called from `StreetScene.js:113`); `WalkMode.js#addWalkPath` (128 — incremental add) |
| **Readers** | `WalkMode.js#modePathFollow` (140 — lookup path def); `NavGrid.js#NavGrid` bake constructor (233 — paint path-tube cells cost=1) |
| **Invariant** | Initialised once before any NPC is registered. `NavGrid` reads `walkPaths` from the scene layout object at bake time independently — it does not read the exported `WALK_PATHS` object. |

---

## Open Issues

### (a) NPC position in BLOCKED cell after `standUp`

**Claim**: `sitDown` places the NPC at the bench's seat surface, which lies inside the bench's obstacle AABB (cost=0 in NavGrid). `standUp` clears the bench reference but does **not** reposition the NPC.

**Evidence**:
- `PropEntity.js` (38-41): `'bench'` is in `OBSTACLE_TYPES` → `this.obstacle = true` → `NavGrid#_bakeObstacles` sets all cells in the AABB to cost=0 (BLOCKED).
- `seat.js#sitDown` (66-74): calls `_setXY(npc, bench.x, seatSurfaceY(bench) - sitBodyY * sc)` — places NPC at seat surface inside bench footprint.
- `seat.js#standUp` (77-82): clears `bench._occupiedBy`, `npc.mem('social').bench`, and `npc._sortY`. No `_setXY` call — NPC remains at the seated x/y.
- `Motor.js#_slideMove` (205-208) escape rule: "already in a blocked cell → move freely to get out" — the designated recovery mechanism.

**Status**: Intentional. The escape rule in `Motor.js#_slideMove` is the documented recovery path. The coupling is implicit — no comment in `standUp` references it.

---

### (b) `Npc.js` inline physics path (lines 275-287) — who uses it?

**Code path** (`Npc.js#update`, 272-287):
```js
if (this._motorInstalled) {
  integratePhysics(this, delta);
} else if (!this.leashTarget) {
  // inline x/y integration — no NavGrid collision
  this.x += this.direction * this.speed * (delta / 1000);
  ...
}
```

**NPC types**:

| NPC type | Created by | `bm.register`? | `_motorInstalled` | `leashTarget` | Physics path |
|---|---|---|---|---|---|
| Pedestrians | `Pedestrians.js#spawnOnePedestrian` (84) | Yes | Yes | No | `integratePhysics` |
| Athletes / joggers | `Athletes.js` (15, 27) | Yes | Yes | No | `integratePhysics` |
| Dog owner | `DogWalker.js` (45) | Yes | Yes | No | `integratePhysics` |
| Dog | `DogWalker.js` (27, `leashTarget: owner`) | No | No | Yes | **skipped** (line 275) |
| Cyclists / e-bikes | `CyclistSpawner.js#_spawn` (93) | No | No | No | **inline path** |
| Stall sellers | `SceneInitializer.js` (172) | Yes | Yes | No | `integratePhysics` |
| Chess players | `Chess.js` (82, 83) | Yes | Yes | No | `integratePhysics` |

**Conclusion**: The inline path is **not dead code**. Used exclusively by cyclists/e-bikes from `CyclistSpawner.js#_spawn`. Comment at `CyclistSpawner.js:8`: "骑手是 NPC（makeNPC 创建，drawExtra 画车），不进 BehaviorManager". Cyclists pass through obstacle cells — no NavGrid collision. Intentional but undocumented as a consequence.

---

### (c) Overlap: `StuckProbe` vs `Motor.integratePhysics` progress monitor

| | `StuckProbe.js#stuckProbe` | `Motor.js#integratePhysics` progress monitor |
|---|---|---|
| **Period** | Every 2s (module-level `acc`) | Every 1.5s (`mot.progressAcc`) |
| **Threshold** | `moved < 8` px over 2s window | `moved < 15` px over 1.5s window |
| **Trigger condition** | `n.speed > 0 \|\| n.state === 'routing'` | `npc.speed > 0 \|\| npc.state === 'routing'` |
| **Action** | Observational: writes `window.__stuck`, logs to `tally`. **No side-effects on NPC state.** | Reactive: clears `navPath`; on `direct` sets `_stuckOnce` then forces `_elapsed = abandonAfter`; on `wander` nulls `roamTarget`; on `routing` sets `routeReplan` then forces `stateTimer = 9999` |
| **Scope** | All registered NPCs via `BehaviorManager` | Only NPCs with `_motorInstalled` |

These are complementary: StuckProbe is a **debug instrument**; the progress monitor is the **recovery actuator**. Not redundant.
