# First motion repair batch — 2026-10-03

Authorized by Hsinlung's request to create tasks.md and begin fixes. No commit, memo update or street-demo edit. The original audit is the before-repair snapshot; no individual motion receives complete acceptance from this batch.

## Changes

- `godot/npc/clip_pose.gd`: interpolate segment directions and lengths, then rebuild the connected body. Linear endpoint interpolation previously shortened articulated limbs between native frames. Hand endpoints remain attached.
- `godot/npc/contact_pose.gd`: transport the original elbow/knee bend plane to the target direction. Projecting an unrelated source segment onto the target plane could switch bend direction abruptly.
- `godot/npc/interactions.json`: explicit bend directions for slide and swing hand contacts. The initial swing change introduced a head collision; final downward bend directions remove that regression. This does not approve these procedural whole performances.
- `godot/tools/check_motion_continuity.gd`: a regression check for a tiny contact-target displacement that previously flipped the elbow, and articulated lengths at all native-frame midpoints.
- `godot/tools/audit_motion_complete.gd`: optional named-entry scope for targeted follow-up checks; default exhaustive coverage remains unchanged.
- `godot/tools/export_endpoint_pose_loops.gd`: human-only refresh preserves existing animal entries. Refreshed 482 human endpoint resources; the full catalog still contains 896 resources. File existence does not establish useful rest poses or compatibility.

## Evidence and limits

Full-timeline before/after checks cover all 241 human entries and 51,068 timeline positions. `repair_final_metrics.json` combines the exhaustive second pass with the final swing/slide follow-up, whose only subsequent production change is their hand bend directions. `repair_comparison.json` records per-person results. The original `complete_metrics.json` remains the before-repair baseline.

Entries with greater than 5% segment shortening fall from 8 to 0. The minimum final segment-length ratio is approximately 0.999998. Head overlap flags greater than 10 mm fall from 9 to 6; final output introduces no new head-overlap flag at that threshold relative to the baseline. These are geometry measurements, not acting acceptance.

Representative peak elbow speeds, measured on the same timelines (m/s):

| Motion | Before | After | Remaining work |
|---|---:|---:|---|
| pull_suitcase | 16.54 | 0.62 | Action unit and complete visual acceptance |
| browse_bookstall | 33.27 | 0.59 | Browsing meaning and object contact |
| give_item, affected participant | 18.63 | 0.79 | Independent motion supply and exchange review |
| vending_collect | 20.65 | 3.18 | Folded posture, machine occlusion/contact |
| slide_seated | 13.41 | 1.28 | Support/path and procedural performance |
| walk_closed_umbrella | 22.63 | 11.24 | Mapping still jumps; unresolved |

All nine final props-visible filmstrips were individually inspected: pull_suitcase, browse_bookstall, give_item, receive_flyer, vending_collect, walk_stairs_down, walk_closed_umbrella, swing_seated and slide_seated. They cover the entire duration at approximately 6 FPS plus jump neighborhoods, in front/side views (`repair_visual/`, backed by 60 Hz captures in `repair_final_body/`). This is time-sampled inspection, not continuous watching of every captured frame. Vending and equipment still occlude parts of the body; earlier body-only evidence is retained.

Visual findings: suitcase/bookstall and exchange elbows no longer show the former sharp branch switches in the inspected sequences. Swing elbows stay below the head after the final correction, but its body remains rigid and its performance procedural. Slide still needs support/path review. Umbrella retains the mapped jump near 0.45–0.47 seconds. Stair knees are less discontinuous, but the support model still uses a flat floor; stair motion remains unresolved.

Checks passed: MAPPING_OK, LOCOMOTION_OK, MOTION_PLAYBACK_OK, FOOT_GROUND_OK, INTERACTIONS_OK and MOTION_CONTINUITY_OK. The final interaction check includes the final swing/slide bend directions. Endpoint export returned ENDPOINT_LOOPS_OK and reload-compared each refreshed endpoint against its corrected pose.

## Next unresolved work

Continue from root tasks.md. Priorities remain mapped arm flips (duck/umbrella), final head clearance, actual stair support, complete independent wave variants, semantic action units and replacing unaccepted interaction supply. Head-overlap candidates remain basketball_dribble, hands_on_head, hang_laundry, phone_booth_call, rummage_bin and wave_overhead_v3. Animals still lack complete playback review. Do not turn reduced metrics into acceptance of these motions.
