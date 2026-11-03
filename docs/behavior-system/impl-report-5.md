# Text NPC behavior — batch 5

2026-10-30. The six disabled TODO behaviors are implemented and enabled in the
independent text executor. `adjust_clothes` remains disabled. All **90 previous
enabled rows, 135 previous actions and 43 personal coefficient maps are identical**
to the frozen batch-4 baseline. There are 97 rows: **96 enabled, 1 disabled**,
and 147 action declarations. Inventory coverage is 95 enabled + 3 internal = 98.

Hsinlung's requirements are logical behavior, inexpensive ordinary additions,
shared structures and interruption at every stage. The concrete scene providers,
phone-terminal scenario and structures below are this implementation's choices;
they are not attributed to him. No main scene, physical prop, animation,
clip-setup, playback, chess-anim, repository memory.md or CLAUDE.md was changed.
No commit, push, software installation or local Claude review was performed.

## What now runs

| Row | Live facts and common execution | Actual scene result |
|---|---|---|
| pet_dog | Current scene actor/animal task; separate approach/contact permission, willingness and stationary animal anchor. Existing prepare/walk/action executor; departure or revoked permission stops it. | Dog_Petter starts contact at 0.983s and completes at 2.983s. |
| wait_person | Current named person and actual place; common approach/standing wait, ending on actual arrival. No appointment memory, schedule or invented greeter. | Current_Waiter waits from 1.033s; the expected person walks to the meeting point; task completes at 3.183s. |
| buy_newspaper | Existing sequence with explicit finite stock selection, authorized payment, release and collect. Shared checkout ledger survives interruption after payment. | Select 3.033s, pay 7.067s, release 11.083s, collect one finite_paper at 15.100s; credit 1→0. |
| use_vending | Same sequence/checkout code; an available machine with existing cup stock and actual output capacity. Release moves that existing item; elapsed time creates no stock. | Same four milestones, one real cup collected at 15.100s, credit 1→0. |
| distribute_flyer | Existing pair_once invitation/layout/atomic transfer, with optional finite-container draw preparation. Left hand holds the stack; right hand holds one distinct real sheet. | Draw starts 2.517s; offer starts 4.533s; transfer commits at 6.550s. One of two contained sheets leaves the stack. |
| receive_flyer | Independently selected reply to the current offer. Shared preparation frees actual receiving hands; current-instance joint commit transfers ownership once. | Receiver initially greets, then accepts this offer; the same transfer completes at 6.550s. No forced acceptance. |

Times are **text simulation trace observations**, not animation timings or visual
acceptance. The scene has 50 people, the prior 15 support devices, two checkout
providers and a separate contact dog. It uses the real WalkGrid and the same
selector/allocator/executor as the previous test scene.

## Shared implementation and authoring cost

- `system.gd`: `held` remains the right slot; `offhand` is the independent left
  slot. Explicit action hand requirements use the same finite preparation,
  real storage/surface capacity and effects. A two-handed single object still
  has one location. Generic containers own actual child item IDs; draw moves an
  existing child into a free hand. Location/cycle validation covers containers.
  Surface access distinguishes internal stock from an ordinary put/take shelf.
- `activities.gd`: current-task facts adapt to existing work/action_preview.
  Both animal contact and waiting use this adapter. Existing sequence execution
  gains checkout operations; two profiles use the same durable item/payment/
  output ledger. There is no behavior-name dispatch or extra body controller.
- `cooperation.gd`: optional finite supply in the existing pair definition.
  Existing readiness, layout, resource grants and joint commit remain the path.
  Captured purpose instances guard cancellation as well as commit.
- `table.json`: six row replacements, twelve shared action declarations, two
  current-task profiles, two transaction profiles, one pair supply definition
  and one item kind. All new preference tags reuse existing coefficient keys.
- `demo.gd` imports the generic current tasks, checkout providers, hand facts
  and transfer intents. `demo.json` supplies their actual current resources.
  Shared check integration, `check_text_behavior_5.gd`, scanner evidence and
  `audit_text_behavior.py` are additional implementation/verification work.

An ordinary future row using an existing profile/action changes one rows entry.
A new interaction supplies the shared profile and real scene resource, charged
explicitly. This batch changed three common executor files; their development
is not described as free one-line authoring. The per-row table/demo/check cost
and complete inventory/action audit are in [catalog-audit-5.md](catalog-audit-5.md).
No dedicated pet, waiter, newspaper, vending or flyer state machine was added.

The demo uses an explicitly configured unattended phone-payment news provider.
That is not a claim that every newsstand takes phone payment. Credits are finite
scene authorization units, not an invented bank balance/full economy. Each
configured buyer has one current purchase episode; the completed receipt blocks
duplicate collection. Paid/not-collected survives interruption and machine
unavailability. No refund is fabricated if its buyer leaves.

## Observed failures and corrections

The first dual-hand preparation implementation skipped phone storage before
collecting: traces reached selection/payment/output, then collect was blocked.
Collection and surface-take now retain their hand preparation requirements;
storage/put/take effects use the named actual hand. Every checkout phase can be
cut and resumed without a second debit, object creation or duplicate collection.

Code review found that cancelled old joint work ended whichever purpose was
currently selected. Cancellation now checks the captured instance, as commit
already did. The cut-offer test confirms the newly selected purpose survives,
the drawn sheet and remaining stack stay real, and the same sheet can resume.

Final review also found that the first checkout adapter made release depend on
completion of the buyer's waiting body. Output now advances on the paid provider,
independently of the person. The body only waits for the actual released item.
Tests make the buyer walk away on another purpose while the provider outputs
the existing paid stock, then return and collect once. This adds no scored row
or new body execution path; the existing activity advance owns the object fact.

The first scene-coverage assertion looked only for start trace records, but the
scene selects its initial purposes in _ready before the checker enables tracing.
Coverage now includes that actual initial snapshot; later starts remain traced.
The scanner also records per-frame purpose counts, action traces and final
committed facts. This correction changes observation, not behavior scores.

## Material audit / still unbound

All twelve new actions have clip:null. Missing material does not disable these
defined behaviors. [asset-audit-5.json](asset-audit-5.json) preserves every full
action declaration and source/setup evidence, including rejected candidates.
The six rows were checked against behaviors.md, actions.md and clip-setup:

| Behavior source | Actual declaration and source check |
|---|---|
| behaviors.md:282 pet_dog process | Standing pet_contact; missing humanoid contact clip. The dog is an animal adapter, not an assigned humanoid action. |
| behaviors.md:193 wait_person process | Standing wait_current_person at the scene-provided person/place; no seated material permission. |
| behaviors.md:224 buy_newspaper process | Checkout precedes one take_newspaper. Existing buy_newspaper source describes only taking a folded paper. Setup has a right-hand result prop/show track, without a verified finite-result transfer frame. Remains unbound. |
| behaviors.md:225 use_vending process | Existing vending_collect source specifically retrieves a lidded coffee cup, so configured product is cup. It does not supply payment/output facts; setup lacks the resulting cup prop. Remains unbound. Counter-cash pay is not used for machine phone payment. |
| behaviors.md:277 distribute/receive_flyer process | One scored row per purpose. Draw is finite common preparation, not another behavior. Native distribute_flyer text says LEFT stack; current setup attaches it to RIGHT. The whole draw/offer/retract source cannot be borrowed as only the draw preparation. Receiver contact/shared handoff timing also remains unverified. |

See actions.md's batch-5 register for the exact missing clips:
animal contact, current waiting, phone-terminal selection/payment/output wait,
result-object newspaper/cup collection, loaded gait, stack hold/draw/offer and
paired acceptance. Empty-hand sources never acquire held-object permission;
standing stays standing. binding(action,right_kind,left_kind) returns null for
the new two-object states. No formal material or setup was changed.

## Verification

From repository root, all three batch-4 check commands pass on this batch:

```powershell
& 'D:/Godot/Godot_v4.7.2-stable_win64_console.exe' --headless --path godot -s res://tools/check_text_behavior.gd
& 'D:/Godot/Godot_v4.7.2-stable_win64_console.exe' --headless --path godot -s res://tools/scan_text_behavior.gd -- --seconds=240
python godot/tools/audit_text_behavior.py
```

- **TEXT_BEHAVIOR_OK (1742 assertions)**, including 454 new batch-5 assertions
  and 300 simulated seconds in the actual scene. Checks cover task permission at
  commit, departure, actual arrival, every transaction-stage interruption,
  stale effects, finite two-hand draw/transfer, joint cut/resume and real storage.
- **TEXT_BEHAVIOR_SCAN_OK**: 240 seconds / 14,400 frames / 50 people / 5,826 trace
  events. All six rows ran; both tasks, both purchases and one sheet transfer
  completed. Maximum no-purpose gap 0.4833s. Previous support episodes complete,
  route door opens 21 times; no live calls remain.
- **TEXT_BEHAVIOR_AUDIT_OK**: 98 inventory entries / 97 rows / 96 enabled /
  147 action declarations. Baseline comparison is 90/90 rows, 135/135 existing
  actions and 43/43 personal maps unchanged; only the six requested rows changed.

Reproducible evidence is in `codex-iter/behavior-batch5/`: baseline-table.json,
baseline-scene.json, check-results.json, scan-summary.json, scene-evidence.json and
scene-trace.json. The baseline snapshots are retained because the checks/audit
use them. Source audit reproduction:

```powershell
python godot/tools/audit_text_behavior.py --report --batch 5 --baseline codex-iter/behavior-batch5/baseline-table.json --scene-baseline codex-iter/behavior-batch5/baseline-scene.json
```

## What these checks do not establish

No animation was played or accepted here. Physical dog/hand contact, cup/paper
attachment and paired handoff frames are missing/unbound as recorded above.
Prototype once/hold spans are text execution spans, not measured clip lengths.
The current payment authorization is not a complete economic model. Those are
explicit scope limits, not extra hypothetical risk claims.

Own superseded probe output, temporary checker and content writer were removed;
the deletion receipt is `codex-iter/behavior-batch5/deleted-files.json`. Original
NPZs, frozen baselines and previous accepted evidence remain. Method work and
its remaining stair block are separately reported in fixes-1030/REVIEW.md.


## Claude review follow-up: arrange existing material

This follow-up responds to Claude, not Hsinlung acceptance. Source pictures, not just prompts, were inspected at source-review/{clip}/sequence.png (45/90; blue RIGHT/red LEFT). Native arrays are unchanged. The audit is source/declaration compatibility, not a physical playback/contact pass.

| Action | Arranged existing material / assigned event | Observed basis |
|---|---|---|
| wait_current_person | stand_idle; current-task pool alternates existing check_watch | Both are standing, empty-hand sources. Real person's arrival interrupts either; finishing a watch gesture cannot complete the task. No nervousness is invented, so look_around_nervous/pace are not randomly substituted. |
| take_newspaper | buy_newspaper; right pickup assigned f32/30s | Right arm extends forward; f32 is low-speed dwell (.0102m/s) before retracting. One folded newspaper is the paid real item. Existing right prop/setup stays unchanged; legacy show begins f33 and is not evidence of an observed grasp. Whole70-frame source retained. |
| vending_collect | vending_collect; right pickup assigned f39/30s | Bend to low hatch; right hand reaches low/front, turns back at f39 (.1807m/s local minimum), then lifts. Actual product is coffee cup. Added only held_coffee_cup/right attachment in its setup. Whole70-frame source retained. |
| accept_sheet | receive_flyer; right receiving pause assigned f26/30s | Right hand extends, pauses at front/waist (.0939m/s), withdraws. Standing empty entry; actual real paper is result. Added only held_flyer/right attachment. Native105-frame source retained, no new source fragment. |
| offer_sheet / draw_container_item | Not bound to whole distribute_flyer | Actual LEFT makes separate extensions around f18,83,111–117 while RIGHT stays beside hip. No hand-to-stack draw is visible. This does not depict one clean stack draw + one offer. The prompt's LEFT-stack/RIGHT-offer claim is wrong; setup RIGHT-stack already matches passive hand and is retained. Generic finite-supply hands now RIGHT stack / LEFT sheet, receiver RIGHT. Need a coherent single draw/offer source, not repeated full source playback as several actions. |

Shared change: optional `material` metadata on ordinary actions records native fps/frame count, assigned effect frame, result hand/kind and source SHA. Collection commits the existing output item at this event, then keeps the normal interruptible source tail through native duration. Stale callbacks cannot recollect; cutting after pickup retains the real item. Existing joint primitive uses the bound receiving pause for its logical transfer; no bespoke flyer state machine. The text executor does not physically play that pair or establish its final hand-to-hand contact / receiving tail. That physical integration remains unestablished while giver source is missing.

`current_tasks.actions` is an optional shared standing/empty action pool. Only current task completion by real arrival ends waiting. One row still owns each behavior; old90 enabled rows,135 old actions and43 coefficient maps are identical. Existing stand_idle/check_watch declarations were reused unchanged.

clip-setup.json: only TWO item attachment additions (vending_collect and receive_flyer). All non-item fields in those entries and every byte outside their entries are unchanged. All other120 clips, including buy_newspaper/distribute_flyer, are byte-identical. Exact before/after and hashes: codex-iter/behavior-batch5/clip-setup-attachment-diff.json; frozen original fixes-1030/clip-setup-before.json. No setup pose/contact/layout or playback file changed.

Checks after binding: TEXT_BEHAVIOR_OK1773 assertions (31 new assertions over the previous1742), TEXT_BEHAVIOR_SCAN_OK240s/14400frames/50 people/5890 trace events, TEXT_BEHAVIOR_AUDIT_OK98 inventory/97 rows/96 enabled/147 actions. Independent WalkGrid text scene actually ran all six rows, both actual tasks, both purchases and one finite-sheet transfer completed. Previous90 rows/135 actions/43 personal maps compared unchanged. Scanner receipts followup-scan-summary.json and followup-scene-trace.json. No main scene launched.

Remaining source needs: pet_contact, phone pay_terminal; single coherent finite-stack draw/offer and carrying/holding variants; held-phone selection/output-wait variants. The bound four sources are no longer listed as missing. Physical pair contact and gameplay playback are not established by these text checks. No Claude CLI or external acceptance claimed.
