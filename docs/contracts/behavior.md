# Behaviour Subsystem Contract

verified at 8f691609a02528495426ff4ea21abcfa9152065b

Normative. Code changes that affect any section must update this file in the
same commit. Symbol anchors: `File.js#symbolName` (line numbers parenthetical).

---

## Layer Stack

```
BehaviorManager          — thin orchestrator; owns the update loop order
  ├── SocialLayer        — Activity tick + Talk pairing
  ├── WorldEventLog/Belief — drain new events → witness claims (W-7a)
  ├── WaitForBusLayer    — bus-waiter zone scan (waiter tick → WaitBusTask via TaskRunner)
  ├── Agenda             — per-NPC desire → Goal selection (no activity)
  ├── TaskRunner         — primary/monitor task slots
  ├── BaseStateMachine   — state transitions + steerRoam
  ├── WalkMode           — walkMode lifecycle + zone guards
  ├── ModifierLayer      — overlay poses (phone/smoke/gesture)
  └── Motor              — sole writer of state/speed/animation/x/y
```

Update order each frame (per NPC, `BehaviorManager.js#update`):
1. `SocialLayer.update` — Activity tick + Talk pairing
2. `WorldEventLog.drainNewEvents()` → `Belief.generateClaims()` (W-7a) — the
   single consumption point for events emitted this frame (currently
   `TalkActivity.js`/`ContactActivity.js` and `ChessActivity.js` (tasks.md P-3)
   call `emitEvent()`, confined to `js/behavior/activities/` by
   `check-invariants.mjs` Rule 14); actor ids
   resolved against `this.npcs`, missing actors passed through as `null`
   (`Belief` tolerates)
3. `WaitForBusLayer.update` — zone scan only; waiter tick is a per-NPC
   `WaitBusTask` (Patch C), driven at step 6 like any other task, not by
   this layer
4. Lifespan expiry (`!sc.activity && !sc.waitingBusStop` gate) →
   `releaseAllHoldings` + `triggerDeparture` + `ExitSceneTask`; age
   accumulates during Activity/bus-wait, trigger fires on first frame after
   either ends (`sc.waitingBusStop` added in Patch C — waiting is a Task now
   and doesn't set `sc.activity`, so it needs its own guard to keep the old
   "can't expire while waiting for the bus" behavior)
5. `Agenda.tick` — Goal selection when no Activity
6. `TaskRunner.tick` — always, including monitor tasks
7. If `activity` → skip BSM / modifiers
8. `tickBaseState` + `checkZoneTransition`
9. `tickModifiers`
10. ~~`_separate` — inter-NPC separation impulses~~ — M-1 已删除（信任无碰撞路径重构）

---

## STATE_DEFS (Motor.js#STATE_DEFS)

Authoritative state table. `anim` must be a valid `manifest.json` clip id.

| State | anim | speedK | once | dur (s) |
|---|---|---|---|---|
| `walk` | `walk` | 1.0 | false | [4, 10] |
| `run` | `run` | 2.4 | false | [2, 4] |
| `jog` | `jog` | 1.0 | false | null (∞) |
| `stand` | `stand` | 0 | false | [3, 8] |
| `sit_bench` | `sit_bench` | 0 | true | [8, 15] |
| `fall` | `fall` | 0 | true | null (∞) |
| `lie_ground` | `lie_ground` | 0 | true | [4, 8] |
| `lean_wall` | `lean_wall` | 0 | true | [8, 20] |
| `squat` | `squat` | 0 | true | [5, 15] |
| `sit_ground` | `sit_ground` | 0 | true | [8, 20] |
| `lie_bench` | `lie_bench` | 0 | true | [15, 40] |
| `get_up` | `get_up` | 0 | true | null (∞) |
| `talk` | `stand` | 0 | false | null (∞) |
| `loiter` | `stand` | 0 | false | null (∞) |
| `chess` | `chess` | 0 | true | null (∞) |
| `chess_onlooker` | `chess_onlookers` | 0 | true | null (∞) |
| `ride` | `bike` | 1.0 | false | null (∞) |
| `lift` | `lift` | 0 | true | null (∞) |

The `routing` state was deleted along with its whole state-machine chain in N3-b;
exit routing now runs as an ordinary `walk` driven by `ExitSceneTask` + `mot.goal`.

`speedK` × `npc.walkSpeed` (default 26 px/s) = `npc.speed`, written through the
`Motor.js#_mw` gate on every state entry (not a direct assignment).
`once: true` → animation plays once to `animDone`, then holds last frame.
`dur: null` → `stateDur = Infinity`; transition only on external trigger.

States NOT in this table must never appear in `setState` calls (gate: `check-invariants.mjs#S1`).

---

## NPC Profiles (NpcProfile.js#PROFILES)

| Profile key | `initial` | Registered by |
|---|---|---|
| `pedestrian` | `walk` | `Pedestrians.js#spawnOnePedestrian`, `SceneInitializer.js` (as `stall_seller` fallback) |
| `businessman` | `walk` | `Pedestrians.js#spawnOnePedestrian` |
| `tourist` | `walk` | `Pedestrians.js#spawnOnePedestrian` |
| `chess_player` | `chess` | `Chess.js#spawnChess` |
| `chess_onlooker` | `chess_onlooker` | `Chess.js#spawnChess` |
| `stall_seller` | `stand` | `SceneInitializer.js` |
| `dog_owner` | `walk` | `DogWalker.js#spawnDogWalker` |
| `athlete` | `jog` | `Athletes.js#spawnAthletes` |
| `cyclist` | `ride` | `CyclistSpawner.js#_spawn` |
| `child` | `walk` | `Pedestrians.js#spawnOnePedestrian` (via `TYPES`, weighted low), `Director.js#PERIODS` (10–19h mix only). `skeleton:'child'` is live since R-1: `Npc.js` constructor resolves it to `skeletonScale` (× into `npc.scale` by `EntityManager`) + `skeletonName` (StickRenderer `headRadius` lookup key) |

All profiles registered via `BehaviorManager.js#register`, which calls
`installProtection` and creates a `TaskRunner`, plus an `Agenda` unless the
profile sets `agenda: false` (`athlete`, `cyclist` — permanent scenery).

---

## Transition Table (BaseStateMachine.js#TRANSITIONS)

Priority scheme (higher = earlier evaluation):

| Priority | Type | Example |
|---|---|---|
| 99+ | `animDone` forced | `fall → lie_ground`, `get_up → stand` |
| 5 | `timeout` | any finite-dur state → `_resolveTimeout` |

`BaseStateMachine.js#registerTransition` is an exported extension point for
injecting extra rules at any priority, but **currently has zero callers** —
`SocialLayer` drives its NPCs through `Activity` + the `sc.activity` lock, not
through injected transitions. Treat it as reserved API, not as live machinery.

`_resolveTimeout` (`BaseStateMachine.js#_resolveTimeout`): picks next state
from `profile.transitions[npc.state]` weighted table, applies environment
pre-checks (bench availability, wall proximity), handles `sit_bench`/`lean_wall`
side-effects (slot occupation).

`sit_bench` is removed from `walk`/`stand` transition rows in
`NpcProfile.js#PED_TRANSITIONS` — `UseBenchTask` drives bench seating via
`Agenda` instead.

---

## Activity System (SocialLayer.js)

Activities lock the NPC out of BSM/modifiers (`BehaviorManager.js#update`:
`if (sc.activity) continue`).

| Activity | Participants | Drives state |
|---|---|---|
| `TalkActivity` | 2 NPCs | `talk` (sub-events hand off to `ContactActivity`, see below) |
| `ChessActivity` | 2 players (always full roster from `Create`; onlookers are a separate single-NPC `ChessOnlookerTask`, not an Activity member) | `chess` |
| `StallActivity` | seller + buyer (full roster from `Create` — Patch H, prop-as-host; seller alone is a separate single-NPC `StallSellerTask`, not an Activity member) | seller stays `stand`; buyer uses `stall_buyer_*` overlays |
| `ContactActivity` | 2 NPCs, role names come from the clip itself (e.g. `receiver`/`approacher`) | driven by `DuetStager` (reach→play→release), see `docs/contracts/activity-lifecycle-v1.md` §6 |

`SocialLayer.js#createActivity` instantiates and registers activity instances via
`ActivityRegistry.js`. `npc.mem('social').activity` is the lock field; cleared by
`Activity#destroy` (via `release()`).

Single-NPC behaviors that used to be (or could be mistaken for) Activities, and where they
actually live now: `UsePropActivity` → inlined into `UseSmartPropTask` (Patch A);
chess onlooker → `ChessOnlookerTask` (Patch D); stall seller solo → `StallSellerTask`
(Patch H); bus waiting → `WaitBusTask` (Patch C, `WaitForBusLayer._addWaiter` does
`runner.setPrimary(new WaitBusTask(stop), npc)`, not `SocialLayer.activities.push`).
None of these set `npc.mem('social').activity` — they run via `TaskRunner.primary` and
cooperate with BSM instead of locking it out, matching the `activity-lifecycle-v1.md` §1
boundary rule ("Activity = 严格 ≥2 NPC 的协调").

Dog walking is **not** an Activity: `DogWalker.js#spawnDogWalker` registers only
the owner (profile `dog_owner`) and ties the dog to it via `leashTarget`, which
`Npc.js#update` / `Motor.js#integratePhysics` resolve positionally each frame.
There is no `DogWalkActivity` class.

---

## WalkMode Kinds (WalkMode.js)

| kind | Description | Constructed by |
|---|---|---|
| `wander` | Random drift within bounds; replans on each arrival | `WalkMode.js#modeWander` |
| `path_follow` | Follows `WALK_PATHS[key]` waypoint sequence; supports pausing | `WalkMode.js#modePathFollow` |

Only these two kinds exist. The former `direct` kind and its `modeDirect`
constructor were deleted in N-2b — goal-directed movement now goes through
`mot.goal` + `mot.path` (see `contracts/movement.md`), not through a walk mode.

API: `setWalkMode` (replace) is the only entry point. The push/pop stack
(`pushWalkMode` / `popWalkMode` / `walkModeStack`) was deleted in N-2b: an
interrupted mode is not saved or restored, the next mode is chosen fresh.

Zone guards (`WalkMode.js#checkZoneTransition`): if a wander NPC drifts into the
road or a bike lane, the guard **overwrites `mot.vel` for that frame** to bounce
it back to the nearest safe band — it does not install a mode and keeps no state.
Goal-driven NPCs return early (the planner handles zones through cost). Covers
states `walk`, `run`, `jog`.

---

## Modifier Layer (ModifierLayer.js)

Three modifier categories:

| Category | Example clips | Mutex |
|---|---|---|
| `held` (pose sustained) | `phone_look`, `phone_call`, `smoke`, `cross_arm`, `hands_in_pocket` | one held at a time |
| `gesture` (one-shot) | `check_watch`, `yawn`, `wave`, `look_around` | clears on `animDone` |
| `spawn_trait` | `hold_bag`, `umbrella`, `walk_dog` | assigned at spawn |

Held modifiers persist across state transitions if the new state is in the
modifier's `on` list. Cleared on Activity lock.

---

## Separation — M-1 已删除

`BehaviorManager.js#_separate`/`_sepScale`（mover-vs-mover / mover-vs-static 分离冲量）
随「信任无碰撞路径」重构一并删除；A* 路径本身不产生碰撞，反应式分离不再需要。

---

## Known Gaps / Not Implemented

The following appear in `docs/npc-states.md` (snapshot) or `docs/behavior-design.md`
(snapshot) but are **not present in current code**:

- `bike` / `mobile` states — not in `STATE_DEFS`; cyclists use inline Npc.js
  physics and `drawExtra` overlay, never enter `BehaviorManager`
- `handshake`, `push`, `give_item`, `point_at`, `wall_write`, `bend_pick`,
  `hold_sign` — manifest clips exist but no Activity or transition implements them
- Camera reaction system — `CameraReactionLayer.js` exists but is a stub
- `single`, `cross_arm` — npc-states.md lists as states; in current code they
  are `held` modifier poses, not `STATE_DEFS` entries
- Desire/utility model from behavior-design.md — partially implemented via
  `Agenda.js` desires but utility scoring is simplified

These gaps are documented for awareness; do not add them to STATE_DEFS without
implementing the full transition path.
