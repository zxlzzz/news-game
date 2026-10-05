# Direct individual dog clips — engineering visual review

All 60 Husky and 60 ShibaInu actual Godot sheets were genuinely read: 24 sampled
times from source start through 23/24 duration, both 35° and 90° views (5,760 cells).
The separate endpoint capture was also read in full for the 47 single-use clips
per dog: exact duration and duration + 0.1 seconds, both views (376 cells).
Per-clip times, sheet hashes, source/code hashes and observations are recorded in
`individual_dog_visual_review.json`. Endpoint pages retain their label index under
`individual_endpoints/dog_review_pages/`.

This checks direct `Model.sample`/FK rendered clips and the empty-ground selection
behavior. It does not exercise Animal procedural gait, action sequencing, normal
return or urgent cancellation. It is source-author engineering review, not user
acceptance or a runtime support/contact PASS. Frozen formal sources are unchanged.

## Observed behavior

- Each selected clip begins in its authored base pose, without a preceding walk.
  Sitting, prone, sleeping and side-lying hold clips start in those poses.
- Enter/hold/exit clips remain independently selectable. LieDown and SitToLie
  finish prone; SitDown and LieToSit finish seated. SideEnter finishes on the flank;
  SideExit finishes prone. SleepEnter finishes head-low near the front paws;
  SleepWake raises the head but remains prone.
- Every viewed single-use endpoint holds its final silhouette at duration + 0.1s,
  without automatically adding walking, another action or replaying the clip.
  Original Walk/Gallop/GallopJump freeze their final stride pose according to the
  current single-use declaration. Death stays fallen.
- TailTuck now folds inward under the rear/abdomen, retaining Shiba's curled tail.
  Bow keeps the head forward/up during the low-front posture; Stretch has the
  lower extended head/neck and a longer sustained posture.
- Look, head-tilt, paw-offer and urination variants show their named motion.
  Original walk/run/jump, hit reactions and eating play their own source motion.

## Unconfirmed details

106 clips have an observed coarse direct-clip status. Six ear-twitch clips retain
`unconfirmed_small_or_occluded_expression`: their small black ear silhouettes do
not establish the brief movement. Four Shake clips show alternating head/neck
motion but retain a high-frequency unconfirmed status. Four Scratch clips show
the named rear leg lifting toward the ear and lowering toward the end, but the
fine paw rhythm/contact is obscured by head/chest in these two views.

Startle is present and mild; body shake is less prominent than head/neck motion.
These remain the already recorded source-expression limits, not new requests to
increase amplitude. Sparse sheets do not establish continuous-frame smoothness,
loop seam playback or millimeter-level ground contact. Endpoint captures show
duration and +0.1s, not a continuous long stop. Separate numerical source checks
cover authored endpoints and the declared loops; separate runtime diagnostics
cover action recovery.

## Read-only scratch recovery geometry assistance

The frozen `scratch_skin_normalized` snapshot demonstrates why its Shiba residual
root raise cannot be solved by changing only the two-bone bending plane:

- Normal return frame 1244: planned/actual sole +4.140mm, wrist -57.194mm before
  the uniform +71.906mm final raise. A full 360° sweep in 0.05° steps of upper/lower
  bones around the fixed hip–wrist axis has no feasible angle. Best whole-leg floor
  remains -68.501mm. Limiting vertex 895 has 0.537681 BackLowerLeg.L and 0.462319
  BackUpperLeg.L weights; even that vertex's independently best angle stays below
  ground. The fixed distal orientation puts the wrist underground despite a
  geometrically reachable two-bone target.
- Urgent return frame 1251: the upper/lower-influenced skin is already above ground
  (+13.750mm minimum), and every swept angle is feasible for that part. Actual
  lowest vertex 967 is -4.402mm with 0.948391 BackLowerLeg.L and 0.051609 FFB.L
  weights. It has no upper/lower influence, so bending-plane rotation cannot move
  it. This is a distal skin orientation issue.

`inspect_recovery_bend.py` is reusable and read-only. Evidence is in
`shiba_bend_sweep_normal.json` and `shiba_bend_sweep_urgent.json`; imported sole
reconstruction agrees with the independent pre-raise trace within about 2µm.
This fixed-axis sweep does not claim that the full four-bone leg has no feasible
recovery pose. Runtime repair remains owned by scene_status; source GLBs are frozen.
