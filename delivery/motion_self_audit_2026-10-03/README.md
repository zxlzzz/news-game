# Motion self-audit — 2026-10-03

This is the before-repair snapshot. Subsequent authorized changes and current verification limits are recorded in [repair_round1.md](repair_round1.md); the open implementation queue is [tasks.md](../../tasks.md).

Continuation repairs are recorded in [repair_round2.md](repair_round2.md). Original audit measurements below remain the before-repair evidence.

Inspection only. No production animations, mapping, interactions or scenes changed in this audit. This report supersedes the earlier incomplete eight-case report. Earlier claims that the repairs were complete are unsupported. No asset is accepted by this audit.

## Coverage and limits

- All 241 human entries have final-body front/side captures at 60 Hz including endpoints: full_body/ and full_body_rest/, 48,084 timeline positions and 96,168 rendered frames. Full pose data includes native boundaries and intervening times: full_poses/, 51,068 timeline positions. Geometry analysis covers all those poses.
- Each of the 241 entries was individually screened in a full-duration front/side filmstrip, approximately 6 FPS plus detected anomaly times. See episode_review/ and human_visual_registry.json. This is time-sampled visual screening, not individual acceptance of every captured frame or continuous playback. Capturing every frame does not mean visually accepting every frame.
- Body-only captures preserve the final contact-corrected body while hiding props. Prop grasp, support clearance, object trajectories and interpersonal contacts remain unaccepted. Camera-follow reframes are in reframed_body/ and reframed_body2/; the initial walk_stairs_up capture still crops the head late.
- All 170 breed-specific cat/dog clips and 37 bird clips received only the earlier coarse two-view screen. Their continuous visual audit remains outstanding. No animal acceptance is claimed.
- The 896 exported endpoint resources contain constant repeated endpoint poses. Their existence proves neither useful supported rest poses nor theoretical compatibility. Static files are not automatically invalid because they are static; their source poses, supports and intended holds require individual validation.

## Confirmed systemic problems

1. Fourteen interaction configurations substitute stand_idle for the named source motion: basketball_shoot, football_juggle, both table-tennis roles, air_walker, swing_seated, both seesaw roles, car_enter/exit, hold/push/pull_door and waist_twister. Targets, root transforms and fixed timelines create the visible performance. This does not establish independently usable motion or adaptation to other valid object placements. Not all 83 interactions use this substitution. A complete single-person gesture and a whole fixed interaction sequence are different deliverables.
2. Mapping destabilizes noninteractive motions. In duck_cover near 2.283–2.300 s, source upper-arm change is about 0.4 degrees while mapped change is about 36 degrees. Native-frame head avoidance can switch solutions. Linear endpoint interpolation then shortens limbs and can pass through the head between clear native poses; wave_overhead_v3 demonstrates both.
3. Final contact correction adds elbow flips in pull_suitcase, walk_closed_umbrella, browse_bookstall, item giving/receiving, flyer receiving, vending_collect and slide_seated. Successful reach and bone-length checks missed continuity and final clearance. Bend hints become unstable near collinearity; contacts run after mapped clearance without rechecking the whole final body.
4. Stairs previews feed a constant zero floor despite visible stairs and vertical root travel. In walk_stairs_down the left knee jumps about 316 mm in 16.7 ms near 1.25 s and the shins tangle near the end.
5. Some source clips already contain abrupt changes. Vendor_call and vendor_tidy have large source upper-arm changes near 2.13 and 3.75 s before contacts. Phone_urgent shortening also precedes contacts. Rapid startle/stumble/sport motion is not automatically a defect; compare source and final output.
6. Many actions have weak or wrong visible meaning: face covering at the neck, sweat wiping mostly below the forehead, taxi waving at chest/neck height, little sweeping motion, unclear button presses, and tiny inspection/page-turn gestures. These are separate from geometry failures. Prop-dependent verdicts remain explicitly uncertain.
7. The one-action requirement was not established. Previous trimming detects exact whole-body returns and skips stationary root motion. Multiple gait cycles remain in march, run and several walking variants. Gesture-bearing walks need semantic review: cutting blindly to one stride can destroy their complete hand gesture. Repeated wording in an original prompt is a review clue, not proof about a trimmed file.
8. Wave_overhead, _v2 and _v3 are lift, raised continuation and lowering subsequences, not three complete independent variants. Hop/exercise cycles also begin/end airborne or raised; exporting static endpoints does not establish useful rest holds.
9. Generated-motion constraints need review too. Fall_back uses dense authored full-body constraints, contrary to sparse-generation requirements. Source_constraints.json lists candidates; old trim durations and inclusive time boundaries mean its raw flags are not automatic violations.

## Numerical evidence

Complete_metrics.json records all measured poses. Full_review_queue.json flags 88 entries under geometric thresholds; these are review candidates, not 88 proven failures or the full set of semantic failures. Intended self-contact and shared joints require interpretation.

| Entry | Confirmed finding |
|---|---|
| pull_suitcase | Final right elbow moves about 276 mm in 16.7 ms near 0.32 s. |
| walk_closed_umbrella | Final right elbow moves about 369 mm in the first 16.7 ms; another branch jump occurs near 2.367 s. |
| browse_bookstall | Final left elbow reaches about 33 m/s near 3.55 s, versus about 1.4 m/s before contacts. |
| give_item / receive_item | Recipient right elbow reaches about 18.6 m/s near 3.6 s, versus about 1.3 m/s before contacts. |
| vending_collect | Final right elbow reaches about 20.6 m/s near 1.817 s. |
| slide_seated | Final left elbow reaches about 13.4 m/s near 2.983 s. |
| hands_on_head | Forearm/head stroke overlap reaches about 44 mm. |
| hang_laundry / phone_booth_call | Forearm/head overlap reaches about 21 / 36 mm. Body-only views expose previously obscured problems. |
| wave_overhead_v3 | Initial abrupt arm change, interpolated limb shortening and forearm/head overlap. |

## Acceptance and next boundary

This is a batch-level quality and validation failure, not eight isolated defects. Added content remains unaccepted. File validity, passing scripts, staged interactions and sparse pictures cannot establish usable animations. The all-entry registry separates observations, geometry flags and outstanding acceptance; unflagged clips are not silently marked good.

No rewrite is authorized by this inspection. Hsinlung challenged the interaction production approach; do not infer an approved primitive decomposition from that criticism. Accepted requirements remain one complete semantic action per play, complete independent variants, and useful entry/exit posture loops with theoretical compatibility. Runtime transition routing is outside the request.

Remaining inspection includes continuous playback, props/support and interpersonal clearance, cropped views, individual endpoint usefulness, and full animal playback. This report does not claim those are finished.
