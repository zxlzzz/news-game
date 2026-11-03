# Batch 3 catalog and authoring audit

Every inventory entry is accounted for below. `walk` maps to existing `stroll`; queue, serve_customer and pass_door are internal work, never extra scored rows. `idle` and disabled adjust_clothes are retained implementation entries.

Rows were materialized as a batch. The deterministic check removes/re-adds every enabled row and compares all other data. This is a reproducible independent-addition check, not a claim that separate commits or timings were measured.

Unless marked demo.json, row/content locations below are in `godot/npc/text_behavior/table.json`. Shared engine development is charged explicitly in impl-report-3.md; the column lists first introductions of shared content definitions, not free engine support.

| Row | State / template | Changed content locations | Files for content |
|---|---|---|---|
| `idle` | direct | `rows.idle`, `actions.stand_idle (shared declaration changed)`, `bindings.stand_idle` | 1; existing row revisited |
| `adjust_clothes` | disabled: 需具体原因才启用（behaviors.md §9） | `rows.adjust_clothes` | 1; existing row revisited |
| `fidget` | direct | `rows.fidget`, `actions.scratch_head (shared declaration changed)`, `actions.rub_eye (shared declaration changed)`, `actions.pat_dust (shared declaration changed)`, `actions.stretch (shared declaration changed)`, `actions.check_watch (shared declaration changed)`, `actions.look_up (shared declaration changed)`, `actions.yawn (shared declaration changed)`, `bindings.look_up` | 1; existing row revisited |
| `stroll` | direct | `rows.stroll`, `actions.walk (shared declaration changed)`, `bindings.walk` | 1; existing row revisited |
| `leave` | direct | `rows.leave`, `actions.leave (shared declaration changed)`, `bindings.leave` | 1; existing row revisited |
| `sit_bench` | go_use | `rows.sit_bench`, `actions.sit_bench (shared declaration changed)` | 1; existing row revisited |
| `slouch_bench` | go_use | `rows.slouch_bench`, `actions.slouch_bench (shared declaration changed)` | 1; existing row revisited |
| `phone_browse` | use_tool | `rows.phone_browse`, `actions.phone_browse (shared declaration changed)` | 1; existing row revisited |
| `read_book` | use_tool | `rows.read_book`, `actions.read_book (shared declaration changed)` | 1; existing row revisited |
| `read_notice` | go_use | `rows.read_notice`, `actions.read_notice (shared declaration changed)`, `bindings.read_notice` | 1; existing row revisited |
| `use_fountain` | go_use | `rows.use_fountain`, `actions.fountain_drink (shared declaration changed)` | 1; existing row revisited |
| `pet_dog` | disabled: TODO: Needs animal approach/contact permission and departure interface. | `rows.pet_dog` | 1; existing row revisited |
| `handshake` | pair_once | `rows.handshake` | 1; existing row revisited |
| `tend_stall` | service_vendor | `rows.tend_stall`, `actions.choose_item (shared declaration changed)` | 1; existing row revisited |
| `buy_stuff` | service_customer | `rows.buy_stuff` | 1; existing row revisited |
| `run` | go_use | `rows.run`, `actions.run`, `demo.json people[*].tags.move (first use)` | 2; new row |
| `jog` | go_use | `rows.jog`, `actions.jog`, `demo.json people[*].tags.exercise (first use)` | 2; new row |
| `sit_sideways` | go_use | `rows.sit_sideways`, `actions.sit_sideways`, `demo.json people[*].tags.sit (first use)` | 2; new row |
| `sit_step` | go_use | `rows.sit_step`, `actions.sit_step` | 1; new row |
| `sit_on_ground` | go_use | `rows.sit_on_ground`, `actions.sit_ground_hold` | 1; new row |
| `sit_knees_up` | go_use | `rows.sit_knees_up`, `actions.sit_knees_up` | 1; new row |
| `lie_ground_hold` | go_use | `rows.lie_ground_hold`, `actions.lie_ground_hold` | 1; new row |
| `lean_wall` | go_use | `rows.lean_wall`, `actions.lean_wall` | 1; new row |
| `lean_sign` | go_use | `rows.lean_sign`, `actions.lean_sign` | 1; new row |
| `lean_railing` | go_use | `rows.lean_railing`, `actions.lean_railing` | 1; new row |
| `wait_bus` | go_use | `rows.wait_bus`, `actions.wait_standing`, `bindings.wait_standing`, `demo.json people[*].tags.wait (first use)` | 2; new row |
| `wait_person` | disabled: TODO: Needs a scene-provided current waiting person/place; no schedules or remembered appointments. | `rows.wait_person` | 1; new row |
| `browse_stall` | go_use | `rows.browse_stall` | 1; new row |
| `buy_newspaper` | disabled: TODO: Needs configured checkout and one-time collection; taking a paper is not a purchase. | `rows.buy_newspaper` | 1; new row |
| `use_vending` | disabled: TODO: Machine selection/payment/output facts are undefined; a timer must not create stock. | `rows.use_vending` | 1; new row |
| `hold_door` | disabled: TODO: Needs route-door state and actual following passage; independent navigation has no door model. | `rows.hold_door` | 1; new row |
| `push_cart` | disabled: TODO: Needs movable-object driving, handle coupling and persistent stopped-object position. | `rows.push_cart` | 1; new row |
| `push_stroller` | disabled: TODO: Needs movable-object driving, handle coupling and persistent stopped-object position. | `rows.push_stroller` | 1; new row |
| `pull_suitcase` | disabled: TODO: Needs movable-object driving; source text describes carrying a bag rather than pulling a case. | `rows.pull_suitcase` | 1; new row |
| `ride_bicycle` | disabled: TODO: Needs mounting/dismounting, vehicle movement and riding support. | `rows.ride_bicycle` | 1; new row |
| `ride_scooter` | disabled: TODO: Needs vehicle movement and riding support. | `rows.ride_scooter` | 1; new row |
| `hail_taxi` | disabled: TODO: Needs an actual taxi response/stop, vehicle seat and door state. | `rows.hail_taxi` | 1; new row |
| `enter_car` | disabled: TODO: Needs an independent current ride purpose and actual vehicle seat/door state. | `rows.enter_car` | 1; new row |
| `exit_car` | disabled: TODO: Needs actual vehicle seat support. | `rows.exit_car` | 1; new row |
| `assist_person` | disabled: TODO: Needs shared body support and support transfer when either person leaves. | `rows.assist_person` | 1; new row |
| `accept_assistance` | disabled: TODO: Needs shared body support; synchronized walking alone is insufficient. | `rows.accept_assistance` | 1; new row |
| `help_fallen` | disabled: TODO: Needs shared support transfer; help_up/helped_up clips are also missing. | `rows.help_fallen` | 1; new row |
| `play_seesaw` | disabled: TODO: Needs two-sided mechanical support and facility motion. | `rows.play_seesaw` | 1; new row |
| `slide_seated` | disabled: TODO: Needs actual position along the slide and bottom-arrival facts. | `rows.slide_seated` | 1; new row |
| `swing_seated` | disabled: TODO: Needs moving support and facility entry/exit. | `rows.swing_seated` | 1; new row |
| `do_pullups` | disabled: TODO: Needs hanging support and safe return to ground. | `rows.do_pullups` | 1; new row |
| `give_object` | pair_once | `rows.give_object`, `actions.give_held`, `actions.pair_wait (shared declaration changed)`, `bindings.pair_wait`, `pairs.gift` | 1; new row |
| `receive_object` | pair_once | `rows.receive_object` | 1; new row |
| `distribute_flyer` | disabled: TODO: Needs finite sheets and left-hand stack/right-hand transfer; single held slot cannot express both. | `rows.distribute_flyer` | 1; new row |
| `receive_flyer` | disabled: TODO: The supplying process and two-hand sheet representation are undefined. | `rows.receive_flyer` | 1; new row |
| `withdraw_cash` | sequence | `rows.withdraw_cash`, `actions.atm_keypad`, `actions.atm_take_cash`, `processes.withdraw_cash`, `demo.json people[*].tags.facility (first use)` | 2; new row |
| `collect_parcel` | sequence | `rows.collect_parcel`, `actions.parcel_terminal`, `processes.collect_parcel` | 1; new row |
| `post_letter` | sequence | `rows.post_letter`, `actions.post_letter`, `processes.post_letter` | 1; new row |
| `post_notice` | sequence | `rows.post_notice`, `actions.post_notice`, `processes.post_notice` | 1; new row |
| `throw_trash` | sequence | `rows.throw_trash`, `actions.throw_trash`, `processes.throw_trash` | 1; new row |
| `pick_up_object` | sequence | `rows.pick_up_object`, `actions.pick_up`, `processes.pick_up_object` | 1; new row |
| `rummage_bin` | go_use | `rows.rummage_bin`, `actions.rummage_bin` | 1; new row |
| `sweep_area` | go_use | `rows.sweep_area`, `actions.sweep_ground`, `demo.json people[*].tags.clean (first use)` | 2; new row |
| `mop_area` | go_use | `rows.mop_area`, `actions.mop_ground` | 1; new row |
| `water_plants` | go_use | `rows.water_plants`, `actions.water_planter_hold` | 1; new row |
| `hang_laundry` | sequence | `rows.hang_laundry`, `actions.hang_laundry`, `processes.hang_laundry` | 1; new row |
| `wipe_table` | go_use | `rows.wipe_table`, `actions.wipe_table` | 1; new row |
| `cafe_drink` | sequence | `rows.cafe_drink`, `actions.cafe_sit_drink`, `processes.cafe_drink` | 1; new row |
| `use_payphone` | sequence | `rows.use_payphone`, `actions.phone_booth_call`, `processes.use_payphone`, `demo.json people[*].tags.phone (first use)` | 2; new row |
| `eat_snack` | use_tool | `rows.eat_snack`, `actions.eat_snack`, `demo.json people[*].tags.fidget (first use)` | 2; new row |
| `drink` | use_tool | `rows.drink`, `actions.drink` | 1; new row |
| `smoke` | use_tool | `rows.smoke`, `actions.smoke` | 1; new row |
| `read_newspaper` | use_tool | `rows.read_newspaper`, `actions.read_newspaper`, `demo.json people[*].tags.read (first use)` | 2; new row |
| `selfie` | use_tool | `rows.selfie`, `actions.selfie`, `demo.json people[*].tags.record (first use)` | 2; new row |
| `phone_call` | disabled: TODO: Needs a real current phone connection and explicit end condition; do not invent one for this row. | `rows.phone_call` | 1; new row |
| `greet` | observe | `rows.greet`, `actions.wave` | 1; new row |
| `take_photo` | observe | `rows.take_photo`, `actions.take_photo` | 1; new row |
| `film_phone` | observe | `rows.film_phone`, `actions.film_phone` | 1; new row |
| `carry_to_place` | transport | `rows.carry_to_place`, `actions.walk_carry_box`, `actions.walk_carry_bag`, `actions.walk_open_book`, `actions.walk_closed_umbrella`, `actions.walk_hold_front`, `transports.carried`, `demo.json people[*].tags.carry (first use)` | 2; new row |
| `walk_with_umbrella` | transport | `rows.walk_with_umbrella`, `actions.walk_umbrella`, `transports.umbrella` | 1; new row |
| `perform_guitar` | go_use | `rows.perform_guitar`, `actions.play_guitar`, `demo.json people[*].tags.perform (first use)` | 2; new row |
| `exercise` | go_use | `rows.exercise`, `actions.exercise` | 1; new row |
| `tai_chi` | go_use | `rows.tai_chi`, `actions.tai_chi` | 1; new row |
| `handstand` | disabled: TODO: Persistent palm support and interrupted return to ground are not represented by the current body support model. | `rows.handstand` | 1; new row |
| `leg_stretch` | go_use | `rows.leg_stretch`, `actions.leg_stretch` | 1; new row |
| `use_air_walker` | go_use | `rows.use_air_walker`, `actions.air_walker` | 1; new row |
| `use_waist_twister` | go_use | `rows.use_waist_twister`, `actions.waist_twister` | 1; new row |
| `chat` | conversation | `rows.chat`, `actions.talk_gesture`, `actions.listen`, `conversations.chat`, `demo.json people[*].tags.talk (first use)` | 2; new row |
| `whisper` | conversation | `rows.whisper`, `actions.whisper`, `conversations.whisper` | 1; new row |
| `argue` | conversation | `rows.argue`, `actions.talk_accuse`, `conversations.argue` | 1; new row |
| `interview` | conversation | `rows.interview`, `actions.interview_question`, `actions.interview_listen`, `actions.interview_answer`, `conversations.interview` | 1; new row |
| `answer_interview` | conversation | `rows.answer_interview` | 1; new row |
| `play_chess` | object_activity | `rows.play_chess`, `actions.chess_move`, `actions.chess_think`, `actions.chess_watch`, `object_activities.chess`, `demo.json people[*].tags.chess (first use)` | 2; new row |
| `watch_chess` | object_activity | `rows.watch_chess`, `demo.json people[*].tags.watch (first use)` | 2; new row |
| `walk_with_child` | move_together | `rows.walk_with_child`, `actions.walk_child_hand_down`, `actions.child_hold_hand_walk`, `journeys.child`, `demo.json people[*].tags.care (first use)` | 2; new row |
| `follow_adult` | move_together | `rows.follow_adult` | 1; new row |
| `walk_dog` | move_together | `rows.walk_dog`, `actions.walk_dog`, `journeys.dog` | 1; new row |
| `react_startle` | event_response | `rows.react_startle`, `actions.startle`, `responses.startle`, `demo.json people[*].tags.react (first use)` | 2; new row |
| `protect_self` | event_response | `rows.protect_self`, `actions.recoil`, `responses.protect` | 1; new row |
| `recover_balance` | event_response | `rows.recover_balance`, `actions.stumble`, `responses.balance` | 1; new row |
| `rest_after_fall` | event_response | `rows.rest_after_fall`, `actions.sit_ground_dazed_hold`, `responses.rest` | 1; new row |
| `watch_event` | event_response | `rows.watch_event`, `actions.stand_watch`, `responses.watch` | 1; new row |

Common body/preparation additions are charged once: ground_poses, seats, bindings; get_up_ground, sit_ground, lie_down, seat_lower, seat_rise and expanded preparation posture contracts. Unused action declarations are retained and audited, not silently counted as enabled behavior.

| Inventory entry | Coverage |
|---|---|
| `accept_assistance` | disabled: TODO: Needs shared body support; synchronized walking alone is insufficient. |
| `answer_interview` | enabled: answer_interview |
| `argue` | enabled: argue |
| `assist_person` | disabled: TODO: Needs shared body support and support transfer when either person leaves. |
| `browse_stall` | enabled: browse_stall |
| `buy_newspaper` | disabled: TODO: Needs configured checkout and one-time collection; taking a paper is not a purchase. |
| `buy_stuff` | enabled: buy_stuff |
| `cafe_drink` | enabled: cafe_drink |
| `carry_to_place` | enabled: carry_to_place |
| `chat` | enabled: chat |
| `collect_parcel` | enabled: collect_parcel |
| `distribute_flyer` | disabled: TODO: Needs finite sheets and left-hand stack/right-hand transfer; single held slot cannot express both. |
| `do_pullups` | disabled: TODO: Needs hanging support and safe return to ground. |
| `drink` | enabled: drink |
| `eat_snack` | enabled: eat_snack |
| `enter_car` | disabled: TODO: Needs an independent current ride purpose and actual vehicle seat/door state. |
| `exercise` | enabled: exercise |
| `exit_car` | disabled: TODO: Needs actual vehicle seat support. |
| `fidget` | enabled: fidget |
| `film_phone` | enabled: film_phone |
| `follow_adult` | enabled: follow_adult |
| `give_object` | enabled: give_object |
| `greet` | enabled: greet |
| `hail_taxi` | disabled: TODO: Needs an actual taxi response/stop, vehicle seat and door state. |
| `handshake` | enabled: handshake |
| `handstand` | disabled: TODO: Persistent palm support and interrupted return to ground are not represented by the current body support model. |
| `hang_laundry` | enabled: hang_laundry |
| `help_fallen` | disabled: TODO: Needs shared support transfer; help_up/helped_up clips are also missing. |
| `hold_door` | disabled: TODO: Needs route-door state and actual following passage; independent navigation has no door model. |
| `interview` | enabled: interview |
| `jog` | enabled: jog |
| `lean_railing` | enabled: lean_railing |
| `lean_sign` | enabled: lean_sign |
| `lean_wall` | enabled: lean_wall |
| `leave` | enabled: leave |
| `leg_stretch` | enabled: leg_stretch |
| `lie_ground_hold` | enabled: lie_ground_hold |
| `mop_area` | enabled: mop_area |
| `pass_door` | TODO: route-door capability |
| `perform_guitar` | enabled: perform_guitar |
| `pet_dog` | disabled: TODO: Needs animal approach/contact permission and departure interface. |
| `phone_browse` | enabled: phone_browse |
| `phone_call` | disabled: TODO: Needs a real current phone connection and explicit end condition; do not invent one for this row. |
| `pick_up_object` | enabled: pick_up_object |
| `play_chess` | enabled: play_chess |
| `play_seesaw` | disabled: TODO: Needs two-sided mechanical support and facility motion. |
| `post_letter` | enabled: post_letter |
| `post_notice` | enabled: post_notice |
| `protect_self` | enabled: protect_self |
| `pull_suitcase` | disabled: TODO: Needs movable-object driving; source text describes carrying a bag rather than pulling a case. |
| `push_cart` | disabled: TODO: Needs movable-object driving, handle coupling and persistent stopped-object position. |
| `push_stroller` | disabled: TODO: Needs movable-object driving, handle coupling and persistent stopped-object position. |
| `queue` | service queue |
| `react_startle` | enabled: react_startle |
| `read_book` | enabled: read_book |
| `read_newspaper` | enabled: read_newspaper |
| `read_notice` | enabled: read_notice |
| `receive_flyer` | disabled: TODO: The supplying process and two-hand sheet representation are undefined. |
| `receive_object` | enabled: receive_object |
| `recover_balance` | enabled: recover_balance |
| `rest_after_fall` | enabled: rest_after_fall |
| `ride_bicycle` | disabled: TODO: Needs mounting/dismounting, vehicle movement and riding support. |
| `ride_scooter` | disabled: TODO: Needs vehicle movement and riding support. |
| `rummage_bin` | enabled: rummage_bin |
| `run` | enabled: run |
| `selfie` | enabled: selfie |
| `serve_customer` | service vendor internal work |
| `sit_bench` | enabled: sit_bench |
| `sit_knees_up` | enabled: sit_knees_up |
| `sit_on_ground` | enabled: sit_on_ground |
| `sit_sideways` | enabled: sit_sideways |
| `sit_step` | enabled: sit_step |
| `slide_seated` | disabled: TODO: Needs actual position along the slide and bottom-arrival facts. |
| `slouch_bench` | enabled: slouch_bench |
| `smoke` | enabled: smoke |
| `sweep_area` | enabled: sweep_area |
| `swing_seated` | disabled: TODO: Needs moving support and facility entry/exit. |
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

The source text, setup post/prop/partner and exact table line are preserved in asset-audit-3.json. A source name proves neither geometry nor playback acceptance.

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
| `handstand` | standing / empty | {"declared": "handstand"} | Source identified but high-level row disabled: persistent palm support and interrupted recovery are undefined. |
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
