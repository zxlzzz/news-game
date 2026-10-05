# Human motion inspection, 2026-10-02

No production files changed. `human_findings.json` holds the precise findings and `human_coverage.json` records all 239 clips. The current reviewer actually viewed all 147 standalone clips (37 sheets, 24 times in each of two views), plus the five requested priority clips. Interaction and partner visual review belongs to the interaction reviewer; all 239 clips received numeric source, native mapping and actual Godot pre/final coverage here.

The numeric screen covers 25,340 original native source frames and 28,680 actual Godot samples. The runtime sampling interval is stage cycle /120, not a native 30fps frame. Three clips have an additional 15 exact Godot times each. Sparse screenshots cannot establish continuous playback quality. `screened_no_additional_confirmed_issue_at_sampled_views` means no extra confirmed issue found in those views; it does not mean PASS.

## Confirmed

1. General arm/head relation mapping can amplify continuous source wrist movement. At phone_urgent 0.0667→0.1s, the source wrist changes 6.8cm at figure leg scale but the actual mapped right hand changes 57.3cm. The early 30fps render confirms the jump. Elder_assisted_walk has 29.0cm and 26.3cm left-hand changes against source wrist changes of 1.75cm and 0.59cm. Duck_cover 1.5667→1.6s has 20.5cm versus 4.66cm. Exact source/pre/final diagrams locate these before later contact correction.

   Pure in-memory diagnostic variants isolate contributions without editing production or proposing a fix: phone_urgent's spread rule accounts for much of its amplification (57.3→14.8cm when disabled); elder's second jump similarly falls 26.3→1.32cm; duck_cover's head-touch weight moves 0.0349→0.9414 in one native frame, and disabling that relation reduces 20.5→9.68cm. Elder's first jump needs more isolation. These examples do not establish a universal IK-pole bug.

2. Handstand loses the action's support relation. Source wrists are 3.8/7.2cm above the source floor; actual final wrists are about 35.9/35.6cm below the world floor. Source/pre/final comparison and both rendered views show arms already going below ground at mapping, while the head correction makes the head touch the floor. This is a loss of palm support, distinct from accepted upright arm-spread styling.

3. Source instability also exists. Walk_backpack_straps' right elbow briefly drops/returns at native frames8/10 (31.7/33.0cm scaled source changes); fruit_weigh's right elbow flips at109/110 (34.5/36.5cm) while its wrist stays nearly fixed; vending_collect's right wrist drops/returns at98/99 (41.5/39.7cm). The source comparison preserves these excursions. Mapping can amplify them, but source generation is part of the cause.

4. Preview replay is a separate layer: 99 clips without a repeated endpoint still use default looping. Some explicitly declare non-loop playback and some lack loop metadata; the coverage file preserves unknown metadata as null. ClipPose interpolates from their final pose to frame0 in one native-frame interval. Scratch_head, stand_up and trip_fall have very different source endpoint poses. This explains abrupt returns in repeated preview playback; it does not mean all these source files are defective loops.

## Not confirmed

The remaining numerical candidates are scratch_head, shadow_box, wave_overhead, walk_cold, vendor_tidy, atm_take_cash, basketball_shoot and bike_scan_unlock. They require exact-time rendered and semantic review; large mapped change alone is insufficient. The JSON retains their candidate status rather than calling them PASS or defects.

Some exact contact/gait relations remain hidden by props: atm_keypad, choose_item, read_notice, sit_step, vendor_call/vendor_tidy, walk_stairs_up/down and vending_collect. The coverage file names the missing view relation. Run_curve was re-screened in all 24 double-view frames after the inspection camera was corrected; original crop/scale was an inspection-tool problem and is not reported as a game defect.

Accepted cheer overhead separation, cross_arms frontal cross, photo_overhead real frontal occlusion and the general minSpread/body proportion tradeoffs are retained. No recommendation or fix is included in this check-only inspection.

## Reusable evidence tools

- `human_mapping_scan.mjs`: current shared mapper over every exported native frame.
- `human_runtime_scan.py`: raw source and actual runtime metrics, respecting source phase and varying stage-cycle sample spacing.
- `human_compare.py`: raw source versus actual Godot pre/final diagrams in the same actor frame.
- `human_mapper_trace.mjs`: internal relation trace and diagnostic parameter interventions entirely in memory.
- `human_extra_evidence.py`: support and source-event evidence.
- `standalone_contact_sheets.py`: the complete 147-clip standalone visual screen.
- `human_review_report.py`: per-clip reviewed coverage and findings.
