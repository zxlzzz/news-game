# Batch 5 — complete

2026-10-30. All six requested TODO rows are enabled: pet_dog, wait_person,
buy_newspaper, use_vending, distribute_flyer and receive_flyer. adjust_clothes
stays disabled. Start review with impl-report-5.md and catalog-audit-5.md.

- Shared current-task adapter: actual waiting person/place, animal permissions,
  stationary anchor and departure. Existing preparation/walking/action execution.
- Existing sequences gain finite selection/payment/provider output/collection.
  Paid providers continue when the buyer walks away; returning collects the real
  item once. No timer creates stock and no refund/balance is invented.
- Existing pair_once gains finite container draw and independent left/right
  items. A cut offer retains the drawn sheet/remaining stack; stale joints cannot
  commit or cancel a newly selected purpose.
- 97 rows / 96 enabled / 1 intentional exclusion / 147 actions. All 90 old enabled
  declarations, 135 old actions and 43 personal coefficient maps are unchanged.
- All 12 new semantic actions are unbound with material requests. Audit records
  folded-paper result/show timing, the vending source's coffee CUP, and flyer
  LEFT-stack text versus RIGHT-stack setup. No formal clip/setup was edited.

## Final verification

- TEXT_BEHAVIOR_OK: 1742 assertions, including 454 batch-5 assertions and 300 real
  WalkGrid scene seconds. All prior batches and new interruption/ownership cases pass.
- TEXT_BEHAVIOR_SCAN_OK: 240 seconds / 14400 frames / 50 people / 5826 trace events.
  All six rows ran; both current tasks, both purchases and one sheet transfer
  completed. Maximum no-purpose gap .4833s; route door opened 21 times; no live calls.
- TEXT_BEHAVIOR_AUDIT_OK: 98 inventory entries / 97 rows / 96 enabled / 147 actions.
- Exact command receipts, baselines, input fingerprints and selected/full traces:
  codex-iter/behavior-batch5/. Cleanup receipt: deleted-files.json in that directory.

These are text/state results, not animation contact or Hsinlung acceptance.
No main scene, motion/playback, chess-anim, repository memos, commit or push changed.
Part1 remains partial: sit-down improved/connected, stairs still blocked; see
codex-iter/method-work/fixes-1030/REVIEW.md. Conditional step4 formalization was not released.


## Claude review follow-up ? material binding in progress

Reopened native 45/90 frame sheets for wait/watch, folded-paper pickup, coffee-cup retrieval and both flyer sides (codex-iter/behavior-batch5/source-review/). Bound standing wait plus existing check_watch; assigned right-hand pickup minima f32/f39 and receiving pause f26. Added only result-item attachments to vending_collect and receive_flyer in clip-setup; all other bytes are frozen/compared. Actual flyer giver uses LEFT for several separate extensions and passive RIGHT: existing RIGHT-stack setup is retained, generic supply hands corrected. offer/draw remain unbound pending the source-sequence finding, rather than claiming the whole multi-extension source is one clean draw/offer. Generic assigned-event commit and interruptible source-tail handling being verified. Old90 rows/135 actions/43 personal maps still required unchanged.


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
