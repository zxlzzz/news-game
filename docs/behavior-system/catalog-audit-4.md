# Batch 4 catalog and authoring audit

Every inventory entry is accounted for below. `walk` maps to existing `stroll`; queue, serve_customer and pass_door are internal work, never extra scored rows. `idle` and disabled adjust_clothes are retained implementation entries.

Rows were materialized as a batch. The deterministic check removes/re-adds every enabled row and compares all other data. This is a reproducible independent-addition check, not a claim that separate commits or timings were measured.

Unless marked demo.json, row/content locations below are in `godot/npc/text_behavior/table.json`. Shared engine development is charged explicitly in impl-report-4.md; the column lists first introductions of shared content definitions, not free engine support.

| Row | State / template | Changed content locations | Files for content |
|---|---|---|---|
| `idle` | direct | unchanged | 0; unchanged row |
| `adjust_clothes` | disabled: 需具体原因才启用（behaviors.md §9） | unchanged | 0; unchanged row |
| `fidget` | direct | unchanged | 0; unchanged row |
| `stroll` | direct | unchanged | 0; unchanged row |
| `leave` | direct | unchanged | 0; unchanged row |
| `sit_bench` | go_use | unchanged | 0; unchanged row |
| `slouch_bench` | go_use | unchanged | 0; unchanged row |
| `phone_browse` | use_tool | unchanged | 0; unchanged row |
| `read_book` | use_tool | unchanged | 0; unchanged row |
| `read_notice` | go_use | unchanged | 0; unchanged row |
| `use_fountain` | go_use | unchanged | 0; unchanged row |
| `pet_dog` | disabled: TODO: Needs animal approach/contact permission and departure interface. | unchanged | 0; unchanged row |
| `handshake` | pair_once | unchanged | 0; unchanged row |
| `tend_stall` | service_vendor | `services.fruit (shared definition changed)` | 1; unchanged row |
| `buy_stuff` | service_customer | `actions.phone_call`, `connections.phone` | 1; unchanged row |
| `run` | go_use | unchanged | 0; unchanged row |
| `jog` | go_use | unchanged | 0; unchanged row |
| `sit_sideways` | go_use | unchanged | 0; unchanged row |
| `sit_step` | go_use | unchanged | 0; unchanged row |
| `sit_on_ground` | go_use | unchanged | 0; unchanged row |
| `sit_knees_up` | go_use | unchanged | 0; unchanged row |
| `lie_ground_hold` | go_use | unchanged | 0; unchanged row |
| `lean_wall` | go_use | unchanged | 0; unchanged row |
| `lean_sign` | go_use | unchanged | 0; unchanged row |
| `lean_railing` | go_use | unchanged | 0; unchanged row |
| `wait_bus` | go_use | unchanged | 0; unchanged row |
| `wait_person` | disabled: TODO: Needs a scene-provided current waiting person/place; no schedules or remembered appointments. | unchanged | 0; unchanged row |
| `browse_stall` | go_use | unchanged | 0; unchanged row |
| `buy_newspaper` | disabled: TODO: Needs configured checkout and one-time collection; taking a paper is not a purchase. | unchanged | 0; unchanged row |
| `use_vending` | disabled: TODO: Machine selection/payment/output facts are undefined; a timer must not create stock. | unchanged | 0; unchanged row |
| `hold_door` | support_use | `rows.hold_door`, `actions.hold_door`, `actions.open_fixture`, `actions.support_prepare`, `actions.support_latch`, `actions.support_release`, `actions.support_wait`, `supports.door` | 1; existing row revisited |
| `push_cart` | support_use | `rows.push_cart`, `actions.push_cart`, `supports.cart` | 1; existing row revisited |
| `push_stroller` | support_use | `rows.push_stroller`, `actions.push_stroller`, `supports.stroller` | 1; existing row revisited |
| `pull_suitcase` | support_use | `rows.pull_suitcase`, `actions.pull_suitcase`, `supports.suitcase` | 1; existing row revisited |
| `ride_bicycle` | support_use | `rows.ride_bicycle`, `actions.ride_bicycle`, `supports.bicycle` | 1; existing row revisited |
| `ride_scooter` | support_use | `rows.ride_scooter`, `actions.ride_scooter`, `supports.scooter` | 1; existing row revisited |
| `hail_taxi` | support_use | `rows.hail_taxi`, `actions.car_ride`, `actions.hail_taxi`, `supports.taxi` | 1; existing row revisited |
| `enter_car` | support_use | `rows.enter_car`, `supports.car` | 1; existing row revisited |
| `exit_car` | support_use | `rows.exit_car` | 1; existing row revisited |
| `assist_person` | support_use | `rows.assist_person`, `actions.assist_elder_walk`, `actions.elder_assisted_walk`, `supports.assistance` | 1; existing row revisited |
| `accept_assistance` | support_use | `rows.accept_assistance` | 1; existing row revisited |
| `help_fallen` | support_use | `rows.help_fallen`, `actions.help_up`, `actions.helped_up`, `actions.helped_up_ground_seated`, `supports.lift`, `supports.lift_ground_seated` | 1; existing row revisited |
| `play_seesaw` | support_use | `rows.play_seesaw`, `actions.seesaw_seated`, `actions.seesaw_partner`, `supports.seesaw` | 1; existing row revisited |
| `slide_seated` | support_use | `rows.slide_seated`, `actions.slide_seated`, `supports.slide` | 1; existing row revisited |
| `swing_seated` | support_use | `rows.swing_seated`, `actions.swing_seated`, `supports.swing` | 1; existing row revisited |
| `do_pullups` | support_use | `rows.do_pullups`, `actions.pullup_raise`, `supports.bar` | 1; existing row revisited |
| `give_object` | pair_once | unchanged | 0; unchanged row |
| `receive_object` | pair_once | unchanged | 0; unchanged row |
| `distribute_flyer` | disabled: TODO: Needs finite sheets and left-hand stack/right-hand transfer; single held slot cannot express both. | unchanged | 0; unchanged row |
| `receive_flyer` | disabled: TODO: The supplying process and two-hand sheet representation are undefined. | unchanged | 0; unchanged row |
| `withdraw_cash` | sequence | unchanged | 0; unchanged row |
| `collect_parcel` | sequence | unchanged | 0; unchanged row |
| `post_letter` | sequence | unchanged | 0; unchanged row |
| `post_notice` | sequence | unchanged | 0; unchanged row |
| `throw_trash` | sequence | unchanged | 0; unchanged row |
| `pick_up_object` | sequence | unchanged | 0; unchanged row |
| `rummage_bin` | go_use | unchanged | 0; unchanged row |
| `sweep_area` | go_use | unchanged | 0; unchanged row |
| `mop_area` | go_use | unchanged | 0; unchanged row |
| `water_plants` | go_use | unchanged | 0; unchanged row |
| `hang_laundry` | sequence | unchanged | 0; unchanged row |
| `wipe_table` | go_use | unchanged | 0; unchanged row |
| `cafe_drink` | sequence | unchanged | 0; unchanged row |
| `use_payphone` | sequence | unchanged | 0; unchanged row |
| `eat_snack` | use_tool | unchanged | 0; unchanged row |
| `drink` | use_tool | unchanged | 0; unchanged row |
| `smoke` | use_tool | unchanged | 0; unchanged row |
| `read_newspaper` | use_tool | unchanged | 0; unchanged row |
| `selfie` | use_tool | unchanged | 0; unchanged row |
| `phone_call` | connection | `rows.phone_call`, `actions.walk_phone_call` | 1; existing row revisited |
| `greet` | observe | unchanged | 0; unchanged row |
| `take_photo` | observe | unchanged | 0; unchanged row |
| `film_phone` | observe | unchanged | 0; unchanged row |
| `carry_to_place` | transport | unchanged | 0; unchanged row |
| `walk_with_umbrella` | transport | unchanged | 0; unchanged row |
| `perform_guitar` | go_use | unchanged | 0; unchanged row |
| `exercise` | go_use | unchanged | 0; unchanged row |
| `tai_chi` | go_use | unchanged | 0; unchanged row |
| `handstand` | support_use | `rows.handstand`, `actions.handstand (shared declaration changed)`, `supports.palms` | 1; existing row revisited |
| `leg_stretch` | go_use | unchanged | 0; unchanged row |
| `use_air_walker` | go_use | unchanged | 0; unchanged row |
| `use_waist_twister` | go_use | unchanged | 0; unchanged row |
| `chat` | conversation | unchanged | 0; unchanged row |
| `whisper` | conversation | unchanged | 0; unchanged row |
| `argue` | conversation | unchanged | 0; unchanged row |
| `interview` | conversation | unchanged | 0; unchanged row |
| `answer_interview` | conversation | unchanged | 0; unchanged row |
| `play_chess` | object_activity | unchanged | 0; unchanged row |
| `watch_chess` | object_activity | unchanged | 0; unchanged row |
| `walk_with_child` | move_together | unchanged | 0; unchanged row |
| `follow_adult` | move_together | unchanged | 0; unchanged row |
| `walk_dog` | move_together | unchanged | 0; unchanged row |
| `react_startle` | event_response | unchanged | 0; unchanged row |
| `protect_self` | event_response | unchanged | 0; unchanged row |
| `recover_balance` | event_response | unchanged | 0; unchanged row |
| `rest_after_fall` | event_response | unchanged | 0; unchanged row |
| `watch_event` | event_response | unchanged | 0; unchanged row |

Baseline comparison: 72 previously enabled rows; 72 unchanged. Changed existing actions: handstand. Shared engine/preparation costs are charged in the implementation report; table-only content cost does not include that platform work.

| Inventory entry | Coverage |
|---|---|
| `accept_assistance` | enabled: accept_assistance |
| `answer_interview` | enabled: answer_interview |
| `argue` | enabled: argue |
| `assist_person` | enabled: assist_person |
| `browse_stall` | enabled: browse_stall |
| `buy_newspaper` | disabled: TODO: Needs configured checkout and one-time collection; taking a paper is not a purchase. |
| `buy_stuff` | enabled: buy_stuff |
| `cafe_drink` | enabled: cafe_drink |
| `carry_to_place` | enabled: carry_to_place |
| `chat` | enabled: chat |
| `collect_parcel` | enabled: collect_parcel |
| `distribute_flyer` | disabled: TODO: Needs finite sheets and left-hand stack/right-hand transfer; single held slot cannot express both. |
| `do_pullups` | enabled: do_pullups |
| `drink` | enabled: drink |
| `eat_snack` | enabled: eat_snack |
| `enter_car` | enabled: enter_car |
| `exercise` | enabled: exercise |
| `exit_car` | enabled: exit_car |
| `fidget` | enabled: fidget |
| `film_phone` | enabled: film_phone |
| `follow_adult` | enabled: follow_adult |
| `give_object` | enabled: give_object |
| `greet` | enabled: greet |
| `hail_taxi` | enabled: hail_taxi |
| `handshake` | enabled: handshake |
| `handstand` | enabled: handstand |
| `hang_laundry` | enabled: hang_laundry |
| `help_fallen` | enabled: help_fallen |
| `hold_door` | enabled: hold_door |
| `interview` | enabled: interview |
| `jog` | enabled: jog |
| `lean_railing` | enabled: lean_railing |
| `lean_sign` | enabled: lean_sign |
| `lean_wall` | enabled: lean_wall |
| `leave` | enabled: leave |
| `leg_stretch` | enabled: leg_stretch |
| `lie_ground_hold` | enabled: lie_ground_hold |
| `mop_area` | enabled: mop_area |
| `pass_door` | internal live-portal operation of current movement; never a scored row |
| `perform_guitar` | enabled: perform_guitar |
| `pet_dog` | disabled: TODO: Needs animal approach/contact permission and departure interface. |
| `phone_browse` | enabled: phone_browse |
| `phone_call` | enabled: phone_call |
| `pick_up_object` | enabled: pick_up_object |
| `play_chess` | enabled: play_chess |
| `play_seesaw` | enabled: play_seesaw |
| `post_letter` | enabled: post_letter |
| `post_notice` | enabled: post_notice |
| `protect_self` | enabled: protect_self |
| `pull_suitcase` | enabled: pull_suitcase |
| `push_cart` | enabled: push_cart |
| `push_stroller` | enabled: push_stroller |
| `queue` | service queue |
| `react_startle` | enabled: react_startle |
| `read_book` | enabled: read_book |
| `read_newspaper` | enabled: read_newspaper |
| `read_notice` | enabled: read_notice |
| `receive_flyer` | disabled: TODO: The supplying process and two-hand sheet representation are undefined. |
| `receive_object` | enabled: receive_object |
| `recover_balance` | enabled: recover_balance |
| `rest_after_fall` | enabled: rest_after_fall |
| `ride_bicycle` | enabled: ride_bicycle |
| `ride_scooter` | enabled: ride_scooter |
| `rummage_bin` | enabled: rummage_bin |
| `run` | enabled: run |
| `selfie` | enabled: selfie |
| `serve_customer` | service vendor internal work |
| `sit_bench` | enabled: sit_bench |
| `sit_knees_up` | enabled: sit_knees_up |
| `sit_on_ground` | enabled: sit_on_ground |
| `sit_sideways` | enabled: sit_sideways |
| `sit_step` | enabled: sit_step |
| `slide_seated` | enabled: slide_seated |
| `slouch_bench` | enabled: slouch_bench |
| `smoke` | enabled: smoke |
| `sweep_area` | enabled: sweep_area |
| `swing_seated` | enabled: swing_seated |
| `tai_chi` | enabled: tai_chi |
| `take_photo` | enabled: take_photo |
| `tend_stall` | enabled: tend_stall |
| `throw_trash` | enabled: throw_trash |
| `use_air_walker` | enabled: use_air_walker |
| `use_fountain` | enabled: use_fountain |
| `use_payphone` | enabled: use_payphone |
| `use_vending` | disabled: TODO: Machine selection/payment/output facts are undefined; a timer must not create stock. |
| `use_waist_twister` | enabled: use_waist_twister |
| `wait_bus` | enabled: wait_bus |
| `wait_person` | disabled: TODO: Needs a scene-provided current waiting person/place; no schedules or remembered appointments. |
| `walk` | enabled: stroll |
| `walk_dog` | enabled: walk_dog |
| `walk_with_child` | enabled: walk_with_child |
| `walk_with_umbrella` | enabled: walk_with_umbrella |
| `watch_chess` | enabled: watch_chess |
| `watch_event` | enabled: watch_event |
| `water_plants` | enabled: water_plants |
| `whisper` | enabled: whisper |
| `wipe_table` | enabled: wipe_table |
| `withdraw_cash` | enabled: withdraw_cash |

## Each action declaration

The source text, setup post/prop/partner and exact table line are preserved in asset-audit-4.json. A source name proves neither geometry nor playback acceptance.

| Action | Posture / hand | Source binding | Review |
|---|---|---|---|
| `stand_idle` | standing / declared text states; conditional source only | {"declared": null, "empty": "stand_idle", "held": null} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `adjust_clothes` | standing / empty | {"declared": "adjust_clothes"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `scratch_head` | standing / empty | {"declared": "scratch_head"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `rub_eye` | standing / empty | {"declared": "rub_eye"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `check_watch` | standing / empty | {"declared": "check_watch"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `stretch` | standing / empty | {"declared": "stretch"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `pat_dust` | standing / empty | {"declared": "pat_dust"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `look_up` | standing / declared text states; conditional source only | {"declared": null, "empty": "look_up", "held": null} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `yawn` | standing / empty | {"declared": "yawn"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `walk` | standing / declared text states; conditional source only | {"declared": null, "empty": "walk", "held": null} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `leave` | standing / declared text states; conditional source only | {"declared": null, "empty": "walk", "held": null} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `sit_bench` | seated / empty | {"declared": "sit_bench"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `slouch_bench` | seated / empty | {"declared": "slouch_bench"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `phone_browse` | standing / phone | {"declared": null} | Explicitly unbound semantic action; do not substitute a similarly named clip. |
| `read_book` | standing / book | {"declared": "read_book"} | Standing source only. Seated use removed; shared seat rise now runs before reading. |
| `read_notice` | standing / declared text states; conditional source only | {"declared": null, "empty": "read_notice", "held": null} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `fountain_drink` | standing / empty | {"declared": "fountain_drink"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `stow_item` | all / declared text states; conditional source only | {"declared": null} | Unbound finite real-item preparation; standing/seated/ground use is explicit text semantics. |
| `put_down` | all / declared text states; conditional source only | {"declared": null} | Unbound finite real-item preparation; requires an actual reachable surface and capacity. |
| `take_tool` | all / declared text states; conditional source only | {"declared": null} | Unbound finite real-item preparation; standing/seated/ground use is explicit text semantics. |
| `stand_up` | seated / declared text states; conditional source only | {"declared": null, "empty": "stand_up", "held": null} | Conditional bench transition only. Other seat kinds reference seat_rise; held-object variants are unbound. |
| `sit_down` | standing / declared text states; conditional source only | {"declared": null, "empty": "sit_down", "held": null} | Conditional bench transition only. Other seat kinds reference seat_lower; held-object variants are unbound. |
| `handshake_wait` | standing / empty | {"declared": null} | Explicitly unbound semantic action; do not substitute a similarly named clip. |
| `pair_wait` | standing / declared text states; conditional source only | {"declared": null, "empty": "stand_idle", "held": null} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `handshake_offer` | standing / empty | {"declared": "handshake_offer"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `handshake_reply` | standing / empty | {"declared": "handshake_reply"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `choose_item` | standing / empty | {"declared": "choose_item"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `fruit_weigh` | standing / empty | {"declared": "fruit_weigh"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `vendor_call` | standing / empty | {"declared": "vendor_call"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `vendor_tidy` | standing / empty | {"declared": "vendor_tidy"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `prepare_payment_tool` | standing / wallet | {"declared": null} | Explicitly unbound semantic action; do not substitute a similarly named clip. |
| `present_payment_tool` | standing / wallet | {"declared": null} | Explicitly unbound semantic action; do not substitute a similarly named clip. |
| `confirm_checkout` | standing / empty | {"declared": null} | Explicitly unbound semantic action; do not substitute a similarly named clip. |
| `give_item` | standing / goods | {"declared": "give_item"} | Small-object source identified; existing cross-counter contact and handoff-frame gaps from report 2 remain. |
| `receive_item` | standing / empty | {"declared": "receive_item"} | Empty receiving hand at entry; ownership changes only through the shared joint commit. |
| `take_item` | standing / empty | {"declared": null} | Explicitly unbound semantic action; do not substitute a similarly named clip. |
| `pack_goods` | standing / empty | {"declared": null} | Explicitly unbound semantic action; do not substitute a similarly named clip. |
| `queue_wait` | standing / declared text states; conditional source only | {"declared": null, "empty": "stand_idle", "held": null} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `service_wait` | standing / declared text states; conditional source only | {"declared": null, "empty": "stand_idle", "held": null} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `run` | standing / empty | {"declared": "run"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `jog` | standing / empty | {"declared": "jog"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `sit_sideways` | seated / empty | {"declared": null} | Unbound: same-name meta describes reclining, not sideways sitting. |
| `sit_step` | seated / empty | {"declared": "sit_step"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `sit_ground` | standing / empty | {"declared": "sit_ground"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `lie_down` | standing / empty | {"declared": null} | Missing standing-to-lying transition; lying hold is a different action. |
| `get_up_ground` | ground / empty | {"declared": null} | Missing ground-to-standing clip; ground posture and can_rise required, never a chair rise. |
| `sit_ground_hold` | ground_seated / empty | {"declared": null} | Missing plain ground-seated hold; sit_ground is the transition. |
| `sit_knees_up` | ground_seated / empty | {"declared": "sit_knees_up"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `lie_ground_hold` | lying / empty | {"declared": "lie_ground_hold"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `lean_wall` | standing / empty | {"declared": "lean_wall"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `lean_sign` | standing / empty | {"declared": "lean_sign"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `lean_railing` | standing / empty | {"declared": "lean_railing"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `wait_standing` | standing / declared text states; conditional source only | {"declared": null, "empty": "stand_idle", "held": null} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `atm_keypad` | standing / empty | {"declared": "atm_keypad"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `atm_take_cash` | standing / empty | {"declared": null} | Unbound: available clip puts cash into a pocket; text process collects a finite item to the hand. Needs matching output/fragment. |
| `parcel_terminal` | standing / empty | {"declared": null} | Unbound: current clip-setup pose defines screen touches, without the retrieval described in the source. Text collect remains explicit. |
| `post_letter` | standing / envelope | {"declared": "post_letter"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `post_notice` | standing / paper | {"declared": "post_notice"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `throw_trash` | standing / trash | {"declared": "throw_trash"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `pick_up` | standing / empty | {"declared": null} | Unbound generic collection: existing source picks up one small fruit; arbitrary object shapes are not covered. |
| `rummage_bin` | standing / empty | {"declared": "rummage_bin"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `sweep_ground` | standing / broom | {"declared": "sweep_ground"} | Source uses both hands on one broom. Setup attaches the broom to the right hand; two-hand contact is not established by this audit. |
| `mop_ground` | standing / mop | {"declared": "mop_ground"} | Source uses both hands on one mop. Setup attaches the mop to the right hand; two-hand contact is not established by this audit. |
| `water_planter_hold` | standing / watering_can | {"declared": "water_planter_hold"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `hang_laundry` | standing / clothes | {"declared": "hang_laundry"} | One garment starts held and ends on the rail surface; a once deposit, not an infinite held-clothes loop. |
| `wipe_table` | standing / cloth | {"declared": null} | Explicitly unbound semantic action; do not substitute a similarly named clip. |
| `cafe_sit_drink` | seated / empty | {"declared": "cafe_sit_drink"} | Requires an actual cup on the target surface and a cafe seat. Cup returns to the same surface; no tool is invented. |
| `phone_booth_call` | standing / empty | {"declared": "phone_booth_call"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `eat_snack` | standing / snack | {"declared": "eat_snack"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `drink` | standing / cup | {"declared": "drink"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `smoke` | standing / cigarette | {"declared": "smoke"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `read_newspaper` | standing / newspaper | {"declared": "read_newspaper"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `selfie` | standing / phone | {"declared": "selfie"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `take_photo` | standing / camera | {"declared": "take_photo"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `film_phone` | standing / phone | {"declared": "film_phone"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `wave` | standing / empty | {"declared": "wave"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `walk_carry_box` | standing / box | {"declared": "walk_carry_box"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `walk_carry_bag` | standing / bag | {"declared": "walk_carry_bag"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `walk_hold_front` | standing / closed_book | {"declared": "walk_hold_front"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `walk_closed_umbrella` | standing / umbrella | {"declared": "walk_closed_umbrella"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `walk_umbrella` | standing / open_umbrella | {"declared": null} | Unbound: same-name meta describes a phone beside the ear, despite the umbrella prop in clip-setup. |
| `play_guitar` | standing / guitar | {"declared": null} | Explicitly unbound semantic action; do not substitute a similarly named clip. |
| `exercise` | standing / empty | {"declared": "exercise"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `tai_chi` | standing / empty | {"declared": "tai_chi"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `handstand` | inverted / empty | {"declared": "handstand"} | Inverted palm support only; empty hands. Existing hold source is identified. Entry and interrupted lowering are unbound support transitions, never standing material. |
| `leg_stretch` | standing / empty | {"declared": "leg_stretch"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `air_walker` | standing / empty | {"declared": "air_walker"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `waist_twister` | standing / empty | {"declared": "waist_twister"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `talk_gesture` | standing / empty | {"declared": "talk_gesture"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `whisper` | standing / empty | {"declared": "whisper"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `talk_accuse` | standing / empty | {"declared": "talk_accuse"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `interview_answer` | standing / empty | {"declared": "interview_answer"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `listen` | standing / empty | {"declared": null} | Explicitly unbound semantic action; do not substitute a similarly named clip. |
| `interview_question` | standing / microphone | {"declared": "interview_question"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `interview_listen` | standing / microphone | {"declared": null} | Unbound at the short-answer encounter layout: its existing partner is interview_describe at 1.2 m, versus question/answer at 0.9 m. |
| `chess_think` | seated / empty | {"declared": "chess_think"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `chess_move` | seated / empty | {"declared": "chess_move"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `chess_watch` | standing / empty | {"declared": "chess_watch"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `walk_child_hand_down` | standing / empty | {"declared": "walk_child_hand_down"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `child_hold_hand_walk` | standing / empty | {"declared": null} | Missing child-side clip. Adult clip is not reused or scaled for the child. |
| `walk_dog` | standing / leash | {"declared": "walk_dog"} | Human gait source identified; actual dog and leash coupling/playback remain separate from the text animal adapter. |
| `startle` | standing / empty | {"declared": "startle"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `recoil` | standing / empty | {"declared": "recoil"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `stumble` | standing / empty | {"declared": "stumble"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `sit_ground_dazed_hold` | ground_seated / empty | {"declared": "sit_ground_dazed_hold"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `stand_watch` | standing / empty | {"declared": "stand_watch"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `give_held` | standing / held item | {"declared": null} | Generic specified-object giving is unbound; existing give_item supports only its small-object contact contract. |
| `seat_lower` | standing / declared text states; conditional source only | {"declared": null} | Explicit missing transition for step/chess/cafe seat markers; never binds bench sit_down. |
| `seat_rise` | seated / declared text states; conditional source only | {"declared": null} | Explicit missing transition for step/chess/cafe seat markers; never binds bench stand_up. |
| `walk_open_book` | standing / book | {"declared": null} | Missing open-book carrying gait; the available walk_hold_front carries a closed book. |
| `support_latch` | all / empty | {"declared": null} | Unbound controlled entry/contact transition across declared poses; follows the profile entry path, not an unrestricted animation. |
| `support_release` | all / declared text states; conditional source only | {"declared": null} | Unbound bounded safe stop/unload. Includes cycling dismount, slide bottom exit, suspension/palm lowering and shared-load release; source hold clips do not cover these transitions. |
| `support_wait` | all / declared text states; conditional source only | {"declared": null} | Unbound waiting at actual posture; not an empty-hand standing clip at arbitrary support. |
| `push_cart` | standing / empty | {"declared": "push_cart"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `push_stroller` | standing / empty | {"declared": "push_stroller"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `pull_suitcase` | standing / empty | {"declared": null} | Unbound: the same-name source describes carrying a shopping bag, not pulling a wheeled case. |
| `ride_bicycle` | supported_seated / empty | {"declared": "ride_bicycle"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `ride_scooter` | supported_seated / empty | {"declared": "ride_scooter"} | Seated motor scooter source only, both hands on handlebars. Does not cover a standing kick scooter. |
| `swing_seated` | supported_seated / empty | {"declared": "swing_seated"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `slide_seated` | supported_seated / empty | {"declared": "slide_seated"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `seesaw_seated` | supported_seated / empty | {"declared": "seesaw_seated"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `seesaw_partner` | supported_seated / empty | {"declared": "seesaw_partner"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `pullup_raise` | hanging / empty | {"declared": "pullup_raise"} | Hanging source only. Ground-to-bar attachment and lowering are separately unbound; pullup_hold alone does not prove safe entry/exit. |
| `hold_door` | standing / empty | {"declared": "hold_door"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `hail_taxi` | standing / empty | {"declared": "hail_taxi"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `car_ride` | supported_seated / empty | {"declared": null} | Unbound passenger seat hold. car_enter/car_exit describe a driver seat and do not cover passenger boarding/exit or this seated hold. |
| `assist_elder_walk` | standing / empty | {"declared": "assist_elder_walk"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `elder_assisted_walk` | standing / empty | {"declared": "elder_assisted_walk"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `help_up` | standing / empty | {"declared": null} | Unbound helper-side shared weight transfer; no help_up source/export exists. |
| `helped_up` | lying / empty | {"declared": null} | Unbound lying recipient-side weight transfer; no helped_up source/export exists. Ground-seated input has its own unbound action/profile, under the same scored row. |
| `phone_call` | standing / phone | {"declared": "phone_call"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `walk_phone_call` | standing / phone | {"declared": "walk_phone_call"} | Identified source matches the declared posture, prop/empty-hand and facility role; contact/playback remains unverified. |
| `support_prepare` | standing / empty | {"declared": null} | Unbound standing, empty-hand preparation. Uses shared rise/stow/approach before a support claim; not a mounting animation. |
| `open_fixture` | standing / empty | {"declared": null} | Unbound standing empty-hand manual route operation. Existing push_door/pull_door require their own provider/side/contact markers; neither is bound at an arbitrary text obstruction. Presence alone never opens this manual door. |
| `helped_up_ground_seated` | ground_seated / empty | {"declared": null} | Unbound ground-seated recipient-side weight transfer. Same controller as lying transfer, separate actual pose declaration. No source/export exists. |

## Batch 4 concrete scene and verification cost

Each activated row changes table.json at the locations above. The extra two files below are the real demonstration and deterministic validation work, not per-row engine branches. Common integration also changes system.gd, cooperation.gd, activities.gd, demo.gd, check_text_behavior.gd, one obsolete check_text_behavior_3.gd boundary assertion, scan_text_behavior.gd and audit_text_behavior.py; supports.gd is shared development. services.fruit.queue_connection opts an existing service into the same explicit connection/body-work primitive; no old row declaration changes. Documentation/material audit changes are separately charged in impl-report-4.md. No new preference tag or existing personal coefficient was required.

| Activated row | demo.json content | check_text_behavior_4.gd case | Row-specific implementation files |
|---|---|---|---|
| `hold_door` | devices.Door | doors | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `push_cart` | devices.Cart | movers / interruptions / doors | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `push_stroller` | devices.Stroller | movers / interruptions / doors | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `pull_suitcase` | devices.Case | movers | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `ride_bicycle` | devices.Bicycle | movers / interruptions / support_conflicts | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `ride_scooter` | devices.Scooter | movers / interruptions | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `hail_taxi` | devices.Taxi | vehicles | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `enter_car` | devices.Car | vehicles | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `exit_car` | devices.Car / devices.Taxi | vehicles | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `assist_person` | devices.Assistance | shared_weight | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `accept_assistance` | devices.Assistance | shared_weight | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `help_fallen` | devices.Ground_Lift; scheduled_events[0].options can_rise/life; existing Fallen consent | shared_weight / support_conflicts | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `play_seesaw` | devices.Seesaw | mechanisms | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `slide_seated` | devices.Slide | mechanisms / interruptions | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `swing_seated` | devices.Swing | mechanisms / interruptions | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `do_pullups` | devices.Bar | mechanisms / interruptions | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `phone_call` | calls.scene_call / queue_call + people.Caller + call_endings; services.fruit.queue_connection shared setting | connections / queued_connection (with existing buy_stuff) | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |
| `handstand` | devices.Palm_Space | mechanisms / interruptions | 3: table.json, demo.json, check_text_behavior_4.gd; shared engine charged once |

Scene baseline comparison: all 24/24 existing personal coefficient maps unchanged; 19 people and 15 text devices added. Existing scheduled/manual fall options change in the same JSON file.
