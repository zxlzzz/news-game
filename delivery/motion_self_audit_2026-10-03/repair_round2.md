# Second motion repair batch — 2026-10-03

Continuation authorized by Hsinlung. No commits, memo edits, street-demo changes or new generated performances.

## Retained changes

`skeleton_mapping.gd` and its JS counterpart now clear the head by rotating the complete arm about the neck root, preserving its lengths and elbow shape. The former elbow-circle solver could lose all feasible solutions, displace the wrist, then switch to a distant feasible elbow on the next smooth source frame. Duck-cover demonstrates this branch discontinuity. Source gestures and accepted body proportions are preserved; clearance can move the hand when the figure proportions otherwise cause intersection.

`clip_pose.gd` clears interpolated arm geometry before object contacts. Clear native endpoints alone do not keep a curved interpolated forearm outside the head. Named hand endpoints stay attached; poses are derived deterministically without accumulated playback state.

Closed-umbrella hand contact now explicitly bends the elbow downward. Its nearly straight source arm does not provide a stable bend plane for the substantially different object grip target. The fixed grip remains unchanged; the contact stops inheriting an unstable source bend sign.

Empty-ground root travel no longer adds the source's vertical displacement a second time. ClipPose retains the unit's vertical movement; adding rise again doubled stair ascent/descent. Within-unit root travel now adds only the horizontal displacement removed by ClipPose.

Human endpoint resources were refreshed after these changes. Useful rest-pose and theoretical compatibility review remains open.

## Verification

All 241 human entries were exported and analyzed again at 51,068 timeline positions. The final stage-only stair change was re-exported for both stairs entries; `second_final_metrics.json` merges that final result into the exhaustive pass. No greater-than-5% limb shortening remains. Head-overlap candidates greater than 10 mm decrease from six to five; no new entry crosses that threshold versus the first repair batch.

Duck-cover peak left elbow speed drops from 10.72 to 2.77 m/s. Its final forearm/head clearance is zero within float precision throughout the checked timeline. Closed-umbrella peak right elbow speed drops from 11.24 to 1.03 m/s. These measurements address the identified corrections, not gesture quality or full acceptance.

Full-duration front/side filmstrips were inspected for duck_cover, walk_closed_umbrella, cheer, cross_arms, hands_on_head and wave_overhead_v3 (`second_visual/`, about 8 FPS). Duck-cover no longer flips the elbow late in its held crouch. Umbrella keeps a stable grip and downward elbow while walking. Cheer retains visibly separated raised hands; cross-arms retains its accepted crossed silhouette. These observations do not assert that the native mapping is byte-identical: head-collision correction changes affected poses. Hands-on-head still has contact-driven head crowding; the wave continuation still lacks an independent complete action.

JS/GD parity passes MAPPING_OK. The exhaustive length/contact regression passes MOTION_CONTINUITY_OK; the added real duck-cover regression checks that neighboring smooth source frames do not flip its arm. Interaction checks pass INTERACTIONS_OK. Final retained code passes MOTION_PLAYBACK_OK and FOOT_GROUND_OK. The playback regression explicitly checks that stairs do not add vertical source travel twice. Both final stairs exports complete without contact errors.

## Stair support remains unresolved

A trial queried the displayed paving body triangles instead of a flat floor. That exposed a new discontinuity when a foot crossed a tread boundary: down-stairs right-knee speed reached 8.21 m/s. The trial support correction was removed; its evidence remains in `second_stairs/` and `second_stairs_visual/`. Final retained stairs output is in `second_stairs_final/` and `second_stairs_final_visual/`. Both final stairs filmstrips were individually inspected over their complete durations in front/side views; rail and equipment occlusion still limits assessment. Both final stairs entries have no joint-speed flag above 6 m/s, but this does not validate actual tread contact. The source footfall timing, model placement and stair edge clearance must be reconciled together. Do not mark stairs repaired merely because floor checks pass.

Five head-overlap candidates remain: basketball_dribble, hands_on_head, hang_laundry, phone_booth_call and rummage_bin. Semantic action units, complete wave variants, interaction supply and animal review remain in root tasks.md.
