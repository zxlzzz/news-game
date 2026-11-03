# Batch 5 catalog and authoring audit

Every inventory entry is accounted for below. `walk` maps to existing `stroll`; queue, serve_customer and pass_door are internal work, never extra scored rows. `idle` and disabled adjust_clothes are retained implementation entries.

Rows were materialized as a batch. The deterministic check removes/re-adds every enabled row and compares all other data. This is a reproducible independent-addition check, not a claim that separate commits or timings were measured.

Unless marked demo.json, row/content locations below are in `godot/npc/text_behavior/table.json`. Shared engine development is charged explicitly in impl-report-5.md; the column lists first introductions of shared content definitions, not free engine support.

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
| `pet_dog` | current_task | `rows.pet_dog`, `actions.pet_contact`, `current_tasks.animal_contact` | 1; existing row revisited |
| `handshake` | pair_once | unchanged | 0; unchanged row |
| `tend_stall` | service_vendor | unchanged | 0; unchanged row |
| `buy_stuff` | service_customer | unchanged | 0; unchanged row |
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
| `wait_person` | current_task | `rows.wait_person`, `actions.wait_current_person`, `current_tasks.await_person` | 1; existing row revisited |
| `browse_stall` | go_use | unchanged | 0; unchanged row |
| `buy_newspaper` | sequence | `rows.buy_newspaper`, `actions.select_product`, `actions.pay_terminal`, `actions.await_stock_output`, `actions.take_newspaper`, `processes.newspaper_checkout` | 1; existing row revisited |
| `use_vending` | sequence | `rows.use_vending`, `actions.vending_collect`, `processes.vending_checkout` | 1; existing row revisited |
| `hold_door` | support_use | unchanged | 0; unchanged row |
| `push_cart` | support_use | unchanged | 0; unchanged row |
| `push_stroller` | support_use | unchanged | 0; unchanged row |
| `pull_suitcase` | support_use | unchanged | 0; unchanged row |
| `ride_bicycle` | support_use | unchanged | 0; unchanged row |
| `ride_scooter` | support_use | unchanged | 0; unchanged row |
| `hail_taxi` | support_use | unchanged | 0; unchanged row |
| `enter_car` | support_use | unchanged | 0; unchanged row |
| `exit_car` | support_use | unchanged | 0; unchanged row |
| `assist_person` | support_use | unchanged | 0; unchanged row |
| `accept_assistance` | support_use | unchanged | 0; unchanged row |
| `help_fallen` | support_use | unchanged | 0; unchanged row |
| `play_seesaw` | support_use | unchanged | 0; unchanged row |
| `slide_seated` | support_use | unchanged | 0; unchanged row |
| `swing_seated` | support_use | unchanged | 0; unchanged row |
| `do_pullups` | support_use | unchanged | 0; unchanged row |
| `give_object` | pair_once | unchanged | 0; unchanged row |
| `receive_object` | pair_once | unchanged | 0; unchanged row |
| `distribute_flyer` | pair_once | `rows.distribute_flyer`, `actions.offer_sheet`, `actions.accept_sheet`, `actions.hold_supply`, `actions.draw_container_item`, `pairs.finite_supply` | 1; existing row revisited |
| `receive_flyer` | pair_once | `rows.receive_flyer` | 1; existing row revisited |
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
| `phone_call` | connection | unchanged | 0; unchanged row |
| `greet` | observe | unchanged | 0; unchanged row |
| `take_photo` | observe | unchanged | 0; unchanged row |
| `film_phone` | observe | unchanged | 0; unchanged row |
| `carry_to_place` | transport | unchanged | 0; unchanged row |
| `walk_with_umbrella` | transport | unchanged | 0; unchanged row |
| `perform_guitar` | go_use | unchanged | 0; unchanged row |
| `exercise` | go_use | unchanged | 0; unchanged row |
| `tai_chi` | go_use | unchanged | 0; unchanged row |
| `handstand` | support_use | unchanged | 0; unchanged row |
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

Baseline comparison: 90 previously enabled rows; 90 unchanged. Changed existing actions: . Shared engine/preparation costs are charged in the implementation report; table-only content cost does not include that platform work.

| Inventory entry | Coverage |
|---|---|
| `accept_assistance` | enabled: accept_assistance |
| `answer_interview` | enabled: answer_interview |
| `argue` | enabled: argue |
| `assist_person` | enabled: assist_person |
| `browse_stall` | enabled: browse_stall |
| `buy_newspaper` | enabled: buy_newspaper |
| `buy_stuff` | enabled: buy_stuff |
| `cafe_drink` | enabled: cafe_drink |
| `carry_to_place` | enabled: carry_to_place |
| `chat` | enabled: chat |
| `collect_parcel` | enabled: collect_parcel |
| `distribute_flyer` | enabled: distribute_flyer |
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
| `pet_dog` | enabled: pet_dog |
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
| `receive_flyer` | enabled: receive_flyer |
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
| `use_vending` | enabled: use_vending |
| `use_waist_twister` | enabled: use_waist_twister |
| `wait_bus` | enabled: wait_bus |
| `wait_person` | enabled: wait_person |
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

The source text, setup post/prop/partner and exact table line are preserved in asset-audit-5.json. A source name proves neither geometry nor playback acceptance.

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
| `walk_loaded` | standing / {"left": "any", "right": "any"} | {"declared": null} | Unbound movement with independently held left/right objects. Empty-hand walking material is never borrowed for this state. |
| `pet_contact` | standing / empty | {"declared": null} | Missing standing animal-contact clip; requires current dog approach/contact permission and stationary anchor. No humanoid action is assigned to the dog. |
| `wait_current_person` | standing / empty | {"declared": "stand_idle"} | Standing empty-hand stand_idle, alternating with existing standing check_watch through the current-task action pool. Arrival remains an actual subject event; nervous looking/pace are optional situation-specific materials, not invented anxiety. |
| `select_product` | standing / {"left": "empty", "right": "any"} | {"declared": null} | Unbound standing selection of one actual finite stock item. It is not the completed purchase. |
| `pay_terminal` | standing / phone | {"declared": null} | Missing phone payment at a declared terminal. Cash-on-counter pay source is not substituted for machine payment. |
| `await_stock_output` | standing / declared text states; conditional source only | {"declared": null} | Unbound standing machine/provider wait. Release moves the already-paid existing stock item onto the configured output; elapsed time creates no item. |
| `take_newspaper` | standing / empty | {"declared": "buy_newspaper"} | Bound buy_newspaper: standing empty-hand entry, one real paid folded newspaper becomes right-held at assigned native right-hand speed minimum f32. Whole native 70-frame source retained; normal interruptible tail follows the committed pickup. Checkout is separate. |
| `vending_collect` | standing / empty | {"declared": "vending_collect"} | Bound existing lidded-coffee-CUP retrieval: standing empty entry, actual transaction product cup, right pickup at assigned low forward reversal f39. Added held_coffee_cup/right result setup; provider output already exists before collecting. Whole 70-frame source retained. |
| `draw_container_item` | standing / {"right": "paper_stack", "left": "empty"} | {"declared": null} | Missing finite-container draw: RIGHT stack/LEFT empty. Native pictures show LEFT extensions while RIGHT stays beside hip; no visible hand-to-stack draw. Existing whole source is not borrowed for a separate preparation. |
| `offer_sheet` | standing / {"right": "paper_stack", "left": "paper"} | {"declared": null} | Unbound RIGHT-stack/LEFT-sheet offer. Native distribute_flyer makes three distinct extensions (f18,83,111–117), not one clear draw/offer/retract. Source text hand claim is wrong; existing RIGHT-stack setup already matches passive hand and is unchanged. A single matched offer source remains needed. |
| `accept_sheet` | standing / empty | {"declared": "receive_flyer"} | Bound existing receive_flyer: standing empty entry, RIGHT hand first forward low-speed pause at assigned f26, then withdraws. Added right held_flyer result attachment. Physical pair contact remains unverified while giver material is missing; this binding identifies the usable receiving-side source. |
| `hold_supply` | standing / {"right": "paper_stack", "left": "any"} | {"declared": null} | Missing standing RIGHT-stack/LEFT-optional holding wait. Empty-hand idle/wait material does not cover this state. |

## Batch 5 concrete authoring and scene cost

Six existing disabled entries are enabled. Each row changes table.json, demo.json and check_text_behavior_5.gd: three concrete content/demonstration/check files. Shared engine work is charged once in impl-report-5.md, not hidden in the one-row content claim. The shared walk_loaded preparation declaration is introduced independently of the rows. Standing wait/watch, newspaper, cup and receiving-side sources are bound after native-frame review; remaining material gaps and exact setup data are in asset-audit-5.json.

| Row | Existing executor / new shared definition | Actual scene content | Deterministic case |
|---|---|---|---|
| `pet_dog` | work/action_preview; current_tasks.animal_contact | current_tasks.scene_pet; Dog_Petter; animals.Contact_Dog with two permissions | live_tasks |
| `wait_person` | same current_task adapter | current_tasks.scene_wait; Current_Waiter/Current_Arriver; posts.current_meeting | live_tasks |
| `buy_newspaper` | existing sequence; processes.newspaper_checkout transaction profile | checkouts.scene_paper; finite_paper; stock/output; Paper_Buyer phone and one authorization | transactions: every stage cut/resume |
| `use_vending` | same sequence/transaction adapter | checkouts.scene_vend; finite cup; stock/output; Vending_Buyer phone and one authorization | transactions: every stage cut/resume |
| `distribute_flyer` | existing pair_once; finite_supply optional draw contract | Flyer_Giver right finite_stack; two actual contained paper IDs; transfer_intents.scene_sheet | hands_and_transfer: draw, two held objects, joint cut/resume |
| `receive_flyer` | same pair_once and atomic transfer | Flyer_Receiver chooses independently; same actual scene_sheet intent | hands_and_transfer: empty receiver, stale/duplicate commit rejection |

Shared implementation changes: system.gd (hand preparation/effect/access), activities.gd (task and sequence checkout adapters), cooperation.gd (optional finite supply and captured-instance cancellation). No row-name dispatch or new per-behavior controller. Shared scene import, check integration, scanner evidence and source audit also changed. Follow-up changes only vending_collect/receive_flyer item attachments in clip-setup; all other clip bytes are unchanged (attachment-diff receipt). No supports.gd, physical model, motion, playback, main scene, memory or CLAUDE file changed.

Scene baseline: 43/43 previous personal coefficient maps unchanged. Seven actors added; all prior90 enabled rows and135 action declarations are identical. Existing tag names are reused; no personal coefficient field was added.

