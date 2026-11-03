# Text NPC behavior — implemented execution contract

Updated 2026-10-30 for batch5. Data: `godot/npc/text_behavior/table.json`. Execution: `system.gd`, `cooperation.gd`, `activities.gd`, `supports.gd`. This is the independent text executor; it does not modify the animated street selector. [Report5](impl-report-5.md) records results and boundaries; report4 remains historical.

## 1. Ordinary authoring cost

Existing declarations make these complete rows:

```json
"idle": {"base":1.2,"action":"stand_idle"},
"phone_browse": {"base":2,"use":"use_tool","tool":"phone","action":"phone_browse"},
"read_notice": {"base":2.5,"use":"go_use","target":"post:notice","action":"read_notice"}
```

An ordinary addition changes one rows entry. A new action adds one shared actions declaration; a new interaction also supplies a reusable role/layout definition. These are real costs, not information inferred from names. [The complete ledger](catalog-audit-4.md) records each row, first introduction of shared content and the fourth-batch scene/check cost. Checks remove/re-add every enabled row and compare all remaining data. Shared engine development is separately charged in the report. All 72 previously enabled row declarations remain unchanged in batch 4.

Simple rows do not supply lifetimes, versions, callbacks, result writers or exit clips. Optional new preference tags require explicit personal coefficients; missing coefficients are errors, not an implicit 1. Rows without tags require no person changes. A circumstance base map takes the highest matching score, not a sum. Conditions/evaluators are registered by the template; typos fail initialization.

Disabled content can omit unfinished fields but explains what is missing. Malformed enabled declarations fail. A defined action with clip:null executes text semantics. Explicit service packing TODO ends that attempt, displays the reason, commits no purchase and uses shared cooldown; it is distinct from a missing clip.

## 2. Action, hand and support contract

Actions declare label, once/hold/move, posture and required hand/tool/post/effect fields. Shared once_demo/hold_demo are prototype execution spans, not measured material durations or a universal purpose deadline. Moving work follows actual paths and arrival; optional action speed overrides shared speed. Run/jog demo speeds are distinct and rounded from exported root travel; real playback pacing remains separate.

Posture is an actual input constraint: standing, seat-supported, ground-seated, lying, or ground for self-rise. Moving supports additionally distinguish supported_seated, hanging and inverted. any means upright standing/seat-supported. all is used only for explicitly unbound item preparations and controlled support entry/wait/unload across the profile's actual poses. Standing material does not acquire seated permission: read_book remains standing-only; seated people can select it and use shared rising first.

Hands require empty, a specific tool, or an actually held object. Legacy `held` is the right slot; `offhand` is an independent left slot, accessed with hand_item/set_hand. Explicit actions.hands declares each hand. Old bound/empty/tool actions require the other hand empty; unbound generic standing/movement can retain actual items. A single two-handed object still has one location. Open/closed books and umbrellas retain distinct contracts. Finite containers own actual child IDs; drawing transfers an existing child to a free hand. Shared preparation stows/puts/takes each required hand, using real storage/surface capacity. No implicit deletion or cross-hand copy.

clip identifies a source only under its declaration. bindings restricts generic standing/walking/waits, head-only observation and bench transitions to an existing empty-hand source; held variants return null. system.binding() resolves this contract. Text execution does not authorize playing empty-hand material with a held object. Source-name conflicts, props, posture and partner layouts are recorded in [actions.md](actions.md) and [asset-audit-4.json](asset-audit-4.json).

binding(action,right_kind,left_kind) returns null for the new two-object states;
no such clip has been verified. New batch5 semantic actions remain unbound.
The result-object newspaper/cup candidates and opposite-hand flyer setup are
recorded in asset-audit-5.json rather than silently assigned.

### One finite preparation path

All templates, including single-action direct, use action_preview:

1. Establish required support using declared transitions only. Seat rising needs clearance; ground rising needs can_rise.
2. Free hands when required: actual accepting storage with capacity, otherwise a reachable surface with capacity. No method means unavailable, without planning search.
3. Take the required real tool from declared storage only if not already held.
4. Follow the actual target path, verify arrival, sit/enter ground pose only when required, then execute.

Effects happen at completion, not preview. Interruption preserves the actual pre/post-commit facts. seats maps each seat kind to enter/leave actions: bench clips are not used for chess stools, steps or cafe seats. ground_poses supplies ground entries; ground self-rise never uses chair stand_up. Unbound ground item preparation has explicit text semantics.

The direct actions pool is a deliberate exception: one scored candidate/one jitter draw, uniformly choosing an action directly legal now, without preparation. The chosen action stays fixed for that instance. Pools accept only ordinary in-place once actions, without target/effect work; action and actions are mutually exclusive. Distinct purposes such as upright sitting/slouching stay separate rows.

## 3. Templates and state owners

| Template | Content supplies | Shared execution / examples |
|---|---|---|
| direct | Action or constrained pool; optional target/when | Shared preparation, once/hold/move; idle, fidget, run/jog |
| use_tool | Tool and action | Already held or real stored tool; read_book, drink, selfie |
| go_use | Post kind, action, optional matching tool | Claim, prepare, approach, use; seats, leaning, reading, cleaning |
| pair_once | Pair definition; optional asymmetric role | Invitation, one layout, atomic readiness/effect; handshake, specified giving/receiving |
| service_customer/vendor | Shared service definition | Queue, chosen product, parallel preparation, checkout, delivery, paid/not-collected |
| conversation | Encounter kind and role | Sustained turns, asymmetric speaking/listening, open-group joins, interruption; chat, whisper, argue, interview/answer |
| object_activity | Activity kind and role | Object owns members, slots and turns; play_chess/watch_chess |
| move_together | Journey kind and role | Current participants/destination, independent willingness, shared progress/cancellation; adult/child and human/dog |
| event_response | Response definition | Live events and subject/witness posture; startle, protection, balance, rest, watching |
| sequence | Short steps and optional finite item input | Same actions/preparation; parcel, cash, pickup, mail, notice, laundry, cafe, payphone |
| current_task | Profile plus scene-provided actor/subject/place | Same preparation/approach/action executor; animal permission/departure and actual awaited-person arrival, without schedules or relationships |
| observe | Person/focus source and in-place action | Track live facing without resetting progress; greeting, photo, filming |
| transport | Held-kind-to-action map and destination source | One scored row with item-conditioned movement; carrying/umbrella travel |
| support_use | Device profile, role and use/board/summon/exit operation | One occupancy/entry/motion/unload controller; pushing, riding, track mechanisms, suspension/palms, shared weight and door contact |
| connection | Explicit connection kind and tool/body actions | Connection outlives body work; standing/walking phone fragments never invent or terminate a call |

No template dispatches on a behavior row name. Missing scene resources yield no candidate; malformed declarations fail instead of partially initializing.

### Sustained conversation and invitations

An initiator need not pre-check acceptance. Reply-only interview roles require a real inquiry. Roles define speaking/listening actions and compatible roles. Matching creates one live encounter with actual layout points; all member preparations/positions go through the common allocator. Speaking once advances the turn, not the whole purpose. Listening is interruptible hold work. An open group admits compatible members up to its declared slots; two can continue after a third leaves.

The shared activity demo span bounds a prototype episode; invite_wait bounds unanswered offers and activity_wait bounds failed assembly. Anyone can switch before those spans. Membership follows captured purpose instances, not delayed acceptance messages or stored relationships.

Before scores are read, conflicting offers need a stable invited circumstance. The core reads outgoing proposals, protects already matched people and greedily exposes nonconflicting offers by earliest proposal then seeded stable identity. This prevents reciprocal cross-kind swaps and longer directed cycles. Only a circumstance is exposed; receivers still compare every purpose. It grants no body/resource/result and does not seek an optimal global matching.

### Object-owned activity

A chess table owns role slots, members, current turn, thinking progress and committed move count. There is no initiator-owned game. One player waits within the assembly bound; two actually seated players activate it. The current player thinks then moves; the object advances once. Watchers require active players. A departing player stops two-player turns and invalidates watching.

Scene providers supply marker names: the demo reads actual park_chess_table markers instead of copying stool/watch positions into engine code. This ledger supplies participation/turn facts, not legal chess moves, captures, take-backs or invented wins. Those actions need corresponding current game facts.

### Together moving

Links declare only the current actors, roles and destination, not relationships. Humans independently choose compatible rows; an animal adapter provides actual position/willingness. Everyone prepares before a shared start. Paths use the supplied planner and one normalized progress; initial/ongoing separation must remain within the journey contract. Actual arrival succeeds once. Departure/lost willingness stops dependent movement at actual positions.

Adult and child actions remain separate; the missing child clip stays null. The dog adapter is text state, not fabricated humanoid dog actions or modified animal playback. Assisted shared body support now uses support_use, rather than pretending paired travel alone bears a load.

### Visible events and finite item processes

Events have kind, live position/subject, radius, expiry and optional salience. They directly supply candidates rather than disguised object/person targets or long-term memory. One watch_event row uses else/salient scores, not duplicate rows.

External fall immediately interrupts obsolete body work, clears static seat support and establishes lying/ground-seated state. If a moving/support coupling still owns the body, the new ground fact commits after continuous unloading. Imbalance sets instability before selection. Subject recovery and witness startle/watch/protection compete normally. Balance recovery clears instability on commit. Rest uses actual ground posture, then self-rise only when allowed. Incapacitated subject rest remains selected while its event lives, allowing a late helper to arrive. Shared lifting additionally needs the selected subject response and explicit current willingness; nobody is assigned an invented desire.

Sequences use actual surface items. Private parcel/cash inputs must name their owner. No stock, balance, logistics account or payment is generated. Collect moves the chosen item to hand once; deposit moves a held item onto its receiving surface once. Capacity, reach, actual item and current instance are rechecked at commit. Cafe use requires a real cup on the real surface and leaves it there. Whole payphone use does not claim a persistent personal phone connection.

## 4. Selection and the common allocator

Candidate identity is row plus actual target. Discoveries deduplicate; different targets remain comparable. Clip/posture variants do not multiply rows. Score is base × explicit coefficients × half/(half+d); self distance factor is 1. sight limits discovery, not continuous score for a still-valid bound target. Current score follows facts, without time decay.

When idle, draw jitter once per row per choice, shared across targets. A current instance retains its jitter; challengers have none. Zero scores/coefficients remain unavailable. Fallback keeps cached scores, without a new lottery.

Each logical update applies external facts/completed effects, rebuilds actual occupancy, then previews choices/internal/group work read-only. All new positions, roles, items and surfaces enter _grant. Sort by effective purpose score (minimum member score for groups), then seeded stable identity. Check every resource before granting any group member; geometrically coincident dynamic/ordinary points conflict despite different IDs.

A failed first choice gets at most one cached fallback, still above its valid current threshold and through the same allocator. There is no recursive third try, asynchronous approval pipeline or optimal matching. Commit final choices before checking captured group instances and actual readiness. Advance never grabs a new internal resource locally.

Layout cleanup belongs to the core. Providers report live references; actual bodies/support and reservations keep positions alive. One template cannot delete another template's temporary points.

## 5. Progress, effects, interruption and persistence

Work identity includes the semantic step/turn/item. Reconsidering unchanged work preserves progress. Moving focus changes facing without restarting a photo/film action. Next already-granted work can start at zero extra elapsed time in that update, avoiding a fictitious one-frame UI preparation flash.

Effects recheck current body instance, actual requirements and not-yet-committed state, then change object/support/result synchronously. Coordinated effects also capture each purpose instance. Obsolete callbacks cannot revive a handshake, transfer or purchase. A successful transfer remains successful even if the item is immediately given away.

Completion/blockage uses shared again per row+target. Another purpose interrupts immediately, without pretending success or imposing an exit clip. Failed matched assembly also cools down. Actual held objects, seat support and standing use-point occupancy persist until changed by work/movement.

There is no universal purpose recovery. Encounters/journeys keep current participation; objects own role/turn facts; events expire. Services separately retain queue place while actually inside the waiting area, and paid/not-collected until delivery or buyer disappearance. Device occupancy/unloading and explicit call connections have their own lifetimes; neither restores an abandoned purpose.

Shared checkout writes paid; shared delivery removes it. Interrupted pre-checkout attempts start fresh. A returning paid buyer queues and only collects. Seller/buyer preparation can proceed independently; necessary work interrupts vendor diversion. Leaving the queue area toward the called counter is not cancellation: actual selected purchase/service governs cancellation. Packing TODO happens before payment.

## 6. Verification and boundaries

check_text_behavior.gd runs all five batches' deterministic cases and 300 seconds with real WalkGrid and scheduled scene events. New cases cover support phase interruptions, actual load/driver owners, contended body/slot grants, late/moving fall locations, recipient refusal/revocation, carrier persistence, taxi response and private/taxi exit, shared portal use and explicit call lifetime. Earlier conversation, service, item, invitation, source, re-addition and scene assertions continue. Change probes mutate old invitation distance, walking speed and book posture, plus support speed/fixture yaw; old service provider/origin/yaw probes still execute full transactions.

scan_text_behavior.gd can export every frame. It detects stable text cycles, stationary walking, bodyless selected work and unproductive waits; it distinguishes presentation gaps, different target attempts and actual service progress. The report records observed failures and final results, not just a scanner verdict.

audit_text_behavior.py covers all inventory entries/actions, source/export availability, props, posts, seated/lying contracts and explicit held-binding gaps. Its ledger/source evidence is a declaration audit, not a renderer.

Only inventory-default adjust_clothes stays disabled. The six previous TODO rows
are enabled through current tasks, finite checkout sequences and finite two-hand
pair supply. Missing clips are separately recorded in actions.md, not treated as
undefined behavior semantics. All 90 prior enabled rows and existing personal
coefficients remain unchanged.

These checks establish text/state execution, logical lifecycle, authoring separation and sampled scene behavior. They do not establish animation contact, handoff frames, rooted motion, child hand placement, obstacle-safe paired contact, machinery synchronization, crowd collision avoidance or final picture acceptance. Those need integration evidence, not more text assertions.

## 7. Device support, driving and safe unloading

supports defines role constraints, grounded entry/release points, an attachment
anchor, optional track, minimum participants, motion owner and finite demo span.
Scene devices supply actual origin/yaw, current actor task, destination, pickup and
willingness. These are current facts, without relationships, schedules or a planner.
The same route/track/fixed controller serves every profile. A role with contact
stays ground-supported; load_from names the actual helper. driver distinguishes
human-driven objects from external carriers. body_state also adapts existing
static seats/ground, preserving old authoring and actual seat occupancy.

Claims use the existing _grant: bearing:device:role plus body:person, with a distinct
support-group owner for atomic multi-body requests. A receiver cannot belong to
two simultaneously accepted groups. Start rechecks captured purpose instances;
stale requests cannot create occupancy. A role wildcard binds an available role
inside one candidate, so seesaw sides do not create duplicate scored rows.

Common standing preparation rises, frees hands and approaches first. The entry
path then attaches bodies continuously. During support motion the controller
owns their body requests. Carrier origins remain grounded; offsets rotate with a
bounded heading change. Main source actions run only in their declared support
pose after entry. Human-driven movement and external carrier movement use the
same sampled route; role/action/driver data supplies their different contracts.

A purpose can change immediately. Actual occupancy persists until the release
path finishes, and the new ordinary action waits for that fact. Ground contacts
stop/release in place; suspended/seated supports return via their attachment
anchor and then ground. A slide finishes forward to its bottom before unloading.
Shared loads stop together; an interrupted lift restores its starting ground
pose and cannot claim recovery. Recipient willingness can be revoked. A new fall
fact during coupling is deferred until unloading, without teleporting the body.

Boarding requires a scene-provided current ride task. A responsive carrier must
actually follow a pickup route and stop after the signal; waving alone is not
acceptance. Cabin doors open for entry, close before motion and reopen for parked
exit or interrupted unloading. The arrival completes the ride purpose while the
actual seat remains occupied. exit_car is available at a real stop and uses the
same unload code for private car and taxi. Completed route tasks do not repeat
zero-distance trips. No separate enter_car candidate is created for hailing.

A portal is live aperture/crosser/holder state on a device. pass_door is internal
work, retaining the existing purpose, destination and process phase.
Closed manual fixtures require a real empty-handed operator: the same allocator,
preparation and effect executor performs stow/put and the declared operation.
Presence alone opens nothing. Aperture follows actual operation progress;
interruption preserves the actual angle and a closer can return it to closed.
Internal work keeps the original destination/resource claims. After opening,
actual facts are previewed again through the common allocator before a fresh body
and path are created. No raw saved body or obsolete grant is restored.
Human-driven coupled routes first stop/release, operate
the obstruction, then reattach and continue their current task. Their assembly
timeout restarts for this preparation; it is not a cap on productive route life.
hold_door starts only with an actually open door and a real follower's passage;
after that context disappears the hold ends and the closer shuts the door.
Layout/yaw/width/depth/action are content, without per-door code branches.

## 8. Explicit connection lifetime

open_call requires a real actor, endpoint, connection kind and available tool
semantics. It creates no memory or autonomous conversational partner. Calls are
scene/current connection facts. phone_call is a scored purpose only while that
connection is live and the actual phone can be prepared. Standing material is not
advertised as seated. A walking fragment needs this purpose's declared current
destination; an abandoned purpose supplies no hidden route.

Changing a body fragment, reaching a destination, completing a demo hold,
switching purpose or stowing the phone does not terminate the connection.
end_call is the explicit local hangup/remote end; loss of the actual endpoint also
ends it. Terminal results are idempotent. The scene has an explicit remote-end
event. The same connection_work primitive also supplies an explicitly configured
service queue diversion (services.*.queue_connection), so the capability is
verified under both phone_call and buy_stuff. It requires an existing live call
and a real phone; it never invents one. Buying stays the current purpose and
being called for service immediately replaces the phone body with required
service work, without hanging up. If phone_call itself wins the global purpose
comparison, the service's existing skip/cancellation rule applies; no automatic
body overlay or arbitrary multitasking is introduced into other waits.

## 9. Current tasks, finite checkout and independent hands

current_tasks profiles declare an action, subject kind, actual offset/radius and
completion fact. add_task supplies the current actor/subject/place. Animal
contact requires separate approach/contact permission, willingness and a stopped
unchanged anchor; departure or revocation stops approach/contact. A wait task
uses the declared person and place; actual arrival ends it. No appointment is
remembered or manufactured. Both use the existing work/action_preview, walking,
resource allocator, body execution and interruption. They own no special body
state machine. Subject claims prevent overlapping contact ownership.

processes.*.transaction extends the existing sequence with select/pay/release/
collect operations. add_checkout supplies real stock/output surfaces, product
kind, phone authorization and price. Newspaper and cup vending use the same
code. The demo's phone terminal is an explicit scenario choice, not a universal
newsstand/payment rule. Credits are finite current scene authorization units,
not an inferred balance or full economy. Each configured buyer has one current
purchase episode in this provider; its durable order prevents duplicate collect.

Selection chooses an existing item. Payment debits once and records that item.
The paid provider advances output independently of the buyer's body or purpose.
Its declared prototype response span uses hold_demo; this is not a measured
material duration. Output moves existing stock to the declared output only if
working and capacity allows; no timer creates stock. Collection requires that buyer's paid/released
order and actual output item. Interrupted unpaid selection can be discarded;
paid/not-collected remains owned by the checkout until resumed. Completed
receipts cannot issue another object. No refund is invented for a departed
buyer. Stock/output surfaces reject ordinary put-down, and internal stock
rejects human take; those are generic surface access fields.

Pair supply reuses pair_once invitations/layout/atomic joint transfer. An
explicit current intent names a real contained item and source container. The
ordinary draw action moves that child into the other hand. Joint execution
starts only with the actual offered item and compatible receiver preparation.
Refusal/interruption retains the stack and any drawn sheet. Stale joint bodies
cannot commit or cancel a different newly selected purpose instance. Left/right
requirements, containers and surface access are shared structures, not flyer
row branches. No empty-hand material is licensed for these loaded states.
