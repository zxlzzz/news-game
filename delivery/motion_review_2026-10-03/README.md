# Motion corrections — 2026-10-03

Scope: asset timing, individual action units, limb mapping and independent endpoint holds. Hsinlung explicitly excluded runtime transition routing. No commits or memo edits.

## Visible changes

- Cat/dog stationary authored clips run at 1.5 times source speed. Distance-driven gait sampling keeps its foot placement.
- Selecting an empty-ground entry plays one source unit and holds its endpoint, including repeatable source clips and looping prop tracks. Replay starts at the beginning.
- 25 travelling NPZ clips containing exact whole-body repeated cycles now retain their last complete cycle. Source arrays and timing are preserved, and complete originals are archived by SHA-256 in `assets/animations/generation_inputs/`. Ranges are in `single_units.json` and the clips' `meta.json`.
- The three observed waves in `wave_overhead` are separate `wave_overhead`, `wave_overhead_v2`, `wave_overhead_v3` assets. Their start/end arm postures differ intentionally. `wave_variants.json` records native ranges; `scripts/rebuild-motion-variants.py` reproduces the cuts from archived originals.
- Nine cat/dog wag loops and the cat kneading loop contain one oscillation instead of several, preserving the original dominant oscillation rate. The bird flap loop contains one wingbeat. Shake-off and scratch remain complete single episodes: the internal oscillations are the action, rather than repeated entry/action/exit episodes.
- The mapper counts forearm stroke thickness around the head, corrects the right-arm outward direction under head tilt, and rotates the elbow on its two-bone circle when feasible. A neck/head junction is intentionally excluded from the forearm obstacle test. Bone lengths remain fixed. GD and JS mapping agree.
- Travelling feet retain separate lateral lanes in the source torso's own direction. Correction preserves foot pitch, height targets and leg lengths, with existing ground-contact correction afterwards.

## Independent endpoint loops

`godot/npc/pose_loops/index.json` maps 241 human actions, 170 breed-specific animal actions and 37 bird actions to 896 independent `__start.tres` / `__end.tres` files.

Each file is a closed **constant posture hold**, with identical first/last frames, not an added breathing animation. It stores the actual corrected actor-local endpoint. Resources retain topology and shape; context records root placement, breed, props and support requirements. A suspended/airborne endpoint still requires its recorded support/air context. These files do not establish that every endpoint is a freestanding idle pose.

Load a resource and call `sample(time)` to use it independently. Rebuild after motion/mapping/contact changes with `res://tools/export_endpoint_pose_loops.gd`. Its reload check compares resource poses with the original endpoints to a one-micrometre tolerance, then samples many periods later. Empty-ground `stage.select(source_id,{"endpoint_loop": resource_path})` permits contextual visual inspection. No transition graph, route or actual action-to-action switch logic was implemented.

## Verification

- `MAPPING_OK`: JS/GD parity.
- `MOTION_CLEARANCE_OK`: 24,423 source-rate frames; travelling foot strokes separated, forearms outside the enlarged head. This checks mapped clips, not every later object-contact adjustment.
- `FOOT_GROUND_OK`: 241 human clips, two dog walkers, slopes/scales/headings, bone lengths and neutral foot pitch.
- `MOTION_PLAYBACK_OK`: 241 human clips; one pass, endpoint hold, replay and deterministic seeking.
- `INDIVIDUAL_MOTION_OK`: 170 animal clips, 37 bird actions; named-source sampling, speed and one-pass endpoint behavior.
- `INTERACTIONS_OK`: 83 configured interaction clips at 61 phases; reach, bone lengths and deterministic seeking.
- `EMPTY_GROUND_OK`: 393 entries, no missing setup objects.
- `LOCOMOTION_OK`: animal gait, curb/stairs, riders and leash checks.
- `ANIMALS_OK`: each breed's runtime actions and recovery at 30/60/120 fps after acceleration; unchanged bone lengths, skin paw contact and successful return to walking. Behaviour runs also passed.
- Three offline animal libraries: `MOTION_LIBRARY_OK 48` each, including interpolated contacts and loop seams.
- `ENDPOINT_LOOPS_OK`: 448 actions / 896 independent resources, exported from current poses and reloaded.

`final/manifest.json` records actual capture times, options and input hashes. Captures include walk, hands-forward walk, wave variants, hanging laundry, duck/cover, ground sitting, wiping sweat, cat sitting, dog wagging, and repeated independent start/end holds for standing up. `playback/` contains synchronized front/side one-pass GIFs. These checks establish the listed geometry and playback properties; they do not certify the acting quality of every clip or all possible prop penetration.
