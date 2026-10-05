# Arm shape and hand-line review — 2026-10-03

This review concerns upper-arm/forearm shape and visible continuity only. No production motion, mapping, contact parameter or shader was changed in this review. No new mechanical test or angle/speed threshold was introduced. These are visual observations, not acceptance from scripted checks.

## What was actually viewed

- All 241 human stage entries: 12 evenly spaced final-pose samples per entry, front and side, in `overview/01.png` through `41.png`. All 41 sheets were viewed. These are overview samples, not full continuous playback.
- All 20 paired entries: their second participant at the same 12 samples, front and side, in `partners/01.png` through `04.png`. Paired aliases can display the same two people; the entry name is not necessarily the first participant's clip.
- 42 named entries received source-input / mapped / final comparison sheets at 12 moments, front / 45-degree / side. The extra participants for `give_item` and `receive_flyer` were also viewed. All 44 comparison sheets were viewed.
- All 22 dense windows in `dense/` were viewed. They contain every exported sample in their stated interval: native boundaries plus at least 60 Hz samples. They are consecutive drawings of those windows, not full playback of all 241 entries.
- No entry is marked visually accepted. An unlisted motion is not a pass. Short jumps outside the dense windows, renderer-only flicker, props and endpoint hold resources remain unverified by this review.

The evidence drawings isolate upper-body geometry: arms black, torso/head gray. They use orthographic views, fixed stroke width and a neck-centered crop. They do not reproduce Godot's depth ordering or line shader. Use them to examine arm shape and pose continuity, not to certify rendered head/prop clearance. `SRC` is the 16-joint runtime input exported from the selected Kimodo NPZ (including export seam processing where applicable), drawn with its anatomical shoulders and uniformly scaled for inspection; it is not an unmodified original full-body Kimodo render. Source drawings use the nearest source frame. `MAP` is ClipPose output, already including mapping, interpolation and head clearance. `END` is the actual stage pose after contacts. Thus MAP does not isolate the initial direction rule alone.

## Visible shape problems to address

The following are visual shape findings. Times identify regions to revisit, not automatic angle violations or an exhaustive list of bad frames. No ablation was performed to distinguish individual mapping substeps.

| Motion / participant | Arm and portion | Visible problem | Evidence / stage implicated |
|---|---|---|---|
| `duck_cover` | Both; raised protective hold, about 1.5 s onward | Source elbows frame the head. Mapped arms form a broad crossbar with compact triangles; the bend orientation changes while the body is already protecting its head. Fixing the earlier discontinuity did not make this hold natural. | `compare/duck_cover_p1.png`; MAP and END agree. Dense 1.50 and 2.65 windows show intermediate poses, not a demonstrated one-frame branch flip. |
| `hands_on_head` | Both; about 0.7–2.9 s | Source outward elbows become a rigid goalpost / cup shape. Side view crowds upper arm and forearm together near the head. | `compare/hands_on_head_p1.png`; already visible in MAP; contact adjustment also changes the held shape. |
| `cover_face` | Both; start through about 1.9 s | Source has distinguishable folded forearms beside the face. Figure becomes a short bar / triangle below the head; elbows no longer read naturally. | `compare/cover_face_p1.png`; MAP and END agree. |
| `startle` | Both; about 0.5–1.9 s | The defensive fold is squeezed into a tiny W at the neck; upper/lower segments overlap and become hard to read as bent arms. | `compare/startle_p1.png`; already in MAP. |
| `shadow_box` | Both guard arms; between punches | Guard forearms lose the source's upright shape and fold into the neck/chest silhouette; extended punches are clearer than the returning guard. | `compare/shadow_box_p1.png`; MAP and END agree. This is not proof that every fast punch is a jump. |
| `cough`, `talk_shy` | Right; hand near mouth/chest | Clear source bent arm becomes a small triangular flap at the neck in front/oblique views, with a changed side-view fold. | Respective comparison sheets; already in MAP. |
| `whisper` | Right; about 0.6–2.5 s | Hand-near-mouth bend loses its elbow silhouette; much of the arm appears as a short neck-adjacent stroke. | `compare/whisper_p1.png`; already in MAP. |
| `phone_call`, `phone_urgent` | Phone arm; sustained hold | Mapped arm becomes a cramped zigzag close to the neck; plane changes with turning make the elbow difficult to read. The source is already deeply folded, but its shoulder separation makes the elbow clearer. | Respective comparison sheets; MAP and END agree. Dense urgent 2.20 window does not establish an instantaneous jump. |
| `smoke` | Right; mouth hold portions | Deep source bend becomes an overlapping neck/chest shape; the side/oblique arm silhouette is less distinct after mapping. | `compare/smoke_p1.png`; already in MAP. |
| `walk_cold` | Both; whole cycle | Source's separate folded arms collapse into a compact W / cross near the neck. | `compare/walk_cold_p1.png`; MAP and END agree. |
| `walk_backpack_straps` | Both; whole cycle | Source elbows and forearms remain separate. Figure makes a small closed triangle against the chest, hiding much of each lower arm. | `compare/walk_backpack_straps_p1.png`; MAP and END agree. |
| `walk_newspaper_underarm` | Left; whole cycle | The held arm reads as an awkward short hook / triangular fold near the neck rather than a readable elbow wrapping the carried item. | `compare/walk_newspaper_underarm_p1.png`; already in MAP. Prop fit is outside this review. |
| `carry_shoulder_bag` | Right; whole cycle | Holding arm's elbow/forearm overlaps the upper body; the final correction slightly opens it but leaves a stiff short-hook silhouette. | `compare/carry_shoulder_bag_p1.png`; compare all three stages. |
| `walk_umbrella`, `hold_umbrella` | Held arm; whole clip | Source shoulder-based bend becomes a neck-rooted zigzag; forearm alignment is stiff in oblique view. | Respective comparison sheets; mostly present before final contacts. No dense jump verdict. |
| `mop_ground`, `sweep_ground` | Both; whole cycle | Arms fold into a compact K / chest triangle. Upper/lower segments overlap and one forearm seems to turn back across the other arm. | Respective comparison sheets; much of the collapse is in MAP; mop contacts further alter the fold. |
| `rummage_bin` | Both; about 1.0–4.4 s | Final contact pose adds very different elbow directions to the mapped source; arms bunch around the bent head and change fold plane during the reach. | `compare/rummage_bin_p1.png`; dense 1.00, 2.90 and 3.75 windows. Rapid final elbow turn around 1.55–1.60 s deserves playback attention; do not label it an isolated one-frame flip from these drawings. |
| `fountain_drink` | Both; about 0.9–4.1 s | Contact pose closes the arms into a crossed / star-shaped cluster below the head; it obscures elbow bends visible in the mapped input. | `compare/fountain_drink_p1.png`; END introduces the most conspicuous collapse. |
| `basketball_dribble` | Right; repeated contact portions | Final ball-following hand correction raises/folds the arm near the head where the source/mapped arm is lower. The contact motion produces a cramped, stiff bend. | `compare/basketball_dribble_p1.png`; dense 0.00 and 1.20 windows show the final fold changing over intermediate samples. |
| `browse_bookstall` | Both; sustained contact/read portion | Final reach produces a narrow triangle under the neck, rather than the source's readable shoulder/elbow bend. | `compare/browse_bookstall_p1.png`; dense 3.30 window shows continuous but awkward held shape. Earlier repaired jumps must not be reported as newly observed jumps. |
| `slide_seated` | Both; whole supported pose | Final support pose holds the upper arms across the body and forearms straight downward like inverted goalposts. Some body changes alter the bend plane while the hands remain supported. | `compare/slide_seated_p1.png`; END differs strongly from MAP. |
| `air_walker`, `football_juggle` | Both; whole authored pose | Fixed contact/authored arms are stiff and angular. Air walker has compact elbows near the head; football uses a nearly fixed inverted goalpost shape. | Respective comparison sheets. Runtime base is `stand_idle`, so these are authored/contact poses, not a defective Kimodo arm gesture. |
| `basketball_shoot` | Both; raised portion about 1.8–3.6 s | Both elbows form a rigid symmetric cup / box during the raise/hold. The arm shape lacks a natural changing fold. | `compare/basketball_shoot_p1.png`; runtime base is `stand_idle`; final authored targets create the shape. Full shooting semantics are outside this review. |

## Other flagged silhouettes / movement regions, still provisional

These were noticed in the full overview; they need closer actual playback or further source comparison before declaring the fold defective. They must not be merged into the confirmed table solely because the arms are bent or overlap in one projection.

| Motion(s) | What to revisit |
|---|---|
| `adjust_clothes`, `back_away`, `beckon`, `check_watch`, `cafe_sit_drink`, `chess_move` | Small front-view folded triangles, neck-near hands, or reach/withdraw elbow orientation. |
| `badminton_swing` | Rapid change of raised-arm silhouette about 1.3–1.6 s. Dense 1.00 window shows intermediate poses; the speed alone is not a proven jump. |
| `breakfast_buy`, `breakfast_sell`, `buy_newspaper`, `fruit_choose`, `fruit_weigh` | Reach/retract fold direction, especially seller and buyer separately. |
| `carry_box`, `carry_shoulder`, `walk_carry_box` | Wide held elbows / near-straight side-view forearms, or deep strap-holding fold. `walk_carry_box` source already has this broad arm pose. |
| `duck_cover_hold`, `hands_on_head_hold`, `sit_ground_dazed`, `sit_ground_dazed_hold` | Related head-protection folds; inspect hold assets independently, not just the moving entry. |
| `fan_self`, `phone_booth_call`, `walk_phone_call`, `drink`, `walk_drink`, `eat_snack`, `rub_eye`, `scratch_head`, `sneeze`, `smoke_walk` | Near-face folds; distinguish legitimate deep flexion / foreshortening from mapped loss of elbow shape. Fan source already has the deep bend. |
| `hang_laundry`, `post_notice`, `selfie`, `wipe_sweat` | Forearm/plane changes during raise, wipe or free-arm movement. Comparison sheets were viewed; relevant dense windows contain intermediate poses and do not prove isolated snaps. |
| `guard`, `recoil`, `dodge`, `shout` | Defensive / emphatic tight folds, without treating the intended gesture as an error. |
| `jog`, `run`, `run_curve`, `march_in_place` | Alternating bent-arm silhouettes. A front-view diamond alone does not imply the 3D elbow is wrong. |
| `laugh`, `lecture`, `magic_gesture`, `pat_dust`, `parcel_terminal`, `talk_accuse`, `slap_table` | Compact chest folds or reach/withdraw turns. Laugh source already changes its bend with the leaning torso. |
| `lean_railing`, `lean_sign`, `take_back_piece`, `pullup_hold`, `pullup_raise`, `walk_closed_umbrella` | Held/contact elbow orientation and silhouette. |
| `give_item`, `receive_item`, `distribute_flyer`, `receive_flyer`, `assist_elder_walk`, `elder_assisted_walk` | Contact-arm folds; the second participant was included in this overview review. Item/flyer comparisons were also viewed. Current coarse/dense evidence does not demonstrate the earlier repaired flips recurring. |
| `swing_seated`, `seesaw_seated`, `seesaw_partner`, `car_enter`, `car_exit`, `pull_door`, `push_door` | Authored fixed-target folds, as separate from source-mapping defects. Swing comparison shows front Y / side overlap, not a demonstrated 3D angle violation. Door dense windows show continuous movement in the inspected intervals. |
| `interview_answer`, `interview_question` | Answerer's oblique / side elbow silhouette; paired aliases share the answerer. |
| `vendor_call`, `vendor_tidy`, `walk_talk` | Gesture transitions remain visually brisk/stiff. Dense windows show intermediate poses; do not inherit old numeric jump verdicts as fresh visual evidence. |

`cross_arms`, `cheer`, `photo_overhead`, `hands_up` and ordinary straight reaches retain the documented accepted style tradeoffs. Do not automatically flag a T, V, right-angle bend, front-view overlap or side-view foreshortening as a failure.

## Cause supported by the evidence

The pipeline is not an angle-preserving retarget. Both source shoulders are removed in the figure; `armsByDirection` splits the clavicle vector into upper/forearm directions. `mapFrame` then remaps hand height and head-relative location, rebuilds the elbow with two-bone IK, adjusts the bend direction around the head, and applies rigid whole-arm clearance. Later contact targets can rebuild the arm again. Therefore a clean Kimodo source and constant figure bone lengths do not guarantee a natural elbow fold or a readable screen silhouette.

SRC/MAP comparisons identify mapping-stage shape distortion in the near-head/chest groups above. MAP/END comparisons identify additional contact-stage distortion in rummaging, fountain drinking, dribbling and several authored equipment poses. They do not prove which individual mapping substep is responsible; that requires isolated visual comparisons in a future authorized repair. Rigid whole-arm head clearance preserves the arm's internal angle by itself but can change its projected fold direction. Do not blame it alone for every changed elbow angle.

No new isolated one-frame discontinuity was conclusively identified in the 22 inspected windows. This is not a verdict that hand-line jumps are gone: the overview is sparse, dense windows cover selected regions, and the diagnostic drawings do not reproduce the actual Godot line shader. Current evidence establishes widespread awkward folds and several rapid/poorly readable plane changes. Native playback and renderer-level review are still needed for remaining jump claims.

## Standing review instruction

See `docs/design-plans/npc-skeleton-mapping.md`, section 8, and `assets/动作生成任务清单.md`, Execution conventions. Visually inspect upper-arm/forearm angles and hand-line continuity in the final figure at normal speed, then slow/replay suspicious portions from front, side and oblique views. Compare source input, mapped pose and final contact pose at the same moment. Record exact motion, participant, side and portion. Mechanical checks never establish that these shapes are reasonable. No new numerical naturalness gate is requested.
