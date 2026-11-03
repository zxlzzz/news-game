# Text NPC behavior — batch 3 implementation report

2026-10-28. This batch expanded the remaining inventory to expose limits of the behavior scheme. It does not treat row count, text-demo completeness or source filenames as visual acceptance. Work remains in the independent executor/test scene. No main game, motion/playback code, memory.md, branch, commit or push was used.

## Result and coverage

All 98 inventory entries are accounted for: **71 enabled inventory behaviors, 24 disabled with explicit reasons, 3 internal jobs**. Inventory walk maps to the existing stroll row; idle and disabled adjust_clothes remain implementation entries. Thus table.json has **97 rows: 72 enabled, 25 disabled**. **110 action declarations** were individually reviewed against actions.md, behaviors.md, clip-setup and referenced source metadata/export files.

The [complete row cost/coverage ledger](catalog-audit-3.md) lists each row's actual content locations, first introduction of shared declarations and personal-tag cost. [asset-audit-3.json](asset-audit-3.json) preserves each complete action declaration, table line, source text/path, prop/post/partner configuration and review note. Every enabled row is independently removed/re-added in the deterministic check; all other table data must remain unchanged.

72 enabled means executable when the required actual scene resources/conditions exist. It does not claim every row was selected in the mixed scene. The scene and deterministic cases validate the mechanisms; the audit covers all row/action declarations. Queue and serve_customer remain internal service work; pass_door is an internal capability TODO, not another scored desire.

## New reusable templates

| Template | Verified different behaviors | State / lifecycle |
|---|---|---|
| conversation | chat, whisper, argue; interview/answer_interview | Live encounter, roles, speaking/listening turns, bounded assembly and open-group membership. One speech ends a turn rather than the purpose. Either participant can leave; two continue after a third leaves. Interviewer requires the actual microphone; reply requires an inquiry. |
| object_activity | play_chess, watch_chess | Table owns participants/slots, current turn, thought/move result. Players seat themselves; spectators require an active game. Departure invalidates watching/turns. A lone player cannot wait forever. No initiator-specific branch. |
| move_together | walk_with_child/follow_adult, walk_dog | Current scene journey with explicit leading role and destination; every human chooses independently. Dog adapter contributes actual position/willingness. Shared progress, bounded separation, actual arrival and immediate dependent stop. No invented dog humanoid clip. |
| event_response | react_startle, protect_self, recover_balance, rest_after_fall, watch_event | Live visible/expiring event source, subject/witness distinctions, salience in one watch row. Fall/imbalance change actual body facts before scoring. Rest/self-rise checks actual ground posture and ability. |
| sequence | collect_parcel, withdraw_cash, pickup, letter/notice/trash/laundry deposits, cafe, payphone | Short declared steps using the common preparation/effect path. Finite real item inputs, owner/reach/capacity checks, once-only collect/deposit. No fabricated stock/payment/account. |
| observe | greet, take_photo, film_phone | Live person/focus, actual tool preparation, updated facing with stable progress, cancellation when target disappears. |
| transport | carry_to_place, walk_with_umbrella | One row per purpose, item-conditioned movement inside the template. Box/bag/open versus closed book/umbrella variants do not gain extra selection tickets. |

Existing pair_once also now expresses asymmetric give_object/receive_object through a scene-provided current item/receiver intent and the same atomic joint commit as handshake/service. A new behavior-specific engine branch was not added. Flyer distribution remains disabled because a left-hand stack and a separate right-hand sheet exceed the actual one-object hand representation.

The object-owned design follows design_route_npc_behavior.md:121: activity is recorded on the object instead of maintaining two initiation-direction implementations. The chess check reverses person array order and uses a second table identity without engine edits. The demo reads the real park_chess_table marker positions.

## Actual development cost and structural changes

The original scheme was insufficient for sustained encounters, object turns, coordinated travel and event-sourced candidates. This was real platform work, not a claim that 82 newly recorded rows cost nothing. The table was materialized as a batch; per-row independence is reproduced by deletion/re-addition, rather than described as separately timed commits.

| Shared capability exposed by content | Engine/files actually changed | General repair |
|---|---|---|
| New candidate/activity owners | activities.gd (new), system.gd dispatch/validation/update hooks | Template registry supplies targets, score circumstances, work, requests and lifecycle. No row-name tests. |
| Sustained multi-person readiness | activities.gd, existing system._grant | Capture current instances; aggregate member resources/minimum score; grant all or none through the existing allocator. |
| Object game/watch roles | activities.gd; table object definition; scene marker provider | Object-owned ledger/slot assignment/turn effects. Content changes role/action/marker data. |
| Shared journey | activities.gd; table role/leader definition; scene links/animal adapter | Two actual routes share progress, bounded separation and cancellation; declared leader determines the destination independently of dictionary order. |
| Fall, ground rest and seat variants | system.gd common preparation/readiness/effects; table ground_poses/seats | Actual ground posture, can_rise and declared transitions. Non-bench seats never borrow bench animations. No shared-support helper simulation. |
| Finite item processes | system.gd generic collect/deposit effects; activities sequence | Actual item movement and owner/reach/capacity checking, not per-device timer success. |
| Asymmetric giving | cooperation.gd generic transfer effect/intents/roles | Reuse existing pair/joint allocation and obsolete-instance protection. |
| Run/jog rates | system.gd optional moving-action speed; table actions | One generic field; run 3.2 m/s and jog 2.4 m/s in text demo, rounded from exported root travel (~3.23/~2.38), rather than walking at the same shared rate. |

After those shared capabilities exist, ordinary rows/configurations change table.json only. First use of a new preference tag also changes demo.json's explicit personal coefficients; the ledger counts that second file. Existing tags need no extra person edits. New static resources/participants are scene authoring cost, not hidden engine capability. Companion reports/audits and synchronized material requests are delivery documentation, not claimed free per-row code.

### Failures actually observed and repaired

1. **Old pair cleanup deleted conversation points.** The first conversation cases logged start followed by blocked at 0.0167 s; work previews referred to newly created points, which the old cooperation cleanup removed. Core cleanup now unions providers' live layouts and preserves actual occupancy/reservations. This is shared ownership repair, not a conversation-name exception.
2. **Incompatible invitations swapped forever.** The first 240-second export showed Talk_A and Talk_B each making 1,362 purpose/action/instance transitions, spending 13,689 frames in pair_wait and never reaching a speaking action. They alternated chat and whisper because both independently followed the other's raised invitation. Common read-only invitation matching now gives one stable circumstance winner; a three-way directed cycle is also checked. This changes no person's final choice or body ownership.
3. **Moving focus restarted the action.** Work comparison included a changing focus coordinate, so following a moving subject would reset photo progress. Only facing is updated; semantic work/turn/item identity still governs restart. The deterministic moving-target photo completes, and vanished-focus filming cancels its old callback.
4. **Posture/prop assumptions did not survive source audit.** Standing read_book had been permitted seated; waits/bench transitions had unconditional empty-hand bindings; non-bench seating would use bench transitions. These now have standing-only declarations, conditional hand bindings and data-selected seat transitions. Specific false source correspondences are listed below.
5. **A scanner pass was initially too weak.** One-frame preparation text interleaved with the chat/whisper cycle and defeated exact adjacent-text matching. The scanner now compares stable action text, checks per-binding wait progress, and separates prior standing time from actual stationary walking. Already granted next work starts at zero extra time in the same update, avoiding the presentation flash. Continuous waiting across different bounded invitations is reported as different attempts, not an invented single deadlock.

## Change-old-content probes

| Actual mutation | Places changed / dependent rewrites | Observed result |
|---|---|---|
| Handshake invitation range 1.0 then 2.5 m, peer at 2 m | One defaults.invite_range field; zero row/engine rewrites | Peer excluded then included through unchanged pair template. |
| read_book permissive unbound posture, then standing | One posture field for the actual change; zero row/engine rewrites. The probe's permissive version explicitly has no clip. | First stays seated; after tightening, the same row uses shared rise. Final library declaration is standing only. Original book test now allows the extra preparation time and checks actual rise. |
| hold_demo to 0.5 s | One shared default; zero behavior/engine edits | Existing read_newspaper hold completes at 0.7 s while retaining the paper. |
| Second service without weighing, origin (5,0,7), yaw omitted then 90 degrees | One service definition and scene config. Rotation changes yaw and the separately authored surface position, **two data locations**; five generated role positions/facings need zero manual rewrites. No template changes. | Both full transactions select, charge once, collect, deliver and physically leave; missing providers/markers and invalid yaw fail without partial posts. |
| Bench versus chess/step/cafe seating contract | One shared seats map plus two reusable unbound transition declarations; not separate preparation code per behavior | Chess uses seat_lower; chair tests keep the bench transition. Shared ground rise remains distinct. |

The old waiting assertion was deliberately corrected: it now verifies stand_idle for empty hands and null for held-wallet waiting, rather than approving an unconditional source. No old scenario group was removed; all three batches run together.

## Materials: identified sources versus real gaps

All 110 declarations are in the audit. 27 are fully unbound semantic actions; 11 have conditional empty-hand source bindings with explicit held gaps. Remaining source bindings are still not visual/contact acceptance. Requests are synchronized into actions.md §12, including ordinary listener, child-side gait, generic giving/pickup, floor entry/hold/rise, non-bench transitions, playing guitar, wiping and compatible held-object variants.

Observed source conflicts:

- assets/animations/npz/sit_sideways/meta.json:3 describes reclining, so the sideways action stays unbound.
- assets/animations/npz/walk_umbrella/meta.json:3 describes a phone at the ear, despite the umbrella prop in godot/npc/clip-setup.json:1746; open-umbrella movement stays unbound.
- godot/npc/clip-setup.json:444 contains parcel screen-touch poses without the retrieval described by the source. The collect semantic stays unbound.
- godot/npc/clip-setup.json:1844 moves cash from pickup toward pocket; the finite collect-to-hand semantic cannot claim that whole source as its matching output.
- godot/npc/clip-setup.json:290 and :304 place question/answer at 0.9 m and listening/describing at 1.2 m. The current short-answer encounter leaves its microphone-listening variant unbound.
- walk_hold_front's source describes a closed book; open-book movement uses a separate unbound action inside the same carrying row.
- trip_fall's source ends prone; lie_ground_hold is supine. The manufactured face-up fall references fall_back as an external body fact; no forward/prone clip is paired with that hold or actually played by this scene.

Generic tool-taking/stowing/putting on the ground are defined text transfers with missing clips, not evidence of completed animation support. Missing-source semantics continue only where their real object/support requirements are known.

## Disabled / TODO content

The following complete list is table data, not a prerequisite for the enabled part. Internal pass_door is additionally TODO because route-door traversal facts are absent.

| Row | Missing reason |
|---|---|
| `adjust_clothes` | 需具体原因才启用（behaviors.md §9） |
| `pet_dog` | TODO: Needs animal approach/contact permission and departure interface. |
| `wait_person` | TODO: Needs a scene-provided current waiting person/place; no schedules or remembered appointments. |
| `buy_newspaper` | TODO: Needs configured checkout and one-time collection; taking a paper is not a purchase. |
| `use_vending` | TODO: Machine selection/payment/output facts are undefined; a timer must not create stock. |
| `hold_door` | TODO: Needs route-door state and actual following passage; independent navigation has no door model. |
| `push_cart` | TODO: Needs movable-object driving, handle coupling and persistent stopped-object position. |
| `push_stroller` | TODO: Needs movable-object driving, handle coupling and persistent stopped-object position. |
| `pull_suitcase` | TODO: Needs movable-object driving; source text describes carrying a bag rather than pulling a case. |
| `ride_bicycle` | TODO: Needs mounting/dismounting, vehicle movement and riding support. |
| `ride_scooter` | TODO: Needs vehicle movement and riding support. |
| `hail_taxi` | TODO: Needs an actual taxi response/stop, vehicle seat and door state. |
| `enter_car` | TODO: Needs an independent current ride purpose and actual vehicle seat/door state. |
| `exit_car` | TODO: Needs actual vehicle seat support. |
| `assist_person` | TODO: Needs shared body support and support transfer when either person leaves. |
| `accept_assistance` | TODO: Needs shared body support; synchronized walking alone is insufficient. |
| `help_fallen` | TODO: Needs shared support transfer; help_up/helped_up clips are also missing. |
| `play_seesaw` | TODO: Needs two-sided mechanical support and facility motion. |
| `slide_seated` | TODO: Needs actual position along the slide and bottom-arrival facts. |
| `swing_seated` | TODO: Needs moving support and facility entry/exit. |
| `do_pullups` | TODO: Needs hanging support and safe return to ground. |
| `distribute_flyer` | TODO: Needs finite sheets and left-hand stack/right-hand transfer; single held slot cannot express both. |
| `receive_flyer` | TODO: The supplying process and two-hand sheet representation are undefined. |
| `phone_call` | TODO: Needs a real current phone connection and explicit end condition; do not invent one for this row. |
| `handstand` | TODO: Persistent palm support and interrupted return to ground are not represented by the current body support model. |

## Verification

All commands ran headless against the independent text scene, without starting the main scene/window. Temporary logs/frame exports are removed after their evidence is summarized here.

| Check | Result |
|---|---|
| Baseline check_text_behavior.gd before changes | TEXT_BEHAVIOR_OK (328 assertions), exit 0 |
| Final combined deterministic check_text_behavior.gd, including batches 1/2/3 | **TEXT_BEHAVIOR_OK (693 assertions)**, exit 0 |
| Included actual-scene integration | Real WalkGrid, 300 simulated seconds; old arrival/support/handshake/checkout/delivery and unique object locations remain checked |
| Six explicit --check-only scripts: system, cooperation, activities, demo, check_text_behavior_3, scanner | All exit 0 |
| Python source/declaration audit | **TEXT_BEHAVIOR_AUDIT_OK**, 98 inventory entries, 97 rows, 72 enabled, 110 actions |
| Final every-frame mixed-scene scan | 24 people, **240 s / 14,400 frames**, TEXT_BEHAVIOR_SCAN_OK; 3,105 trace events; no scan failures; maximum no-purpose gap 0.5 s |

Final export review: Talk_A/Talk_B fell from 1,362 transitions each in the failing run to 92/110 transitions, with 3,044/3,840 speaking frames. The one encounter alive at frame 14,400 was actively alternating Talk_A/Respondent; the two chess players and observers were also progressing, not mutually waiting.

The scene scan includes real selected speech/listening, chess moves/watchers, both shared travel kinds, startle, ground rest/self-rise, imbalance recovery and the original service/handshake actions. It checks stable head-text cycles, movement with no displacement for over 5 s, selected work with no body and unproductive per-binding waits longer than the shared assembly bound. Service waiting is tied to the current buyer's actual progress, not unrelated movement.

Windows still prints “Failed to read the root certificate store”, also observed in the untouched baseline; all listed successful checks exit 0. This is not silently counted as a script failure or repaired through unrelated files.

## Observed boundaries and not-excluded integration risks

Every item below has a concrete evidence pointer. Source/declaration checks and text state are deliberately separated from missing integration evidence.

| Status | Boundary / evidence |
|---|---|
| Observed | Text progress commits once/hold and joint effects using shared demonstration time, not real clip feedback. `godot/npc/text_behavior/system.gd:625`; `godot/npc/text_behavior/cooperation.gd:552`. Real animation completion/handoff timing must replace those progress inputs. |
| Observed | Shared travel has real path/separation checks but no hand-contact solver. `godot/npc/text_behavior/activities.gd:578` and `godot/npc/text_behavior/activities.gd:620`. Child-side material is explicitly missing; dog adapter supplies only position/willingness. |
| Observed | Chess commits turn/move count, not a legal chess board or capture result. `godot/npc/text_behavior/activities.gd:644`. Thus capture/take-back/win expressions are not fabricated from available clips. |
| Observed | Source needs two hands for broom/mop while setup attaches the prop to right hand: godot/npc/clip-setup.json:278/:284 and assets/animations/npz/sweep_ground/meta.json:6, assets/animations/npz/mop_ground/meta.json:3. This audit establishes one actual object and correct tool type, not verified second-hand contact. |
| Observed | One held-object slot and upright/ground/seat support are the represented body facts: `godot/npc/text_behavior/system.gd:181`. Flyer stack transfer, shared help, palm/hanging/mechanical/vehicle support stay disabled rather than passing as implemented. |
| Not excluded | Curved/obstructed paired routes could break exact material contact even within the permitted separation. The checks sample positions/progress, not hand geometry: `godot/tools/check_text_behavior_3.gd:222`; real-grid route adapter `godot/scenes/text_behavior_test/demo.gd:101`. No claim of obstacle-safe coupled contact is made. |
| Not excluded | Body collision avoidance, continuous animation seams and final UI layout are not established. Paths are sampled without a body collision solver in `godot/npc/text_behavior/system.gd:561`; demo builds fixed symbols and stacks projected boxes in `godot/scenes/text_behavior_test/demo.gd:279`. No window/render acceptance was run. |
| Not excluded | Finite scene/seed coverage is not exhaustive. The exported 14,400-frame scan and deterministic perturbations are the actual evidence; `godot/tools/scan_text_behavior.gd:18` and `godot/tools/check_text_behavior_3.gd:420`. Runtime weights/content desirability are not claimed tuned by that count. |

## Final artifacts and scope

Implementation: system.gd/cooperation.gd/table.json plus new activities.gd. Independent demo: demo.gd/demo.json. Checks: existing combined runner and revised source-sensitive assertions, new check_text_behavior_3.gd, scan_text_behavior.gd and audit_text_behavior.py. Documentation: this report, current README/execution plan, actions.md requests, catalog/source audits and PROGRESS-3.md.

No per-behavior engine files, row-name dispatch, duplicated variant rows, silent unknown-data fallback, production motion edits or new external dependencies were introduced. Unrelated workspace changes are preserved. Scratch scripts/logs/frame exports are not deliverables.
