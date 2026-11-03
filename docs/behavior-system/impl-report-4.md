# Text NPC behavior — batch 4 implementation report

2026-10-28. Completed in the independent text executor/test scene. The aim was to
verify a reusable support/connection scheme, not to maximize demo behavior count.
No main scene, physical prop scene, motion asset, clip-setup, playback code,
memory.md, branch, commit or push was changed. Own temporary logs/frame exports
and debug/writer scripts were removed after the evidence below was recorded.

## Result

All **17 authorized support behaviors** and **phone_call** are enabled through
shared mechanisms. The prior **72 enabled row declarations are unchanged**.
The table has **97 rows: 90 enabled, 7 disabled; 135 action declarations**.
Inventory coverage is **89 enabled + 6 disabled + 3 internal = 98**; idle and the
default-disabled adjust_clothes explain the runtime/inventory difference.

[Catalog/cost audit](catalog-audit-4.md) records every row, first introduction of
shared content, actual scene/test locations and inventory coverage.
[Asset audit](asset-audit-4.json) preserves every full action declaration, exact
table line, source text, clip-setup prop/post/partner and explicit rejected
bindings. Its authoring_comparison records 72/72 unchanged old rows, 18 activated
rows, 25 new actions and the changed old handstand declaration.

Enabled means executable with the declared actual resources and conditions.
It does not mean all 90 rows were selected in the mixed scene or that animation
contact is accepted. All support families have deterministic execution evidence.

## One support controller, with content profiles

The new support_use template uses **one** device/role ledger and controller:
prepare → atomic attach → enter → motion → release. Cabin sealing/parked occupancy
and route obstructions are facts in this lifecycle. Motion is a sampled route,
declared track or fixed contact; it never dispatches on a behavior row name.

| Shared class | Different behaviors actually exercised | Data / same-code evidence |
|---|---|---|
| Human drives an external object | push_cart, push_stroller, pull_suitcase | Ground contact owns body weight; declared driver supplies the current route and device contact. Final object position persists. `godot/npc/text_behavior/supports.gd:624` / `godot/tools/check_text_behavior_4.gd:90` |
| Carrier supports/moves a person | ride_bicycle, ride_scooter; enter_car, hail_taxi, exit_car | Same entry, route, slot and unloading; private car/taxi share passenger exit. Existing scooter source is seated motor scooter. `godot/tools/check_text_behavior_4.gd:157` |
| Mechanism owns a moving support path | swing_seated, slide_seated, play_seesaw | Same bounded track sampling. finish_track continues forward to a slide bottom before release. Seesaw needs two occupied roles; one wildcard row binds both sides, never two scored side rows. `godot/tools/check_text_behavior_4.gd:111` |
| Hanging / palm support | do_pullups, handstand | Same attachment and anchor-to-ground release for hanging/inverted poses. One pull-up cycle uses the identified once raise; a hold clip does not supply entry/exit. `godot/tools/check_text_behavior_4.gd:133` |
| Shared human weight | assist_person, accept_assistance, help_fallen | load_from names the actual helper. Humans choose compatible current roles; lifting needs a selected subject response and explicit current consent. Lying and ground-seated recipient profiles share the same code and one behavior row. Refusal, revoked consent and either-side departure are checked. `godot/tools/check_text_behavior_4.gd:178` |
| Fixture contact / internal operation | hold_door; pass_door under stroll, run, push_cart and push_stroller | Same live aperture, operator and crosser context. Manual operation reuses the ordinary preparation/effect executor. A crosser alone opens nothing. `godot/tools/check_text_behavior_4.gd:272` |
| Persistent connection / compatible body work | phone_call and buy_stuff queue diversion | Same connection_work prepares the actual phone. Buying remains the purpose; service demand preempts the phone body while the connection survives. Standing/walking call fragments remain one phone purpose, without extra lottery rows. `godot/tools/check_text_behavior_4.gd:340` / `godot/tools/check_text_behavior_4.gd:360` |

The 16 support profiles describe geometry/roles/task differences; they are not
16 templates. The second lifting pose is another action/profile declaration.
It does not add a second helper behavior row. A lying profile rejects seated
input; its compatible seated profile handles that input through the same transfer.

### State ownership, allocation and interruption

- Static seat/ground facts remain compatible with the old system. body_state
  adapts them alongside the new bearing relationship. A person cannot have both
  an ordinary seat and a moving support. A cart pusher remains ground-supported;
  a bicycle rider is carrier-supported; a dependent person names the helper.
- Actual slots and body ownership enter the existing allocator. Multi-person
  requests use bearing:device:role and body:person with distinct support-group
  owners. This prevents two otherwise independent groups claiming one receiver.
  Captured purpose instances are rechecked before attachment; stale readiness
  cannot resurrect support. Evidence: `godot/npc/text_behavior/supports.gd:405` and
  `godot/tools/check_text_behavior_4.gd:238`.
- Entry/release paths start at actual positions and move at declared speeds.
  Carrier route points must be finite and grounded; unsupported airborne routes
  fail before movement. Carrier headings change at a bounded rate. Device origin,
  yaw, role offsets, destination, track, door and participants are content.
  Evidence: `godot/npc/text_behavior/supports.gd:377` / `godot/npc/text_behavior/supports.gd:27`.
- A higher-scoring purpose may win immediately. Actual support remains until
  unloading finishes; its new body work waits. Ground contacts release in place;
  elevated support returns through its anchor to ground; a slide continues to its
  bottom. Objects are not deleted or reset to their spawn position. Cancelled
  lifting preserves the recipient's initial floor pose and inability to self-rise.
  Evidence: `godot/npc/text_behavior/supports.gd:456` / `godot/npc/text_behavior/supports.gd:478`.
- A new fall while supported queues the real ground fact until unloading has
  reached ground. It cannot snap the body out of a carrier. This is a text-world
  safe unloading rule, not an unimplemented animation callback.
  Evidence: `godot/npc/text_behavior/supports.gd:261` / `godot/npc/text_behavior/activities.gd:247`.

### Taxi, manual doors and phone connections

The taxi is an actual text device with position, pickup route, response/stop,
door aperture and occupied passenger slot. A completed signal starts a response;
it does not count as acceptance. It must reach the pickup, stop and open before
entry. Cabin closure precedes the ride. Arrival ends the ride purpose while
actual seat occupancy survives until exit. exit_car only appears at a real stop
and works for both private car and taxi. Completed ride tasks cannot generate
zero-distance repeat trips. Evidence: `godot/npc/text_behavior/supports.gd:168` and
`godot/tools/check_text_behavior_4.gd:157`.

Manual passage retains the existing purpose/destination. Its operator first
frees real hands using common storage/surface preparation, then performs the
declared unbound fixture action. Aperture follows its progress. Interruption
leaves the current position/angle and the closer shuts the door; an old callback
cannot open it later. A coupled driver first stops/releases the contact, opens
the obstruction, then attaches and continues the current route. Preparation
timeouts restart for actual assembly, without expiring a productive long route.

Internal work retains the original destination claims. After it finishes, the
core re-previews current facts and re-grants work before creating a fresh body
and path. It does **not** restore an old raw body with obsolete permissions.
Evidence: `godot/npc/text_behavior/supports.gd:274` / `godot/npc/text_behavior/supports.gd:305` /
`godot/npc/text_behavior/system.gd:632`.

open_call requires an explicit current actor/endpoint/kind; it invents no remote
character or conversation. Body changes, stowing the phone, demo hold completion,
arrival and switching purposes do not hang up. end_call handles local hangup or
remote end; endpoint loss is also terminal and terminal results are idempotent.
Service queue diversion is an explicit shared service setting, requires a live
call and the actual tool, and yields to necessary service work. If phone_call
instead wins the global purpose comparison, the old service skip/cancel rules
still apply. Evidence: `godot/npc/text_behavior/supports.gd:103` / `godot/npc/text_behavior/supports.gd:117` /
`godot/npc/text_behavior/cooperation.gd:387`.

## Actual authoring and implementation cost

The rows were materialized together, not separately committed or timed. The
ledger records actual changed locations and reproducible remove/re-add checks;
it does not present platform implementation as free table authoring.

| Cost | Actual files / locations |
|---|---|
| Each of 18 activated rows | table.json rows entry and first-use action/profile/connection data; demo.json concrete actors/devices/current tasks; check_text_behavior_4.gd scenario. Every row has its own line in the catalog's concrete scene/verification table. No row-specific engine branch. |
| Shared support/connection platform | New supports.gd; system.gd dispatch/schema/update hooks, bearing/body occupancy, safe new-purpose gating, operation effects and exact path completion. |
| Existing mechanism integration | activities.gd defers supported falls and retains incapacitated subject rest while its event is live. cooperation.gd enables a declared queue connection diversion through the same connection/body primitive. These are real shared engine changes despite unchanged old row declarations. |
| Shared table content | 25 new actions; old handstand changes from standing/exercise-post to inverted/palm support. 16 support profiles, one connection definition, five support/door defaults; services.fruit.queue_connection is one existing shared definition change. Existing tags/coefficients are reused. |
| Independent demonstration | demo.gd loads devices/calls and renders text/position/door/occupancy, dispatches real remote endings. demo.json adds 19 people, 15 text devices, two calls and their endings. Existing fall gets can_rise=false and a longer visible episode for a real helper. All 24 prior personal coefficient maps remain unchanged. |
| Verification | New check_text_behavior_4.gd; main check invokes it and exercises scheduled scene events/support results. One obsolete batch-3 assertion changes from “help disabled” to “shared support template required.” Scanner exports devices/calls and checks actual progress/positive scene coverage. Python audit handles new definitions, changed old definitions and source evidence. |
| Documentation / evidence | This report, PROGRESS-4.md, README.md, execution-plan.md, actions.md, catalog-audit-4.md, asset-audit-4.json. Historical reports/audits 1–3 are preserved. |

No new personal tag was introduced: care expresses assistance preferences already
present in the demo, without obliging every existing actor to adopt a new help
coefficient. Each new actor declares all existing coefficients explicitly.
For further content with existing support/connection/role definitions, the runtime
addition is still one rows entry. A new profile or material declaration is an
explicit additional content cost; a new current scene task is also real content.

## Change-old-content probes

| Mutation actually run | Places/files changed for probe | Observed result |
|---|---|---|
| Existing handshake invite_range 1 → 3, actors 2 m apart | One defaults field, one table; zero row/engine edits | No invitation at 1 m; candidate at 3 m. |
| Existing walking speed .7 → 2.6 | One shared defaults field, one table; zero row edits | One second produces the corresponding real displacement. |
| Existing read_book standing → any, with hypothetical missing source | Two fields of one action: posture and clip:null; zero row edits | Existing seated reader remains seated only for that hypothetical unbound declaration. Production retains standing-only material. |
| New shared support_speed .4 → 1.6 | One defaults field, one table; zero behavior edits | Same dismount remains in progress at low speed and is grounded at high speed after .5 s. |
| Fixture yaw PI/2 | One scene/options value; zero row/template edits | Rotated cart entry/frame movement/release still reaches its real goal; pusher weight stays on ground. |
| Old stall provider/origin/yaw/minimal service probes | Existing batch-2 content probes rerun unchanged | Complete real finite transactions still pass, including a minimal provider and non-weighing variant. |

The first five are in `godot/tools/check_text_behavior_4.gd:383`; existing stall probes are in
`godot/tools/check_text_behavior_2.gd` (configurable_stalls). They are temporary
in-memory mutations, restored by isolated fixtures. The material posture probe
does not authorize a seated reading clip. The baseline audit proves all 72 old
enabled row dictionaries are unchanged; it does not claim their common executor
was unchanged.

## Observed failures and general repairs

These are observations made during this batch. Quoted check outputs below are
retained here after temporary logs/frame dumps are deleted. Regression locations
point to final checks; they are not claims that a failing implementation remains.

| Observation / recorded output | General repair and persistent evidence |
|---|---|
| Initial targeted run: `BATCH4_CASES 418 FAILURES 9`; `mechanism safely returns to ground: slide_seated` and interrupted slide unload failed. Finish-track release kept treating an already-finished track as unfinished. | Record actual track completion before beginning release; one finish-track policy for declared forward-only mechanisms. `godot/npc/text_behavior/supports.gd:456` / `godot/tools/check_text_behavior_4.gd:133`. |
| Car/taxi exit attempts could interrupt boarding/ride, then re-enter; `same exit action works for private car and taxi` failed. | Exit candidate needs a real parked carrier; finished route task is consumed; unloading commits the current exit instance. `godot/npc/text_behavior/supports.gd:168` / `godot/tools/check_text_behavior_4.gd:157`. |
| Sampled walking arrival jumped from z=.068333 to 0 in one update, beyond its speed bound; initial maximum sampled step .08 m. | Complete movement only when sampled path distance actually reaches the end, rather than snapping across arrival tolerance. New maximum is .05333376 m (the declared run step). `godot/npc/text_behavior/system.gd:639` / `godot/tools/check_text_behavior_4.gd:22`. |
| First 60-second scan returned SCAN_OK, but exported states showed Ground_Lift=0 and Fallen idle for 52.9667 s: the person fell after walking away from the fixed lift origin. | Live participant anchors the support frame; incapacitated subject rest stays current while the event lives. Added moving-fall/late-helper regression. Scanner now checks actual configured mechanism use as well as lack of errors. `godot/npc/text_behavior/supports.gd:348` / `godot/npc/text_behavior/activities.gd:372` / `godot/tools/check_text_behavior_4.gd:178`. |
| Cancelled lift initially restored `to` instead of the initial `from` pose; cancellation check failed. | Separate successful transfer from interrupted unloading; actual recipient consent can also be revoked mid-support. `godot/npc/text_behavior/supports.gd:478` / `godot/tools/check_text_behavior_4.gd:178`. |
| First long scans ended with `unknown support task actor: Cart_User` after the actor had legitimately left. The reused live-only lookup confused a retained known body record with an unknown ID. | Support owns stable person records; active eligibility separately checks gone. Unknown IDs still fail; departing actors do not invalidate persistent stopped-object facts. `godot/npc/text_behavior/supports.gd:19` / `godot/npc/text_behavior/supports.gd:129`. |
| Source/behavior review found proximity-based opening implemented a sensor door rather than the inventory's manual operation. The hold source explicitly needs an already open door. | Declared manual operation goes through real hand preparation and common effects; holding waits for fully open aperture and real followers. No forced follower wait to make a demo hold occur. Blocked-hand/stale-opening cases are in `godot/tools/check_text_behavior_4.gd:272`. |
| Manual-operation scan failed at 45.35 s: `two bodies occupy exercise_space`. Opening work released the destination claim and restored a previously granted walking body. | Keep original resource claims during internal work. Re-preview/re-grant fresh body work afterward, never restore raw body state. A two-actor exclusive-destination regression reproduces the conflict boundary. `godot/npc/text_behavior/supports.gd:274` / `godot/tools/check_text_behavior_4.gd:328`. |
| A 47-second coupled-route regression failed when preparation reused the purpose's original age after a late door stop. | Assembly/operation gets its own fresh preparation timestamp; productive route life has no universal 24-second cap. `godot/npc/text_behavior/supports.gd:274` / `godot/tools/check_text_behavior_4.gd:327`. |

Body-group owner separation also came from inspecting the allocator contract:
same-person resource ownership alone would allow two independent groups to share
that claim. This was repaired with distinct support-group owners and checked by
two simultaneous helper offers; no final run observed two active support owners.
Evidence: `godot/npc/text_behavior/supports.gd:427` / `godot/tools/check_text_behavior_4.gd:250`.

## Still disabled / TODO

The seven previously excluded row declarations are unchanged in the baseline dictionary comparison:

| Row | Reason still recorded in table |
|---|---|
| wait_person | No scene-provided current waiting person/place; do not invent schedules or remembered appointments. |
| buy_newspaper | Configured payment/checkout and once-only collection still undefined; taking a paper is not a purchase. |
| use_vending | Selection/payment/output facts still undefined; a timer must not fabricate stock. |
| distribute_flyer | Finite stack and separate sheet in two hands exceed the one-held-object inventory. |
| receive_flyer | Supplying process and separate sheet representation still undefined. |
| pet_dog | No animal approach/contact permission and departure interface. |
| adjust_clothes | Inventory-default disabled; the batch does not override that switch. |

None of the 17 requested support rows remains disabled. Further pose/content TODO:
prone lifting/recovery is undefined because the existing external fall contract
contains lying/ground_seated, not prone. The forward trip_fall source cannot be
substituted for supine lying. Evidence: table external_facts and the source facts
preserved in asset-audit-4.json. No unsupported prone candidate is advertised.

## Material requests / per-action audit

All **135** declarations were audited, including unchanged actions. Every enabled
row is covered by the catalog and source traversal; shared conditional bindings
remain explicit. Text semantics do not expand an existing clip's allowed poses
or hands. Material requests are synchronized in [actions.md](actions.md).

| Request / restriction | Current handling |
|---|---|
| Support preparation, attachment and safe unloading | support_prepare/latch/release/wait remain unbound; need carrier mounting/dismount, suspension/palm entry/lowering, mechanical entry/exit and shared contact release variants. |
| Passenger ride/entry/exit | car_ride and support transitions are unbound. Existing car_enter/car_exit source describes driver-seat work; rejected passenger substitutions are preserved in asset audit. |
| Wheeled suitcase gait | Same-name source describes carrying a heavy shopping bag. pull_suitcase remains clip:null. |
| Shared lifting | help_up, helped_up and helped_up_ground_seated are missing; all three remain unbound with their actual separate pose constraints. |
| Manual route fixture operation | open_fixture remains unbound. Existing push_door/pull_door require provider-specific side/handle/post contact; an arbitrary text gate point does not establish that correspondence. |
| Turns / stopped shared contact / mechanism synchronization | Existing straight pushing/paired gaits and seated device sources are identified; their presence does not supply turning, attachment/release or synchronized fixture playback. |
| Phone variants | phone_call is standing/right-hand phone, walk_phone_call walking/phone. No seated call source is claimed. |
| Existing constraints retained | read_book standing-only; bench sit/slouch empty-hand; held generic gaits/waits conditional null; open/closed book/umbrella distinctions and all batch-3 source conflicts remain. |

No missing clip blocks a defined text transfer/track. A source mismatch stays
unbound rather than playing a similarly named animation.

## Final verification

Commands ran only the independent scene/check scripts, with Godot 4.7.2 headless:

```text
TEXT_BEHAVIOR_OK (1271 assertions)
TEXT_BEHAVIOR_SUPPORT_METRICS {"max_body_step":0.0533337593078613}
TEXT_BEHAVIOR_SCAN_OK
TEXT_BEHAVIOR_AUDIT_OK {"actions": 135, "enabled": 90, "inventory": 98, "rows": 97}
```

- Baseline before implementation: TEXT_BEHAVIOR_OK (693 assertions).
- Final main check includes all four batches and **300 simulated seconds** of
  real WalkGrid with scheduled events, old handshake/checkout/delivery assertions,
  configured support completion/portal use and explicit call endings.
- Mixed scene scan: **43 people / 14400 frames /
  240.0 seconds / 4359 trace events**.
  Maximum no-purpose gap **0.4833 s**. Live calls at end: 0.
  Live encounters at end: 0 (an active selected encounter
  is not itself a deadlock).
- Independent review of all exported frames found **zero airborne carrier-origin
  frames** and a maximum person step of **0.05333710 m** (run; float precision).
  Buyer_B used phone_call under buy_stuff at **2.5167 s**, then choose_item while
  the same connection remained live at **20.5167 s**. These are frame observations,
  separate from the deterministic support-step metric above.
- Support trips: `{"Assistance": 1, "Bar": 3, "Bicycle": 1, "Car": 1, "Cart": 1, "Case": 1, "Door": 0, "Ground_Lift": 1, "Palm_Space": 2, "Scooter": 1, "Seesaw": 1, "Slide": 2, "Stroller": 1, "Swing": 1, "Taxi": 1}`.
  Portal openings: `{"Door": 20}`.
  Door holding may legitimately remain unused in mixed traffic; deterministic
  slow-follower cases execute it. Portal operation is separately required, so
  the scanner neither invents a hold success nor lets an unused lift pass.
- Ten explicit check-only scripts pass: four executor modules, demo.gd, main
  check and batch checks 2/3/4, scanner. No parse or script errors remain.
- Every enabled row's independent remove/re-add check passes. Source audit and
  actual baseline comparison confirm 72/72 unchanged prior row declarations and
  24/24 unchanged existing personal coefficient maps.

The Windows environment prints `Failed to read the root certificate store` at
headless startup, including the unchanged baseline. All final commands above
exit 0; that environment warning is separate from behavior assertions.

Re-run from repository root:

```powershell
& 'D:/Godot/Godot_v4.7.2-stable_win64_console.exe' --headless --path godot -s res://tools/check_text_behavior.gd
& 'D:/Godot/Godot_v4.7.2-stable_win64_console.exe' --headless --path godot -s res://tools/scan_text_behavior.gd -- --seconds=240
python godot/tools/audit_text_behavior.py
```

## Not excluded by these checks

These are bounded integration gaps, separated from the observed failures above:

1. Actual swept body/device clearance and force/balance/contact are not established.
   Evidence: `godot/npc/text_behavior/supports.gd:377` validates a grounded navigation centreline;
   `godot/npc/text_behavior/supports.gd:447` builds declared entry/release segments. The scene
   deliberately renders text markers, without physical prop collision geometry.
   Absence of a final text-state collision does not establish future full-body clearance.
2. Material/fixture synchronization and final contact coordinates are not accepted.
   Evidence: action audit records source bindings/metadata, while
   `godot/npc/text_behavior/supports.gd:502` samples text profiles. Device points are configurable
   text frame/root positions, not claims that a real model's seat/handle/animation
   root have already been aligned. A later provider adapter must supply those
   actual coordinates; the same lifecycle need not be rewritten per behavior.
3. Final picture/head-box layout and animation continuity have not been visually
   accepted. Evidence: `godot/tools/scan_text_behavior.gd:19` checks sampled text/state and reports
   stable cycles/stalls; demo.gd uses fixed stick symbols and text device labels.
   No game window, rendered clip review or physical scene acceptance was performed.
