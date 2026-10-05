# Object and paired-motion review — 2026-10-02

This is a diagnostic review, not acceptance. Production motion, configuration, models and scene files were not changed.

## Coverage and limits

- Reviewed all 83 entries in `godot/npc/interactions.json`, and the 9 additional clips participating in the 10 configured pairs: 92 distinct clips.
- Visually surveyed each clip's 24 runtime times in front and side views (48 rendered frames each), using all 23 contact-sheet pages. Enlarged the individual sheets for assist_elder_walk, distribute_flyer, photo_overhead, fruit_weigh, table_tennis_play and vending_collect. Also inspected phone_booth_call's 12-time 45/135-degree supplementary sheet.
- Read the complete 120 samples for each configured interaction/pair from `human_dump.json`. The samples span the *stage* cycle; walking clips can repeat many cycles. Large sampled displacement alone is not a jump.
- Compared all 83 interaction entries' NPZ source hands and exported 16-joint JSON. All exports agree with their selected source joints within 1 mm. This only establishes faithful export; it does not establish acceptable source motion.
- Inspected stage arrangement, pose/prop/contact ordering, phase/duration handling, mapping and source metadata. Evidence/reproduction: `check_pairs.py`, `pair_metrics.json`, `contact_sheets.py`, `humans/manifest.json`, and `contact_sheets/manifest.json`.
- This is a sampled visual survey, not uninterrupted real-time playback. Small props, body overlap and occluding furniture limit several frames. No surveyed entry receives a PASS here.
- Distances to an enclosing item box are lower bounds, not distances to the mesh or an authored grip point. A positive lower bound can demonstrate separation. A small/zero lower bound cannot demonstrate correct grip. Explicit neck/back/underarm anchors must be interpreted through their configuration.

## Confirmed findings

| ID | Clip | What is established | Evidence |
|---|---|---|---|
| C1 | distribute_flyer + receive_flyer | The source LEFT hand makes the forward offer gesture while the RIGHT hand remains below hip level. Configuration attaches the stack to left and the separate leaflet to right, then blends that leaflet to the receiver at 1.92–2.20 s. The two right hands remain at least 41.9 cm apart across the cycle. The leaflet crosses open space without the giver performing the configured right-handed handoff. | Original NPZ source hand ranges; current config; `humans/distribute_flyer.png`; `pair_metrics.json` pair/source/prop records |
| C2 | photo_overhead | The phone follows the midpoint of two separated hands, rather than a shared grip. The image reads as hands beside the head with a phone at forehead height. At least one hand is outside the phone's enclosing box throughout the sampled cycle: lower bound 7.6–19.7 cm. | Full front/side sheet `humans/photo_overhead.png`; `held_item_box_gaps.photo_overhead` |
| C3 | fruit_weigh | The scale is placed inside the already occupied stall's fruit boxes and is not readable in the sampled front/side views. The fruit can be transferred to a coordinate while the weighing apparatus remains hidden, so the intended weighing event is not visible. | `humans/fruit_weigh.png`; current fruitweigh post and fruit_scale prop placement |
| C4 | vending_collect | Source right hand relative to hips moves 52.53 cm between frames 97→98 (3.2333→3.2667 s), followed by 50.31 cm on 98→99. Mapped pre-contact and final right hand both move 35.04 cm between 3.4167→3.4583 s. The contact window has ended; it exposes the source's erratic retrieval/return segment. This exists before the contact override. | `source_evidence.vending_collect`; `interactions.vending_collect.hand_changes.handRight`; side sheet supports erratic pose changes, but 24 frames cannot show the full 33 ms events |
| C5 | hang_laundry | Source right hand relative to hips moves 45.42 cm between 99→100 (3.3000→3.3333 s). Mapped pre and final both move 30.59 cm between 3.2917→3.3333 s. No hand override causes this. Left source hand also has 30.41 cm one-frame movement at 46→47. | `source_evidence.hang_laundry`; `interactions.hang_laundry.hand_changes`; a targeted full-speed excerpt is still needed for visual assessment of the rapid event |

C1's source text asks for a right-hand offer, but the delivered source does not execute it. Relative to the initial torso forward axis, left hand reaches 6.5–58.1 cm forward and rises to 33.0 cm above hips; right hand stays 13.2–4.4 cm below hips. Merely changing root offsets or adding a contact target would not reconcile that source/prop/gesture mismatch.

## Common causes supported by these cases

1. Source intent, actual source gesture, binding hand and prop transition are being treated as interchangeable. They must agree in the same event. C1 is a direct counterexample.
2. Positional contact can conceal inadequate source motion or body mechanics. Once that contact ends, source defects reappear (C4). Twelve current entries use stand_idle as their base, and replace the intended action through body/hand/foot tracks. Their contact coordinates are not evidence that the action is naturally performed.
3. Prop positioning has been checked separately from the occupied surrounding model. C2 has an item transform but no shared grip; C3 has a prop transform but no visible scale.
4. Faithful NPZ export preserves temporal problems in the source (C4/C5). Loop/seam checks alone do not inspect single-frame defects inside an action.

## Unresolved items and known omissions

| ID | Scope | Remaining question |
|---|---|---|
| U1 | phone_booth_call | Front/side views are occluded by the booth.45 degrees is still entirely blocked;135 degrees reveals the body but the receiver/grip remains hidden behind the body/side wall. No grip or take/return acceptance is possible from these views. |
| U2 | source candidates | assist_elder_walk RH 30.0 cm/1 frame, walk_backpack_straps RH 22.7 cm, atm_take_cash RH 22.3 cm, phone_urgent LH 20.3 cm/RH 17.2 cm, basketball_dribble LH 16.8 cm and fountain_drink LH 15.2 cm merit targeted playback. These are candidates, not automatic failures based on a 15 cm threshold. The assist hand target remains maintained after override. |
| U3 | manual replacements | Current stand_idle bases: basketball_shoot, football_juggle, air_walker, swing_seated, seesaw_seated, seesaw_partner, car_enter, car_exit, hold_door, push_door, pull_door, waist_twister. Natural support, body response and transitions remain provisional. On the seesaw, both participants' foot tips stay above ground during all sampled times; missing leg push is a visual/mechanics concern, not a proved pair-position fault. |
| K1 | chess_move | Current config drives the hand but has no moving chess-piece prop. The action still lacks the visible piece movement already identified in the earlier audit. |
| K2 | mop_ground | The weak source cleaning stroke remains apparent. Aligning the stick to the ground does not establish a convincing mopping gesture. This remains a qualitative source/action concern. |

## All 10 pairs

| Pair | Time/source comparison and observed result |
|---|---|
| P1 handshake_offer / handshake_reply | Both source/runtime 5 s. During the handshake interval the hands are close (minimum 1.35 cm); greater separation belongs to approach/release. No pair fault established. Exact palm contact is not proved by this figure drawing. |
| P2 breakfast_sell / breakfast_buy | Both sources 5 s, both effective runtime 6 s. Configured transfer provides a common timeline. No general temporal mismatch established; a small prop-box distance does not prove a valid grip or sale. |
| P3 interview_question / interview_answer | Both 5 s. Fixed root separation 91.8 cm. No pair drift/time mismatch established. Microphone direction/readability still needs close playback. |
| P4 interview_listen / interview_describe | Both 5 s. Fixed roots and same phase. No pair fault established; hand separation is not itself a failure for speaking/gesturing. |
| P5 interview_followup / interview_point | Both 5 s. Fixed roots and same phase. No pair fault established; microphone/body overlap remains provisional. |
| P6 give_item / receive_item | Both sources 3.4667 s, both effective runtime 4 s. Hands stay about 10 cm apart during transfer, compatible with the package between them. This is not evidence of a broken handoff. |
| P7 assist_elder_walk / elder_assisted_walk | Both source stride cycles 2 s, stage 14 s. Root separation remains 48 cm; helper RH-to-other left forearm target distance 1.93–2.00 cm, consistent with the configured 2 cm offset. No systematic drift/separation established. This target measurement does not prove a comfortable elbow or natural assistance. Source RH jump remains U2. |
| P8 table_tennis_play / table_tennis_partner | Both sources 4 s, both effective runtime 2 s, partner phase offset 0.5. Sampled stroke endpoints and paddle/ball views do not establish a missed strike. Wrist-to-ball distance is not the paddle-head contact distance. Manual full-cycle tracks mean source fidelity/natural stroke mechanics remain provisional. |
| P9 distribute_flyer / receive_flyer | Source durations 5 s /3.4667 s; effective runtime 4 s for both. Runtime normalization supplies equal phase; the proved fault is C1's hand/gesture/prop mismatch, not duration inequality by itself. |
| P10 seesaw_seated / seesaw_partner | Both 4 s, partner orientation/seat movement matched. Both use stand_idle rather than seated source. No pair-offset fault established; grounded push and credible body/seat force response are still unproved (U3). |

## Per-clip coverage

Each row below means 24 front + 24 side runtime frames were visually surveyed. Numerical checks used 120 samples from the clip's interaction dump or, for paired actors, from its configured pair lead's dump. For interaction entries, source NPZ/export comparison was also checked. “Surveyed” means no additional interaction fault was established in that sampled review; it is not acceptance. The sheet for a pair lead also renders its configured partner.

| Clip | Contact-sheet page | Finding / limit |
|---|---:|---|
| air_walker | 1 | U3: stand_idle base; machine-driven feet do not establish gait mechanics |
| assist_elder_walk | 1 | P7 / U2: support target retained; source RH 30 cm one-frame movement |
| atm_take_cash | 1 | U2: source RH 22.3 cm adjacent-frame candidate |
| badminton_swing | 1 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| basketball_dribble | 2 | U2: source LH 16.8 cm adjacent-frame candidate |
| basketball_shoot | 2 | U3: stand_idle base; shot mechanics not established by contact |
| bike_scan_unlock | 2 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| breakfast_buy | 2 | P2: effective time matched; sale contact not proved by box distances |
| breakfast_sell | 3 | P2: effective time matched; sale contact not proved by box distances |
| browse_bookstall | 3 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| buy_newspaper | 3 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| cafe_sit_drink | 3 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| car_enter | 4 | U3: stand_idle base; manual replacement remains provisional |
| car_exit | 4 | U3: stand_idle base; manual replacement remains provisional |
| carry_box | 4 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| carry_shoulder | 4 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| carry_shoulder_bag | 5 | Explicit neck anchor/strap marker; generic neck-to-box gap is not hand detachment |
| chess_move | 5 | K1: moving chess piece is absent from current prop configuration |
| distribute_flyer | 5 | C1 / P9: source uses other hand; leaflet transfers between separated right hands |
| drink | 5 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| eat_snack | 6 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| eat_walk | 6 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| elder_assisted_walk | 6 | P7: matched roots/stride; no pair separation established |
| football_juggle | 6 | U3: stand_idle base; ball/body timing remains provisional |
| fountain_drink | 7 | U2: source LH 15.2 cm adjacent-frame candidate |
| fruit_choose | 7 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| fruit_weigh | 7 | C3: scale hidden in occupied fruit stall |
| give_item | 7 | P6: 10 cm hand separation allows package between them; not a proved fault |
| hands_on_head | 8 | Pending user acceptance; no new interaction fault established by this survey |
| handshake_offer | 8 | P1: contact interval close; entry/exit separation is expected |
| handshake_reply | 8 | P1: contact interval close; entry/exit separation is expected |
| hang_laundry | 8 | C5: source RH 45.4 cm/1 frame and mapped RH 30.6 cm/41.7 ms |
| hold_door | 9 | U3: stand_idle base; manual replacement remains provisional |
| hold_guitar | 9 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| interview_answer | 9 | P3: paired duration 5 s; no pair alignment fault established |
| interview_describe | 9 | P4: paired duration 5 s; no pair alignment fault established |
| interview_followup | 10 | P5: paired duration 5 s; microphone direction still needs close playback |
| interview_listen | 10 | P4: paired duration 5 s; microphone direction still needs close playback |
| interview_point | 10 | P5: paired duration 5 s; no pair alignment fault established |
| interview_question | 10 | P3: paired duration 5 s; microphone direction still needs close playback |
| lean_railing | 11 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| lean_sign | 11 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| leg_stretch | 11 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| look_up | 11 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| mop_ground | 12 | K2: source stroke remains weak; ground alignment is not cleaning mechanics |
| parcel_terminal | 12 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| pat_dust | 12 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| phone_booth_call | 12 | U1: front/side occluded;135 deg supplementary view still hides receiver/grip |
| phone_call | 13 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| phone_urgent | 13 | U2: source LH 20.3/RH 17.2 cm adjacent-frame candidates |
| photo_overhead | 13 | C2: phone at hand midpoint; hands beside head outside phone |
| post_letter | 13 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| post_notice | 14 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| press_button | 14 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| pull_door | 14 | U3: stand_idle base; manual replacement remains provisional |
| pull_suitcase | 14 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| pullup_hold | 15 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| pullup_raise | 15 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| push_bicycle | 15 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| push_cart | 15 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| push_door | 16 | U3: stand_idle base; manual replacement remains provisional |
| push_stroller | 16 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| read_book | 16 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| receive_flyer | 16 | C1 / P9: paired receiver; leaflet arrival does not match giver's source gesture |
| receive_item | 17 | P6: package-sized hand gap; no handoff failure established |
| rummage_bin | 17 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| seesaw_partner | 17 | P10 / U3: stand_idle base; no grounded leg push in sampled cycle |
| seesaw_seated | 17 | P10 / U3: stand_idle base; no grounded leg push in sampled cycle |
| sit_sideways | 18 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| slap_table | 18 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| slide_seated | 18 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| slouch_bench | 18 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| sweep_ground | 19 | Pending user acceptance; no new interaction fault established by this survey |
| swing_seated | 19 | U3: stand_idle base; feet suspension is expected, mechanics provisional |
| table_tennis_partner | 19 | P8: half-cycle phase set; no missed ball/paddle contact established |
| table_tennis_play | 19 | P8: paddle-head contact must not be measured against wrist |
| take_back_piece | 20 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| take_photo | 20 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| throw_trash | 20 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| turn_page | 20 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| vending_collect | 21 | C4: source RH 52.5 cm/1 frame and mapped RH 35.0 cm/41.7 ms |
| waist_twister | 21 | U3: stand_idle base; manual replacement remains provisional |
| walk_backpack_straps | 21 | U2: source RH 22.7 cm adjacent-frame candidate |
| walk_cane | 21 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| walk_carry_bags | 22 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| walk_carry_box | 22 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| walk_closed_umbrella | 22 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| walk_drink | 22 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| walk_newspaper_underarm | 23 | Explicit neck anchor; hand-to-box gap is not evidence against underarm clamping |
| walk_phone_call | 23 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| wallet_takeout | 23 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |
| water_planter_hold | 23 | Surveyed; no additional interaction fault established; playback/visual acceptance remains open |

Only diagnostic scripts and evidence were written inside this review folder. No production fix, game launch, source replacement, configuration change, commit or memo update was performed by this reviewer.
