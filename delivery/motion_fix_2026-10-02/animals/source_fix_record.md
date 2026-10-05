# Animal NG source repair — 2026-10-02

Published batches: Husky07, Shiba03, Cat03. Each contains 48 NG clips; the dogs retain
their original 12 animations and Cat retains its original 2. `published_sources.json`
records the formal GLB hashes. All three GLBs and their contact plans/motion reports
were built twice with identical bytes. The canonical converted static models,
materials, weights, bone names and original animation/buffer prefixes are unchanged.

The shared authoring core now serves Husky as well as Shiba/Cat. Pose, timing,
frequency and anatomical references remain in the species JSON specifications.
The repair changes action organization and support rather than filtering time or
adding runtime exceptions for individual clips.

- Shake-off rolls through the longitudinal spine with delayed neck/head/tail motion;
  head shake uses its own kind and leaves the body quiet. Cat's faster 9.4 Hz source
  is baked at 60 fps, with slight crouch to retain four reachable paw contacts.
  These rates were informed by [the wet-mammal study](https://pmc.ncbi.nlm.nih.gov/articles/PMC3481573/)
  and [wet-dog shake research](https://arxiv.org/abs/1010.3279).
- Startle has a short crouch/recoil, lifted forepaws and landing, followed by recovery.
  It remains a modest alert reaction; sparse poses cannot establish its timing.
- Play bow reaches quickly with raised head and invitation beats; front stretch
  extends more slowly with lowered neck/head and a sustained hold. Final source
  review found Shiba/Cat still assigned the old `bow` kind despite separate stretch
  parameters; their final03 JSON now calls `stretch`, and the actual meshes differ.
- Lie has lowered chest/hip and limb-specific paw orientation. Sleep lowers the
  head near the forepaws. Side lie first gathers/folds the limbs, transfers support
  to the flank, then settles both chest and hip on the floor. The exit reverses the
  same articulated path. The body no longer makes a rigid quarter turn with all
  paws/head unchanged. Side motion is baked at 60 fps.
- The IK reference follows the foreleg's authored sagittal plane before lateral
  transport. Hind legs retain the authored outward/upward plane. Applying the
  foreleg transport to deeply seated hind knees had driven them down, raised the
  whole body during grounding and made the forelegs unreachable. Keeping the
  anatomical references distinct removed that chain of errors without moving
  planted paws to satisfy a restricted hock or changing bone lengths.
- Contact goals account for the actual rotated paw sole, rather than a fixed
  rest-pose offset. State blending interpolates explicit effective leg profiles;
  absent pole values no longer become zero and cause a Lie-to-Sit endpoint jump.
- Tail tuck folds the root downward and subsequent tail bones under the hip,
  between the hind legs. The old motion only lowered the tail to horizontal.
  Shiba retains its source curled-tail silhouette. Neither body nor planted paws
  is raised to avoid a tail collision. Independent side11 review confirmed the
  downward/inward tuck for all three models.
- Cat's new `NG_Threat_Arch_Enter` / `NG_Threat_Arch` / `NG_Threat_Arch_Exit` use its
  actual two opposing spine segments and four planted paws. They are 1.0 / 2.0 /
  1.2 seconds; the hold loops. The low-poly back line has a noticeable central
  corner, consistent with the original 20-bone rig. No extra ears/toes or mesh
  thickening was added. Scene/runtime configuration is owned by scene_status.

Independent exported-GLB checks cover every native key and every halfkey (60 Hz
for 30 fps clips; 120 Hz for 60 fps clips), every skinned vertex, rigid transforms,
fixed bone lengths, recorded planted/free paw trajectories, floor, loop seams and
16 dog / 19 Cat state boundaries. Each library passes unchanged thresholds: 2 mm
paw error, 2 mm floor tolerance, 1 mm state boundary, 1 micrometer loop seam.
The maximum measured planted-paw errors are 0.795 / 0.633 / 0.590 mm, and worst
floor depths are 0.515 / 0.528 / 0.537 mm for Husky / Shiba / Cat. Source authoring
reports contain zero unreachable amount for all 144 clips. The verifier also
compares normalized-phase skin poses for bow/stretch and lie/sleep, so duration
changes alone cannot satisfy their distinct-motion check. This measures a real
pose difference; it does not by itself establish that the expression reads well.

`source_coverage.json` records all 144 clips and the exact source times actually
viewed. Husky was independently reviewed at 11 moments in both views, with dense
60 Hz shake/startle and rear-angle scratch evidence. Final07 changes only tuck;
the other 47 exported clip arrays are identical to06. Every Shiba/Cat clip was
viewed at five game and three side times, with larger 11-frame sheets for the
reworked posture families; their final03 changes only stretch. This does not
claim continuous visual review or final runtime acceptance. Root's Godot captures
and scene_status's full-mesh playback/normal-exit/interrupt regression establish
the separate runtime layer. Cat scratch remains explicitly deferred by the
original rig's ear-target reach; a new false scratch was not invented.

Godot imported all three final assets successfully. The import log retains the
environment's certificate-store and editor-settings access errors; all three
asset import stages completed and the process exited 0.

Original formal GLBs and original source code/specs remain in `before/`.
Final frozen source inputs, frames, contact plans, full verification and repeat
hashes remain under `source/{husky_candidate_07,shibainu_candidate_03,cat_candidate_03}`.
Reusable tools in `source/` freeze batches, render equal-aspect evidence, assemble
sheets, verify GLBs, compare builds, report reviewed coverage and publish verified
assets. Superseded candidate/scratch output is removed after those records are saved.
