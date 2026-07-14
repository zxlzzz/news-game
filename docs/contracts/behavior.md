# Behaviour Subsystem Contract

verified at 8f691609a02528495426ff4ea21abcfa9152065b

Normative. Code changes that affect any section must update this file in the
same commit. Symbol anchors: `File.js#symbolName` (line numbers parenthetical).

---

## Layer Stack

```
BehaviorManager          — thin orchestrator; owns the update loop order
  ├── SocialLayer        — Activity tick + Talk pairing
  ├── WaitForBusLayer    — bus-waiter FSM
  ├── Agenda             — per-NPC desire → Goal selection (no activity)
  ├── TaskRunner         — primary/monitor task slots
  ├── BaseStateMachine   — state transitions + steerRoam
  ├── WalkMode           — walkMode lifecycle + zone guards
  ├── ModifierLayer      — overlay poses (phone/smoke/gesture)
  └── Motor              — sole writer of state/speed/animation/x/y
```

Update order each frame (per NPC, `BehaviorManager.js#update`):
1. `SocialLayer.update` — Activity tick + Talk pairing
2. `WaitForBusLayer.update` — bus-waiter scan
3. Lifespan expiry → `releaseAllHoldings` + `triggerDeparture` + `ExitSceneTask`
4. `Agenda.tick` — Goal selection when no Activity
5. `TaskRunner.tick` — always, including monitor tasks
6. If `activity` → skip BSM / modifiers
7. `tickBaseState` + `checkZoneTransition`
8. `tickModifiers`
9. `_separate` — inter-NPC separation impulses

---

## STATE_DEFS (Motor.js#STATE_DEFS, line 105)

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
| `routing` | `walk` | 1.0 | false | null (∞) |
| `chess` | `chess` | 0 | true | null (∞) |
| `chess_onlooker` | `chess_onlookers` | 0 | true | null (∞) |

`speedK` × `npc.walkSpeed` (default 26 px/s) = `npc.speed`.
`once: true` → animation plays once to `animDone`, then holds last frame.
`dur: null` → `stateDur = Infinity`; transition only on external trigger.

States NOT in this table must never appear in `setState` calls (gate: `check-invariants.sh#S1`).

---

## NPC Profiles (NpcProfile.js#PROFILES, line 200)

| Profile key | `initial` | Registered by |
|---|---|---|
| `pedestrian` | `walk` | `Pedestrians.js#spawnOnePedestrian` (84), `SceneInitializer.js` (172 as `stall_seller` fallback) |
| `businessman` | `walk` | `Pedestrians.js#spawnOnePedestrian` |
| `tourist` | `walk` | `Pedestrians.js#spawnOnePedestrian` |
| `chess_player` | `chess` | `Chess.js` (82, 83) |
| `chess_onlooker` | `chess_onlooker` | `Chess.js` |
| `stall_seller` | `stand` | `SceneInitializer.js` (172) |
| `dog_owner` | `walk` | `DogWalker.js` (45) |
| `athlete` | `jog` | `Athletes.js` (15, 27) |

All profiles registered via `BehaviorManager.js#register` (74), which calls
`installProtection` and creates `TaskRunner` + `Agenda` instances.

---

## Transition Table (BaseStateMachine.js#TRANSITIONS, line 129)

Priority scheme (higher = earlier evaluation):

| Priority | Type | Example |
|---|---|---|
| 99+ | `animDone` forced | `fall → lie_ground`, `get_up → stand` |
| 5 | `timeout` | any finite-dur state → `_resolveTimeout` |
| 50–98 | Social injection | `SocialLayer` via `registerTransition` |

`_resolveTimeout` (`BaseStateMachine.js#_resolveTimeout`, 92): picks next state
from `profile.transitions[npc.state]` weighted table, applies environment
pre-checks (bench availability, wall proximity), handles `sit_bench`/`lean_wall`
side-effects (slot occupation).

`sit_bench` is removed from `walk`/`stand` transition rows in `NpcProfile.js`
(PED_TRANSITIONS comment, line 17) — `UseBenchTask` drives bench seating via
`Agenda` instead.

---

## Activity System (SocialLayer.js)

Activities lock the NPC out of BSM/modifiers (`BehaviorManager.js#update`, 139:
`if (sc.activity) continue`).

| Activity | Participants | Drives state |
|---|---|---|
| `TalkActivity` | 2 NPCs | `talk` |
| `ChessActivity` | 1 player + optional onlookers | `chess` / `chess_onlooker` |
| `StallActivity` | seller + 1 buyer | seller stays `stand`; buyer uses `stall_buyer_*` overlays |
| `DogWalkActivity` | owner + leashed dog | owner keeps walking; dog via `leashTarget` |
| `UsePropActivity` | 1 NPC | `stand` at vending/trash |

`SocialLayer.js#createActivity` instantiates and registers activity instances.
`npc.mem('social').activity` is the lock field; cleared by `Activity#end`.

---

## WalkMode Kinds (WalkMode.js)

| kind | Description | Constructed by |
|---|---|---|
| `wander` | Random drift within bounds; replans on each arrival | `WalkMode.js#modeWander` (133) |
| `direct` | Straight-line to a fixed target; callback on arrive | `WalkMode.js#modeDirect` (143) |
| `path_follow` | Follows `WALK_PATHS[key]` waypoint sequence; supports pausing | `WalkMode.js#modePathFollow` (152) |

Stack API: `setWalkMode` (replace), `pushWalkMode` (save + replace), `popWalkMode`
(restore). `planCrossing` pushes before crossing; `_defaultOnExit` pops on
walk/run state entry if stack non-empty.

Zone guards (`WalkMode.js#checkZoneTransition`, 178): if a wander NPC drifts
into road/bike zone, installs a `direct` mode to cross through. Covers states
`walk`, `run`, `jog`.

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

## Separation (BehaviorManager.js#_separate)

Two passes per frame:
1. **mover vs mover** — mutual repulsion, both pushed
2. **mover vs static** — mover pushed, static zero displacement

`static` set excludes benched NPCs (`!n.mem('social').bench`).
Repulsion radius: `24 * ((a.scale + b.scale) / 2 / 0.18)` px.
Force `f = ((sepR - d) / sepR) * 16 * dt`; scaled down 0.5× when push direction
opposes travel direction (`_sepScale` — `direct` mode only).
All position updates via `Motor.js#nudgeXY` (authorised gate).

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
