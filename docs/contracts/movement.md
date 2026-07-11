# Movement Subsystem Contract

Generated 2026-07-11. All file:line references verified by grep.

---

## Shared State Registry

### `npc.x` / `npc.y`

| | |
|---|---|
| **Semantic** | World-coordinate ground-contact point; `y` is the pixel line where the NPC's feet touch the ground. `screen_y = npc.y + joint[1] * scale` (joint y=0 = ground). |
| **Owner** | Motor.js — sole authorised writer via `_mw()` gate |
| **Writers** | `js/behavior/Motor.js:239` (`setXY`), `js/behavior/Motor.js:208,211,218,222,230,231` (`_slideMove`), `js/behavior/Motor.js:261,262` (`integratePhysics` leash path), `js/entity/seat/seat.js:36` (conditional fallback when `_motorInstalled` false — only cyclists/vehicles hit this path) |
| **Readers** | All rendering code, `StuckProbe.js`, `BehaviorManager.js` separation, `EnvironmentQuery.js:126`, `WalkMode.js`, `NavGrid.js`, `BaseStateMachine.js`, `seat.js` |
| **Invariant** | Must not be written outside Motor.js except via `setXY`/`nudgeXY` API. `npc.y` offsets must never be used to compensate for clip ground contact errors — fix the clip JSON instead. |

---

### `npc.speed`

| | |
|---|---|
| **Semantic** | Scalar speed magnitude in pixels/second; sign-free (direction carries sign). Zero means stationary. |
| **Owner** | Motor.js |
| **Writers** | `js/behavior/Motor.js:146` (`setState` via `_mw`), `js/behavior/Motor.js:249` (`setSpeed`) |
| **Readers** | `js/behavior/Motor.js:269,295`, `js/behavior/BaseStateMachine.js:298`, `js/behavior/StuckProbe.js:26` |
| **Invariant** | Only modified via `setState` or `setSpeed`; raw `npc.speed =` anywhere else is a violation. |

---

### `npc.state`

| | |
|---|---|
| **Semantic** | Current behaviour state string: `'walk'`, `'run'`, `'jog'`, `'stand'`, `'sit_bench'`, `'lie_bench'`, `'lean_wall'`, `'squat'`, `'sit_ground'`, `'lie_ground'`, `'get_up'`, `'fall'`, `'talk'`, `'loiter'`, `'routing'`, `'chess'`, `'chess_onlooker'`. |
| **Owner** | Motor.js |
| **Writers** | `js/behavior/Motor.js:146` (`setState` via `_mw`) — sole write path |
| **Readers** | `js/behavior/BaseStateMachine.js:160,164,167,174,298,350`, `js/behavior/BehaviorManager.js:143`, `js/entity/busstop/WaitForBusLayer.js:46,59,63`, `js/behavior/tasks/UseBenchTask.js:60`, `js/behavior/StuckProbe.js:26,27` |
| **Invariant** | All state transitions must go through `setState(npc, state, trigger)`. `npc.state =` anywhere except `Motor.js` and `Npc.js` constructor is a violation. |

---

### `npc.animation`

| | |
|---|---|
| **Semantic** | Current clip id string (from `manifest.json`). `StickRenderer` uses this as the lookup key — no alias layer. |
| **Owner** | Motor.js |
| **Writers** | `js/behavior/Motor.js:147` (`setState` via `_mw`), `js/behavior/Motor.js:254` (`setAnimation`) |
| **Readers** | `js/npc/Npc.js` (update loop), `js/behavior/StuckProbe.js:51`, rendering layer |
| **Invariant** | Must be a valid clip id from `manifest.json`. Only `setState` or `setAnimation` may write it. |

---

### `npc.direction`

| | |
|---|---|
| **Semantic** | Horizontal facing: `1` = right, `-1` = left. Used for physics `dx` and rendering mirror. |
| **Owner** | Unprotected — multiple owners by convention |
| **Writers** | `js/behavior/Motor.js:263,272,273,320`, `js/behavior/Motor.js:126` (loiter onExit), `js/behavior/BaseStateMachine.js:101,221,306,315`, `js/behavior/activities/StallActivity.js:61`, `js/behavior/activities/UsePropActivity.js:33`, `js/behavior/activities/ChessActivity.js:65`, `js/behavior/Director.js:157`, `js/npc/Pedestrians.js:107`, `js/npc/LoiterBehavior.js:42` |
| **Readers** | `js/behavior/Motor.js:270,275`, `js/npc/props/CigaretteProp.js:29,41`, `js/entity/seat/seat.js:101`, `js/behavior/BaseStateMachine.js:305` |
| **Invariant** | Value must always be exactly `1` or `-1`. No normalisation to floating point. |

---

### `npc.vy`

| | |
|---|---|
| **Semantic** | Vertical velocity in pixels/second (positive = downward in screen space). Used for crossing (`planCrossing`) and bounce in bounds-limited NPCs. |
| **Owner** | Shared: Motor.js (integration + reset on setState) and BaseStateMachine.js (crossing control) |
| **Writers** | `js/behavior/Motor.js:151,279,281` (`setState` reset; bounds bounce), `js/behavior/BaseStateMachine.js:176,230,301` (route arrival, crossing entry/exit control) |
| **Readers** | `js/behavior/Motor.js:277,283`, `js/behavior/WalkMode.js:177` |
| **Invariant** | Reset to 0 on every `setState`. Only `planCrossing` and Motor integration legitimately set non-zero values. |

---

### `npc.roamTarget`

| | |
|---|---|
| **Semantic** | Current short-range steer target `{x, y}` for `steerRoam`. `null` when no target; `steerRoam` calls `pickModeTarget` when null (unless `pausing=true`). |
| **Owner** | WalkMode.js (target lifecycle) and Motor.js (reset on mode change) |
| **Writers** | `js/behavior/WalkMode.js:206,223,231,233,234,242,245,273,275,322`, `js/behavior/Motor.js:62,70,77,86,158,304,309` |
| **Readers** | `js/behavior/BaseStateMachine.js:234,235,237`, `js/behavior/StuckProbe.js:46` |
| **Invariant** | Nulled on every `setWalkMode`/`pushWalkMode`/`popWalkMode`. Never a stale non-null value from a previous walk mode — mode switch always nulls it first. |

---

### `npc.mem('motor').walkMode`

| | |
|---|---|
| **Semantic** | Current walk mode descriptor object: `{kind:'wander',...}`, `{kind:'direct',...}`, `{kind:'path_follow',...}`, or `null` for raw physics only. |
| **Owner** | Motor.js (API: `setWalkMode`/`pushWalkMode`/`popWalkMode`) |
| **Writers** | `js/behavior/Motor.js:60` (`setWalkMode`), `js/behavior/Motor.js:69` (`pushWalkMode`), `js/behavior/Motor.js:76,85` (`popWalkMode` / `_defaultOnExit`), `js/behavior/BaseStateMachine.js` (indirectly via `setWalkMode` calls at `BaseStateMachine.js:177`, `BaseStateMachine.js:319`) |
| **Readers** | `js/behavior/WalkMode.js:168,169,193,228,315`, `js/behavior/BehaviorManager.js:160`, `js/behavior/BaseStateMachine.js:164`, `js/behavior/Motor.js:157,266,272,299,308,324` |
| **Invariant** | Never written directly — always via `setWalkMode`/`pushWalkMode`/`popWalkMode`. Switching walk mode always nulls `npc.roamTarget`. |

---

### `npc.mem('motor').walkModeStack`

| | |
|---|---|
| **Semantic** | LIFO stack of suspended walk mode descriptors. Push saves current mode before priority interrupt; pop restores it. |
| **Owner** | Motor.js |
| **Writers** | `js/behavior/Motor.js:61,67,68,74,75,76,84,85` |
| **Readers** | `js/behavior/Motor.js:74,84`, `js/behavior/WalkMode.js:340` |
| **Invariant** | Only modified via `pushWalkMode`/`popWalkMode`. Crossing (`planCrossing`) pushes before starting; `popWalkMode` (or `_defaultOnExit` on walk/run) restores. |

---

### `npc.mem('motor').navPath` / `.navIdx` / `.navGoalX` / `.navGoalY`

| | |
|---|---|
| **Semantic** | Sub-path from `PathPlanner.plan()` for `steerRoam` to follow inside `roamTarget` approach. `navPath` is `[{x,y}]`; `navIdx` is current waypoint index; `navGoalX/Y` is the goal that produced `navPath` (cache-invalidation key). |
| **Owner** | BaseStateMachine.js (`steerRoam` function) |
| **Writers** | `js/behavior/BaseStateMachine.js:241,242,243,244,252,253,268,275`, `js/behavior/Motor.js:298,303` (cleared by progress monitor) |
| **Readers** | `js/behavior/BaseStateMachine.js:240,259,260,267,268` |
| **Invariant** | Nulled on goal change (`navGoalX/Y` mismatch). Progress monitor clears `navPath` when stuck; `steerRoam` replans next frame. |

---

### `npc.mem('motor').routeTarget` / `.routePts` / `.routeIdx`

| | |
|---|---|
| **Semantic** | High-level routing destination `{x, y, exitType?}` set by callers to enter `routing` state. `routePts` is the computed waypoint sequence; `routeIdx` is current index within it. |
| **Owner** | BaseStateMachine.js (tick) — set by callers before entering routing |
| **Writers** | `js/behavior/BaseStateMachine.js:183,212` (clear on arrival/timeout), `js/behavior/BaseStateMachine.js:319` (set destination — `triggerDeparture`), `js/entity/busstop/WaitForBusLayer.js:127` (set destination — bus boarding), `js/behavior/Motor.js:312,313` (clear on progress-monitor stuck) |
| **Readers** | `js/behavior/BaseStateMachine.js:177,178`, `js/ui/DebugOverlay.js:79,80`, `js/behavior/StuckProbe.js:40,48` |
| **Invariant** | `routeTarget` must be set before `setState(npc, 'routing')`. Cleared (set null) on arrival, timeout, or `routing_no_target` fallback. `abandonAfter` cap is 60s. |

---

### `npc.mem('motor').tags`

| | |
|---|---|
| **Semantic** | Optional string array for motor-layer behaviour labels, e.g. `['resting']`, `['resting','homeless']`, `['jaywalking']`, `['crossing_road']`. Surfaced via `npc.getTags()`. |
| **Owner** | Motor.js (setState clears via `_defaultOnExit`) and WalkMode.js (crossing tags) |
| **Writers** | `js/behavior/Motor.js:82` (cleared in `_defaultOnExit`), `js/behavior/Motor.js:161` (set on `lie_bench`), `js/behavior/WalkMode.js:80,84,95,97` (jaywalk / crossing) |
| **Readers** | `js/behavior/Motor.js:174` (dlog), aggregated by `npc.getTags()` |
| **Invariant** | Cleared to `null` on every state exit. Only set during `setState` or `planCrossing`. |

---

### `npc.mem('motor').wallSpot`

| | |
|---|---|
| **Semantic** | `{building, side}` recording which wall slot the NPC occupies in `lean_wall` state. Cleared by `lean_wall`'s `onExit` hook which also releases the slot on the building. |
| **Owner** | BaseStateMachine.js (write) / Motor.js (clear in onExit) |
| **Writers** | `js/behavior/BaseStateMachine.js:94`, `js/behavior/Motor.js:104,108` (onExit cleanup) |
| **Readers** | `js/behavior/Motor.js:104` (onExit cleanup) |
| **Invariant** | Must be `null` when NPC is not in `lean_wall` state. `lean_wall` onExit always clears it before releasing the slot. |

---

### `npc.mem('motor').progressAnchor` / `.progressAcc`

| | |
|---|---|
| **Semantic** | Anchor-based progress monitor: `progressAnchor` is the NPC's position at the start of the current 1.5s window; `progressAcc` accumulates `dt`. When the window fires, net displacement from anchor < 15px with an active goal triggers stuck recovery. |
| **Owner** | Motor.js (`integratePhysics`) |
| **Writers** | `js/behavior/Motor.js:287,289,290,291,293` |
| **Readers** | `js/behavior/Motor.js:292,296` |
| **Invariant** | `progressAcc` resets to 0 each window. `progressAnchor` is updated to current position each window regardless of movement. |

---

### NavGrid singleton (`getNavGrid()` / `setNavGrid()`)

| | |
|---|---|
| **Semantic** | Module-level `_instance` holding the single `NavGrid` cost map for the current scene. Cost encoding: 0=BLOCKED, 1=walkable, 8=grass, 250=ROAD (passable but not plannable). |
| **Owner** | `js/behavior/nav/NavGrid.js` |
| **Writers** | `js/behavior/nav/NavGrid.js:36` (`setNavGrid`), called once from `js/scenes/SceneInitializer.js:96` |
| **Readers** | `js/behavior/Motor.js:200`, `js/behavior/WalkMode.js:202,230`, `js/behavior/nav/PathPlanner.js:199`, `js/behavior/nav/Lookahead.js:32`, `js/behavior/EnvironmentQuery.js:126,135`, `js/npc/Pedestrians.js:67`, `js/behavior/tasks/StrollTask.js:26`, `js/behavior/StuckProbe.js:15` |
| **Invariant** | Set exactly once at scene initialisation. `null` before init — all consumers must guard (`grid &&` or `getNavGrid()`). Must not be replaced mid-scene. |

---

### `WALK_PATHS`

| | |
|---|---|
| **Semantic** | Module-level dict `{key → {waypoints, loop?, ...}}` of named walkable paths loaded from `assets/scene.json`. Used by `modePathFollow`. |
| **Owner** | WalkMode.js |
| **Writers** | `js/behavior/WalkMode.js:112` (`initWalkPaths` — called once from `js/scenes/StreetScene.js:113`), `js/behavior/WalkMode.js:115` (`addWalkPath`) |
| **Readers** | `js/behavior/WalkMode.js:140`, `js/behavior/nav/NavGrid.js:233` (bake: pipe cost=1 within PATH_TUBE_R) |
| **Invariant** | Initialised once before any NPC is registered. `NavGrid.bake()` reads `walkPaths` from the scene layout object independently — it does not read the `WALK_PATHS` export. |

---

## Open Issues

### (a) NPC position in BLOCKED cell after `standUp`

**Claim**: `sitDown` places the NPC at the bench's seat surface, which is inside the bench's obstacle AABB (cost=0 in NavGrid). `standUp` clears `npc.mem('social').bench` and resets `_sortY` but does **not** reposition the NPC.

**Evidence**:

- `js/core/PropEntity.js:38-41`: `bench` is in `OBSTACLE_TYPES` → `this.obstacle = true` → NavGrid `_bakeObstacles` sets all cells in the AABB to cost=0 (BLOCKED).
- `js/entity/seat/seat.js:66-74` (`sitDown`): calls `_setXY(npc, bench.x, seatSurfaceY(bench) - sitBodyY * sc)` — places NPC at the seat surface, which is within the bench footprint.
- `js/entity/seat/seat.js:77-82` (`standUp`): clears `bench._occupiedBy`, `npc.mem('social').bench`, and `npc._sortY`. No `_setXY` call — NPC remains at the seated x/y.
- `js/behavior/Motor.js:205-208` (`_slideMove` escape rule): "already in a blocked cell → move freely to get out" — this is the intentional recovery mechanism. After `standUp`, the first movement frame uses the escape rule and the NPC walks out of the BLOCKED cell.

**Status**: Behaviour is intentional and documented. The escape rule in Motor.js is the designated recovery mechanism. Not a bug, but the coupling is implicit — no comment ties `standUp`'s non-repositioning to the escape rule.

---

### (b) `Npc.js` inline physics path (lines 275-287) — who uses it?

**Code path** (`js/npc/Npc.js:272-287`):
```js
if (this._motorInstalled) {
  integratePhysics(this, delta);
} else if (!this.leashTarget) {
  // inline x/y integration, no NavGrid collision
  this.x += this.direction * this.speed * (delta / 1000);
  ...
}
```

**NPC types and their path**:

| NPC type | Created by | `bm.register` called? | `_motorInstalled` | `leashTarget` | Physics path |
|---|---|---|---|---|---|
| Pedestrians | `js/npc/Pedestrians.js:84` | Yes | Yes | No | `integratePhysics` |
| Athletes / joggers | `js/npc/Athletes.js:15,27` | Yes | Yes | No | `integratePhysics` |
| Dog owner | `js/npc/DogWalker.js:45` | Yes | Yes | No | `integratePhysics` |
| Dog | `js/npc/DogWalker.js:25-27` | **No** | No | Yes (`leashTarget: owner`) | **skipped** (line 275 condition) |
| Cyclists / e-bikes | `js/entity/vehicle/CyclistSpawner.js:93` | **No** | No | No | **inline path (lines 279-286)** |
| Stall sellers | `js/scenes/SceneInitializer.js:172` | Yes | Yes | No | `integratePhysics` |
| Chess players | `js/npc/Chess.js:82,83` | Yes | Yes | No | `integratePhysics` |

**Conclusion**: The inline path is **not dead code**. It is used exclusively by cyclists/e-bikes spawned from `CyclistSpawner.js`. Cyclists bypass `BehaviorManager` by design (comment at `js/entity/vehicle/CyclistSpawner.js:8`: "骑手是 NPC（makeNPC 创建，drawExtra 画车），不进 BehaviorManager"). The inline path has no NavGrid collision — cyclists pass through obstacle cells. This is intentional but undocumented in the code as a known consequence.

---

### (c) Overlap: `StuckProbe` vs `Motor.integratePhysics` progress monitor

Both detect insufficient movement during active locomotion, but serve different purposes:

| | `StuckProbe.js` | `Motor.integratePhysics` progress monitor |
|---|---|---|
| **Location** | `js/behavior/StuckProbe.js:9-57` | `js/behavior/Motor.js:287-327` |
| **Period** | Every 2s (module-level accumulator `acc`) | Every 1.5s (`mot.progressAcc`) |
| **Threshold** | `moved < 8` px over 2s window | `moved < 15` px over 1.5s window |
| **Trigger condition** | `n.speed > 0 \|\| n.state === 'routing'` | `npc.speed > 0 \|\| npc.state === 'routing'` |
| **Action** | Observational only: writes to `window.__stuck`, logs to `tally`; **no side-effects** on NPC state | Reactive: clears `navPath`; on `direct` mode sets `_stuckOnce` then forces `_elapsed = abandonAfter`; on `wander` nulls `roamTarget`; on `routing` sets `routeReplan` then forces `stateTimer = 9999` |
| **Scope** | All registered NPCs via `BehaviorManager` | Only NPCs with `_motorInstalled` (all BM-managed NPCs) |
| **Resets on progress** | — | Clears `routeReplan`, clears `_stuckOnce` |

These are complementary roles. The overlap in measurement criteria is intentional: StuckProbe is a debug instrument; the progress monitor is the recovery actuator. They are not redundant.
