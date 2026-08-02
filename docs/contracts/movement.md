# Movement Subsystem Contract

verified at d7cd5c1ff33dc0601b9d1510c21086283374a0c0 — full re-verification after
N-2b / N-3 / V-2 / V3-a. Four field sections describing deleted state
(`npc.vy`, `walkModeStack`, `navPath/navIdx/navGoalX/navGoalY`,
`routeTarget/routePts/routeIdx`) were removed; `mot.goal` / `mot.path` /
`mot.needReplan` were added; all `file#symbol` anchors re-grepped.

All writers listed as `file#symbol`. **Line numbers are deliberately omitted** —
they rot faster than symbol names and were wrong across the board at the previous
revision. The symbol name is the anchor; grep for it.

⚠️ **Grep caveat**: `Motor.js` writes protected fields through the `_mw(npc, field, value)`
gate, not by direct assignment. `grep '\.speed ='` / `'\.x ='` will therefore
*miss* the Motor write path entirely and make a field look unwritten. Always
check `_mw(npc, '<field>'` as well before concluding a field is dead.

---

## Shared State Registry

### `npc.x` / `npc.y`

| | |
|---|---|
| **Semantic** | World-coordinate ground-contact point; `y` is the pixel line where the NPC's feet touch the ground. Rendering formula: `screen_y = npc.y + joint[1] * scale` (joint y=0 = ground). |
| **Owner** | `Motor.js#_mw` — sole authorised writer gate |
| **Writers** | `Motor.js#setXY`, `Motor.js#_slideMove` (all move branches), `Motor.js#integratePhysics` (leash path); `seat.js#_setXY` — conditional fallback only when `_motorInstalled` is false |
| **Readers** | All rendering code, `StuckProbe.js`, `BehaviorManager.js#_separate`, `EnvironmentQuery.js`, `WalkMode.js`, `NavGrid.js`, `BaseStateMachine.js#steerRoam`, `seat.js` |
| **Invariant** | Must not be written outside Motor.js API (`setXY`/`nudgeXY`) — enforced by `check-invariants.mjs` Rule 9. `npc.y` offsets must never compensate for clip ground-contact errors — fix the clip JSON instead. |

---

### `npc.speed`

| | |
|---|---|
| **Semantic** | Scalar speed magnitude in px/s for the *current state*, recomputed on every state entry as `STATE_DEFS[state].speedK × (npc.walkSpeed \|\| 26)` — so it is 0 in every stationary state and non-zero only in `walk`/`run`/`jog`/`ride`. It is **not** the general physics channel (that is `mot.vel`, since V-1), but it is not vestigial either: the `ride` branch still derives velocity from it directly. At construction it carries a different meaning — the spawn-time pace seed that `BehaviorManager#register` converts into `npc.walkSpeed`. |
| **Owner** | `Motor.js` (per-state value) / `Npc.js` constructor (spawn seed) |
| **Writers** | `Motor.js#setState` — via the `_mw` write gate, **not** a direct assignment, so a `grep '\.speed ='` will not find it; `Npc.js` constructor (`this.speed = config.speed \|\| 0`). The old `setSpeed` API was deleted in V3-a and has no replacement. |
| **Readers** | `BehaviorManager.js#register` (seeds `walkSpeed`, once); `BaseStateMachine.js#_tickState` `ride` branch (`mot.vel = {vx: direction * speed, vy: 0}` — N3-c, the one live physics read); `StuckProbe.js` (diagnostic, not a gate) |
| **Invariant** | Only `setState` (via `_mw`) or the `Npc.js` constructor may write it — enforced by `check-invariants.mjs` Rule 3. Do not reintroduce it as the general physics channel; non-`ride` movement goes through `mot.vel`. |

---

### `npc.state`

| | |
|---|---|
| **Semantic** | Current behaviour state string: `walk`, `run`, `jog`, `stand`, `sit_bench`, `lie_bench`, `lean_wall`, `squat`, `sit_ground`, `lie_ground`, `get_up`, `fall`, `talk`, `loiter`, `ride`, `chess`, `chess_onlooker`. Full definitions in `Motor.js#STATE_DEFS`. |
| **Owner** | `Motor.js` |
| **Writers** | `Motor.js#setState` (via `_mw`) — sole write path |
| **Readers** | `BaseStateMachine.js#_tickState`, `BaseStateMachine.js#steerRoam`, `BaseStateMachine.js#tickBaseState`, `BehaviorManager.js#update`, `WaitForBusLayer.js`, `UseBenchTask.js`, `StuckProbe.js` |
| **Invariant** | All state transitions go through `setState(npc, state, trigger)`. `npc.state =` anywhere except `Motor.js` and the `Npc.js` constructor is a violation — enforced by Rule 3. |

---

### `npc.animation`

| | |
|---|---|
| **Semantic** | Current clip id string (from `manifest.json`). `StickRenderer` uses this as the lookup key — no alias layer. Default is `'stand'` (not `'idle'`). |
| **Owner** | `Motor.js` |
| **Writers** | `Motor.js#setState` (via `_mw`), `Motor.js#setAnimation` |
| **Readers** | `Npc.js#update` (animation loop), `StuckProbe.js`, rendering layer |
| **Invariant** | Must be a valid clip id from `manifest.json`. Only `setState` or `setAnimation` may write it — enforced by Rule 3. |

---

### `npc.direction`

| | |
|---|---|
| **Semantic** | Horizontal facing: `1` = right, `-1` = left. Used for physics `dx` and rendering mirror. |
| **Owner** | Unprotected — multiple owners by convention |
| **Writers** | `Npc.js` constructor (init), `Npc.js#update` (leash sync); `Motor.js#_defaultOnExit` (loiter dir restore), `Motor.js#integratePhysics` (leash sync, bounds bounce, reversal); `Pedestrians.js#spawnOnePedestrian` (spawn facing); `LoiterBehavior.js#tickLoiter` (micro-phase dir restore); `TalkActivity.js#_faceEachOther` (mutual face); `StallActivity.js#addBuyer` (seller + buyer face); `UsePropActivity.js` constructor (face prop); `ChessActivity.js#addOnlooker` (face table); `Director.js#_spawnNPC` (spawn facing); `BaseStateMachine.js#_resolveTimeout` (lean_wall spot facing), `BaseStateMachine.js#updateFacing` (sole steering-driven writer, with `mot.dirCD` hysteresis), `BaseStateMachine.js#_routeToExit` (exit facing) |
| **Readers** | `CigaretteProp.js`, `seat.js#alignLie`, `StickRenderer#draw` (mirror), `Npc.js#getAnchor` |
| **Invariant** | Value must always be exactly `1` or `-1`. No floating-point normalisation. Writes inside the physics path are restricted to a whitelist — enforced by `check-invariants.mjs` Rule 10. |

---

### `npc.roamTarget`

| | |
|---|---|
| **Semantic** | Current short-range steer target `{x, y}` for `steerRoam`. `null` when no target; `steerRoam` calls `pickModeTarget` when null (unless `pausing=true` in path_follow mode). |
| **Owner** | `WalkMode.js` (target lifecycle) and `Motor.js` (reset on mode change) |
| **Writers** | `WalkMode.js#pickModeTarget` (path_follow waypoint / wander random), `WalkMode.js#_pickRandom` (null on fail), `WalkMode.js#onPathArrival` (null), `WalkMode.js#tickWalkMode` (null on pause release); `Motor.js#setWalkMode`, `Motor.js#_defaultOnExit`, `Motor.js#setState`, `Motor.js#integratePhysics` (progress monitor, wander branch) |
| **Readers** | `BaseStateMachine.js#steerRoam`, `StuckProbe.js` |
| **Invariant** | Nulled on every `setWalkMode`. Never left as stale non-null from a previous walk mode. |

---

### `npc.mem('motor').walkMode`

| | |
|---|---|
| **Semantic** | Current walk mode descriptor: `{kind:'wander',...}`, `{kind:'path_follow',...}`, or `null` for raw physics only. The `direct` kind was deleted in N-2b — goal-directed movement now goes through `mot.goal` + `mot.path`. |
| **Owner** | `Motor.js` (API: `setWalkMode` — replace only; the push/pop stack was deleted in N-2b) |
| **Writers** | `Motor.js#setWalkMode`, `Motor.js#_defaultOnExit`, `Motor.js#setState` |
| **Readers** | `WalkMode.js#checkZoneTransition`, `WalkMode.js#pickModeTarget`, `WalkMode.js#_pickRandom`, `WalkMode.js#tickWalkMode`; `BehaviorManager.js#_sepScale`; `BaseStateMachine.js#_tickState`; `Motor.js#setState`, `Motor.js#integratePhysics` |
| **Invariant** | Never written directly — always via `setWalkMode`. Switching walk mode always nulls `npc.roamTarget`. There is no mode stack: an interrupted mode is not restored, the next mode is chosen fresh. |

---

### `npc.mem('motor').goal`

| | |
|---|---|
| **Semantic** | Active high-level destination `{x, y, radius, meta, onDone, _stuck}` published by the Planning layer. `meta.jaywalk` flips the ROAD cost override in `PlanService._zoneCostsFor`. `_stuck` is the progress monitor's two-strike latch. Replaces the deleted `routeTarget` channel. |
| **Owner** | `nav/PlanService.js` — `publishGoal` is the sole constructor of a non-null goal |
| **Writers** | `PlanService.js#publishGoal` (set); cleared to null by `PlanService.js#_fireBlocked`, `Motor.js#integratePhysics` (arrival fire + progress two-strike `'blocked'`), `BaseStateMachine.js#steerRoam` (arrival), `GotoTask.js`, `StrollTask.js` |
| **Readers** | `Motor.js#integratePhysics`, `BaseStateMachine.js#steerRoam`, `PlanService.js#ensurePath`, `Npc.js#getTags` (`meta.jaywalk`), `StuckProbe.js` |
| **Invariant** | Only `publishGoal` may create one — no module constructs a goal object inline. `onDone` fires exactly once, with `'arrived'` or `'blocked'`, and the goal is nulled in the same step. |

---

### `npc.mem('motor').path`

| | |
|---|---|
| **Semantic** | Computed waypoint sequence `{pts, idx, goalX?, goalY?}` for the steering layer to follow. `idx` is the current waypoint cursor; `goalX/goalY` (wander paths only) act as a cache-invalidation key. Replaces the deleted `navPath`/`navIdx`/`navGoalX`/`navGoalY` quartet. |
| **Owner** | `nav/PlanService.js` — sole producer of a **non-null** path (`ensurePath` / `ensureWanderPath`) |
| **Writers** | `PlanService.js#ensurePath`, `PlanService.js#ensureWanderPath` (construct); cleared to null by `PlanService.js#publishGoal`, `PlanService.js#_fireBlocked`, `Motor.js#integratePhysics` (arrival, progress monitor), `BaseStateMachine.js#steerRoam`, `GotoTask.js`, `StrollTask.js` |
| **Readers** | `BaseStateMachine.js#steerRoam` (waypoint advance), `Lookahead.js#applyLookahead`, `DebugOverlay.js` |
| **Invariant** | No module outside `PlanService` may build a path — clearing to `null` is unrestricted, constructing is not. A non-null `path` always corresponds to either an active `goal` or an active wander `roamTarget`. |

---

### `npc.mem('motor').needReplan`

| | |
|---|---|
| **Semantic** | One-shot flag forcing `ensurePath` to discard the cached path and replan. Set by the progress monitor's first stuck strike. |
| **Owner** | `Motor.js#integratePhysics` (producer) / `nav/PlanService.js#ensurePath` (consumer) |
| **Writers** | `Motor.js#integratePhysics` (set `true` on first strike, `undefined` on clear); `PlanService.js#publishGoal`/`ensurePath` (`undefined` after honouring); `BaseStateMachine.js#steerRoam` (`undefined` on arrival) |
| **Readers** | `PlanService.js#ensurePath` (`if (mot.path && !mot.needReplan) return`) |
| **Invariant** | Cleared (`undefined`) as soon as it has been honoured — never left latched across frames. |

---

### `npc.mem('motor').tags`

| | |
|---|---|
| **Semantic** | Optional string array for motor-layer behaviour labels. Current vocabulary is only `['resting']` / `['resting','homeless']`, set on `lie_bench`. Surfaced via `npc.getTags()`. The `crossing` / `jaywalking` tags are **not** here — since N-2b they are derived spatially in `Npc.js#getTags` from the NavGrid zone under the NPC, not stored. |
| **Owner** | `Motor.js` |
| **Writers** | `Motor.js#_defaultOnExit` (clear to null); `Motor.js#setState` (set on `lie_bench`) |
| **Readers** | `Motor.js#setState` (dlog), aggregated by `npc.getTags()` |
| **Invariant** | Cleared to `null` on every state exit (`_defaultOnExit`). Only `setState` sets it. |

---

### `npc.mem('motor').wallSpot`

| | |
|---|---|
| **Semantic** | `{building, side}` recording which wall slot the NPC occupies in `lean_wall` state. Cleared by `lean_wall`'s `onExit` hook which also releases the building slot. |
| **Owner** | `BaseStateMachine.js` (write) / `Motor.js#_defaultOnExit` for `lean_wall` (clear) |
| **Writers** | `BaseStateMachine.js#_resolveTimeout` (set on lean_wall entry); `Motor.js#STATE_DEFS.lean_wall.onExit` (clear and release) |
| **Readers** | `Motor.js#STATE_DEFS.lean_wall.onExit` |
| **Invariant** | Must be `null` when NPC is not in `lean_wall` state. `lean_wall` `onExit` always clears it before releasing the slot. |

---

### `npc.mem('motor').progressAnchor` / `.progressAcc`

| | |
|---|---|
| **Semantic** | Anchor-based stuck monitor: `progressAnchor` is the NPC's position at the start of each window; `progressAcc` accumulates `dt`. Window length and displacement threshold live in `Motor.js#RECOVERY_RULES.progress_monitor` (`window` / `movedLT`) — not hardcoded at the call site. |
| **Owner** | `Motor.js#integratePhysics` |
| **Writers** | `Motor.js#integratePhysics` (lazy init anchor, accumulate, window fire + anchor reset) |
| **Readers** | `Motor.js#integratePhysics` (compute moved, threshold test) |
| **Invariant** | `progressAcc` resets to 0 each window. `progressAnchor` updated to current position each window regardless of movement. |

---

### `npc.mem('motor').vel`

| | |
|---|---|
| **Semantic** | One-frame velocity vector `{vx, vy}` written by `steerRoam` so `integratePhysics` can apply diagonal movement directly. Consumed (set to `null`) by `integratePhysics` on the same frame it is read. Since V-1 this is the **only** physics channel — there is no scalar fallback. |
| **Owner** | `Motor.js#integratePhysics` (consumer) / `BaseStateMachine.js#steerRoam` (producer) |
| **Writers** | `BaseStateMachine.js#steerRoam` walk branch (sets `{vx,vy}` after `applyLookahead`); `WalkMode.js#checkZoneTransition` (overwrite to bounce out of road/bike-lane); `Motor.js#integratePhysics` (clears to `null` after consuming) |
| **Readers** | `Motor.js#integratePhysics` (both `.vx` and `.vy` are used); `WalkMode.js#checkZoneTransition` (reads `vy` sign to pick bounce direction) |
| **Invariant** | `null` between frames — `integratePhysics` always clears it. When absent, `integratePhysics` does not move the NPC (stationary frame). |

---

### `audit.count(npc, 'dir_mismatch')` (diagnostic counter)

Incremented in `BaseStateMachine.js#steerRoam` (walk/run/jog branch only) when
`vx !== 0 && Math.sign(vx) !== npc.direction` after `applyLookahead`. Records
frames where the steering vector opposes the NPC's current facing. The
`npc.speed > 0` prefix guard was removed in V-2 (speed is no longer a physics
channel; the guard silenced all `dir_mismatch` counts).

---

### NavGrid singleton (`getNavGrid()` / `setNavGrid()`)

| | |
|---|---|
| **Semantic** | Module-level `_instance` holding the single `NavGrid` **zone map** for the current scene (Z-1 zone-profile split). The grid stores semantic zone IDs only — no cost numbers. `ZONE = { BLOCKED:0, SIDEWALK:1, GRASS:2, ROAD:3, CROSSWALK:4 }`. `ZONE.ROAD` = passable (`_slideMove` does not reject it), plannable at whatever cost the caller's table assigns, never sampled and never a destination. `ZONE.CROSSWALK` = low-cost crossing tube inside the road bands; sampable and usable as destination. |
| **Owner** | `NavGrid.js` |
| **Writers** | `NavGrid.js` module (`getNavGrid`/`setNavGrid` exports); `SceneInitializer.js` — sole call to `setNavGrid` |
| **Readers** | `Motor.js#_navBlocked`, `WalkMode.js#pickModeTarget`, `PathPlanner.js#getPlanner`, `Lookahead.js#applyLookahead`, `EnvironmentQuery.js`, `Npc.js#getTags`, `BaseStateMachine.js#steerRoam`, `Pedestrians.js#spawnOnePedestrian`, `StrollTask.js`, `StuckProbe.js` |
| **Invariant** | Set exactly once at scene initialisation. `null` before init — all consumers must guard (`grid && ...`). Must not be replaced mid-scene. `grid.zone(gx,gy)` is the only cell accessor; there is no `grid.cost()`. NavGrid must hold neither cost numbers (Z-1) nor Y-band numbers (Z-2b) — bake geometry arrives entirely via the `zones` config. |

**Known debt**: `NavGrid.js` derives `COLS`/`ROWS` from `WORLD_WIDTH`/`WORLD_HEIGHT`
at *module top level*, which evaluates before `initLayout()` injects the scene's
real dimensions. Today this is invisible because `scene.json#world` happens to
match the Layout fallbacks exactly; a scene with different dimensions would leave
the grid sized to the fallback and silently clamp all out-of-range cells. See
`docs/roadmap.md#Z-2a`.

---

### Zone bake config (`scene.json#zones` → `NavGrid.bake`)

| | |
|---|---|
| **Semantic** | Declarative description of how the zone map is painted, in four ordered stages: `bands[]` (Y-band defaults; first `wy < to` wins, last band is the catch-all), `overlays[]` (extra bands rewriting non-BLOCKED cells), `paving` (walkPaths tubes + plaza ellipses → paved zone), `crossings` (crosswalk tubes, only over the zone named by `over`). Y boundaries are written as **band names** (`"to": "FAR_Y"`) and resolved through `Layout.resolveY`, so numbers still live only in `yBands`. Zone names resolve through `NavGrid._zoneId`. |
| **Owner** | `assets/scene.json` (data); `NavGrid._bakeZones` (interpreter) |
| **Writers** | Nobody at runtime — read once at bake. Passed as `bake()`'s 3rd argument by `SceneInitializer.js` (`sceneData.zones`) and `headless-sim.mjs`. |
| **Readers** | `NavGrid._bakeZones` only. |
| **Invariant** | No silent fallback: a missing `zones`, `zones.bands`, or any required sub-field throws at bake; an unknown zone name or Y-band name throws. Obstacle cells are *not* config-driven — they come from `entity.footprint`. `overlays` row ranges use `floor(y/CELL)` inclusive endpoints rather than a cell-centre test (legacy arithmetic, preserved deliberately for bit-equivalence). |

---

### Zone cost table (`DEFAULT_ZONE_COSTS` / `profile.zoneCosts`)

| | |
|---|---|
| **Semantic** | The zone→effective-planning-cost map. Table value `0` means *impassable* (A* skips the cell). Defaults: `BLOCKED 0, SIDEWALK 1, GRASS 8, ROAD 250, CROSSWALK 2`. This is the single address of planning cost policy — it replaces the deleted `PLANNING_RULES` object and the `roadCost` / `planningRules` parameter chain. |
| **Owner** | `NavGrid.js` (`DEFAULT_ZONE_COSTS` export) |
| **Writers** | Nobody mutates the exported table. `PlanService._zoneCostsFor()` is the sole assembler: `{...DEFAULT_ZONE_COSTS, ...profile.zoneCosts}`, then `ROAD → JAYWALK_ROAD_COST (3)` when `goal.meta.jaywalk`. |
| **Readers** | `PathPlanner.plan()` / `_astar()` — 6th parameter `zoneCosts`; cost of a cell is `zoneCosts[grid.zone(gx,gy)] ?? 0`. |
| **Invariant** | NavGrid must not hold cost numbers, and PathPlanner must not own cost policy — the table always arrives as a parameter. jaywalk override applies *after* the profile override, so a profile cannot out-rank a jaywalk goal. Enforced by `check-invariants.mjs` Rule 8. |

---

### Obstacle footprint (`e.footprint`)

| | |
|---|---|
| **Semantic** | Per-entity ground footprint `{shape, rx, ry, blocks, sortDY}` computed once in `PropEntity` constructor via `_computeFootprint()`. `shape: 'rect'` → AABB test; `shape: 'ellipse'` → ellipse test (fountain). `rx/ry` are world-pixel half-axes at the entity's `depthScale(y)`. `blocks: true` for all `OBSTACLE_TYPES`; `false` for decorative props (sign). `sortDY` offsets the Y-sort anchor (`_sortY = y + sortDY`; 0 = use entity.y). |
| **Owner** | Each entity module (`js/entity/<type>/<type>.js`) exports `footprint(e)`, registered through `registerProp`. |
| **Writers** | `PropEntity` constructor (one-time, stored as `this.footprint`). Never mutated after construction. |
| **Readers** | `NavGrid._markObstacle` (obstacle baking); `PropEntity` constructor (sortDY → `_sortY`); `check-invariants.mjs` Rule 5 (static gate) |
| **Invariant** | Every prop registered with `obstacle: true` must supply a `footprint` — missing one throws at registration. `rx/ry` values must not be adjusted without also updating the corresponding `draw*.js` geometry comment. |

---

### `NPC_HALF_W` (NavGrid Minkowski expansion)

`NavGrid.js`: `const NPC_HALF_W = 7` — pixels added to every obstacle's
`footprint.rx/ry` before grid cell marking. Represents the NPC's collision
half-width: a cell is BLOCKED if the NPC's centre would be within
`rx + NPC_HALF_W` of the obstacle centre (AABB), or within the scaled ellipse
boundary (fountain). Value 7 was chosen to match the effective NPC ground-contact
half-width at mid-scene depth. Rename or change only with a full NavGrid rebake
and gameplay visual check.

---

### `WALK_PATHS`

| | |
|---|---|
| **Semantic** | Module-level dict `{key → {waypoints, loop?, ...}}` of named walkable paths loaded from `assets/scene.json`. Used by `modePathFollow`. |
| **Owner** | `WalkMode.js` |
| **Writers** | `WalkMode.js#initWalkPaths` (bulk init, called from `StreetScene.js`); `WalkMode.js#addWalkPath` (incremental add) |
| **Readers** | `WalkMode.js#modePathFollow` (lookup path def); `NavGrid.js#_bakeZones` (paint path-tube cells `ZONE.SIDEWALK`) |
| **Invariant** | Initialised once before any NPC is registered. `NavGrid` reads `walkPaths` from the scene layout object at bake time independently — it does not read the exported `WALK_PATHS` object. |

---

## Not yet covered

Two live `npc.mem('motor')` fields have no section above. They are narrow and
single-owner, but listed here so the registry is not silently incomplete:

- **`dirCD`** — facing-flip cooldown timer (seconds). Owner `BaseStateMachine.js#updateFacing`;
  blocks a direction flip while `> 0`, reset to `0.45` on each accepted flip.
- **`savedBounds`** — `{minX, maxX}` saved before departure widens an NPC's X bounds
  so it can walk off-screen. Owner `BaseStateMachine.js` (`triggerDeparture` saves,
  `restoreDepartureBounds` restores).

---

## Open Issues

### (a) NPC position in BLOCKED cell after `standUp`

**Claim**: `sitDown` places the NPC at the bench's seat surface, which lies inside
the bench's obstacle AABB (`ZONE.BLOCKED` in NavGrid). `standUp` clears the bench
reference but does **not** reposition the NPC.

**Evidence**:
- `'bench'` is an obstacle prop → `NavGrid#_bakeObstacles` marks all cells within
  `footprint.rx/ry + NPC_HALF_W` as BLOCKED.
- `seat.js#sitDown` calls `_setXY(npc, bench.x, seatSurfaceY(bench) - sitBodyY * sc)`
  — places NPC at seat surface inside bench footprint.
- `seat.js#standUp` clears `bench._occupiedBy`, `npc.mem('social').bench`, and
  `npc._sortY`. No `_setXY` call — NPC remains at the seated x/y.
- `Motor.js#_slideMove` escape rule: "already in a blocked cell → move freely to
  get out" — the designated recovery mechanism.

**Status**: Intentional. The escape rule in `Motor.js#_slideMove` is the documented
recovery path. The coupling is implicit — no comment in `standUp` references it.

---

### (b) Overlap: `StuckProbe` vs `Motor.integratePhysics` progress monitor

| | `StuckProbe.js#stuckProbe` | `Motor.js#integratePhysics` progress monitor |
|---|---|---|
| **Period** | Every 2 s (module-level `acc`) | `RECOVERY_RULES.progress_monitor.window` (`mot.progressAcc`) |
| **Threshold** | `moved < 8` px over the 2 s window | `RECOVERY_RULES.progress_monitor.movedLT` over the window |
| **Trigger condition** | `state ∈ {walk,run,jog}` plus separate WAIT / activity / frozen buckets | `state ∈ {walk,run,jog}` **and** an active `walkMode` or `mot.goal` |
| **Action** | Observational: writes `window.__stuck`, logs to `tally`. **No side-effects on NPC state.** | Reactive, two-strike: with a `goal`, first strike sets `mot.goal._stuck` + `mot.needReplan`, second fires `onDone('blocked')` and nulls `goal`/`path`; without a goal (wander) nulls `roamTarget` + `path` |
| **Scope** | All registered NPCs via `BehaviorManager` | Only NPCs with `_motorInstalled` |

These are complementary: StuckProbe is a **debug instrument**; the progress monitor
is the **recovery actuator**. Not redundant.
