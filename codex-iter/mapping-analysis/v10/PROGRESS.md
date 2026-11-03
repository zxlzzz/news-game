# V10 mapping work

**Current: Round 8, accepted by Hsinlung 2026-11-02. width_share stays 8:2. This is the research baseline; it is not yet migrated into Godot. Round 7 backup, width comparison and old audit scripts moved to `_archive/2026-11-02/` (see its MANIFEST.md).** The status line below is the Round 7 record.

Status: Round 7 main centreline mapping is rebuilt and independently audited across all 47 clips / 6,245 native frames. Hsinlung rejected the oversized thighs at sit_down f51; width had been added to the nominal length, and unbounded elastic lengths purchased support/hip height. R7 budgets width inside params totals, limits every adjustable segment to ±3%, and removes source pelvis/torso-height targets. Mapping remains unaccepted. The separate width/edge experiment is parked pending Hsinlung's decision; none of width_compare/ is changed by R7. Detailed R7 method, measurements and actual sampled observations are recorded below.

## Round 8 (Claude, 2026-11-01 evening) - current

Hsinlung accepted R7 except the forward bend: the torso tips over too far (screenshot: squat_watch side view). Claude made the change by hand and re-checked the whole mapping. R7 inputs are backed up in round7-backup/ (clips, mapper.py, params.json).

Changes (mapper.py, params.json):
1. torso_lean = 0.75. The drawn torso is one straight line standing in for a curled spine, so hips->neck makes a forward bend read as more tipped over than the source. Only the FORWARD sagittal lean of hips->neck is scaled by torso_lean (like head_pitch); backward/sideways lean and straight standing are untouched; past horizontal the scaling fades out between 90 and 120 degrees. F stays the body frame for all other relations. Max forward lean source -> R8: squat_watch 47->36, squat_down 41->31, pick_up 64->48, bow 73->55, seed_pickup 80->60, sit_down 30->23, squat 23->17.
   Rejected first attempt: aiming the line at the spine point halfway up the spine chain. Because the lumbar segment tilts back in the neutral pose, it also leaned every standing figure back ~5 degrees and pushed slumped sitting further back (sit_bench 15->28).
2. ankle_support = 200 (toes and other support points stay at support = 16). With R7 lengths fixed, planted feet slid while the body moved: squat_down feet slid inward ~9 cm (target units) during the descent although the source feet do not move. Planted-foot extra slide R7 -> R8: stand_up_support_back 0.078->0.035, squat_down 0.061->0.031, pick_up 0.051->0.010, sit_ground 0.046->0.015 (leg-length-normalised sums over planted frames). Raising support for toes as well tipped the fixed-length foot so it hovered ~1 cm; the split avoids that.

Checks on all 47 (Claude's own scripts, source vs target, same measurement both sides): segment lengths within 3% of params; true knee bends equal to source; elbow bends unchanged from R7 (max 11.5 deg in ng_scissor_kick, 7 in hands_on_hips/lean_railing/stand_up_support_back where contact relations win); foot-ground relation back to R7 level; no new acceleration. 44/47 solves converge; the three SEED clips stop at the 6000-iteration ceiling as in R7. Viewed side/front R7 vs R8 for squat_watch, squat_down, squat, pick_up, bow, sit_down, sit_ground, stand_up_support_back, kneel_hold, seed_pickup, lean_railing, look_down, scratch_head, hands_on_hips, ng_scissor_kick.
Review images, data.js and index.js regenerated (render_vm.py = render.py with a Linux font and EDGES inlined).

Scope: all new work stays in this directory. BRIEF.md is the verbatim assignment. Existing mappings, source assets and Godot remain read-only. No game, commit or push.

Current entry points: REVIEW.html for the Round 7 main library and AUDIT-R7.md for the all-frame audit with one row per clip. Round 6 geometry/settings/mapper/manifest are preserved in round6-baseline.npz. Current geometry is in clips/*/comparison.npz; each native frame appears in review/*/frames-*.jpg. WIDTH-COMPARE.html and all width_compare/ files remain the unchanged historical experiment; its centre reference is still R6, not R7. The width notes further below describe that parked experiment, not the current main-mapping assignment.

Method (R7): retain R6's whole-clip simultaneous relational solve, centreline contacts, common rigid bone-pair rotations, source-derived ground and temporal correction. Allocate 80/20 of directed shoulder/hip width FROM each segment's nominal length before fitting directions; the final total still equals the params length with at most ±3% relative adjustment. Torso, neck and feet use the same envelope; the head radius stays exact. Horizontal root travel remains a goal, while pelvis height is free and follows leg geometry plus foot support, with no source pelvis/torso-height objective. True elbows now use wrist endpoints (R6 mistakenly measured palm-centre bends). Head pitch is measured in the neutral-corrected torso sagittal plane and reduced exactly to 0.6 (R6 scaled a rotation-vector component instead). Neck remains collinear with the torso. Continuous source-proximity charts and source-referenced acceleration costs remain. No action identifiers enter mapper.py.

Round 1: implemented the new simultaneous objective and a read-only source adapter. Native Kimodo NPZs are read without the runtime export's seam edits. SEED BVH translations replace OFFSET, avoiding the historical duplicated root height; the contact-plane estimate is independently measured from the foot lower envelope. Existing Torch has a NumPy ABI mismatch; passing lists at its boundary works without installing packages.

Round 1 visual review (8 evenly spaced native frames, each front/side/45 degrees; not a claim of full-frame inspection):
- stand_idle f0–119: straight standing legs and planted feet read as the same idle; no outward knee bulge in the sampled views.
- seed_pickup f0–374: bend/reach/recovery recognizable, feet remain near the ground through f107–267. The original SEED data is read, not the old mapped cache.
- sit_down f0–74: descent and final seated knees recognizable. Hands stay by the thighs. These source files contain no seat geometry, so actual butt-to-furniture contact is not observed.
- cross_arms f0–89: hands cross toward the opposite upper arm; side and oblique views still read as folded arms, but the target upper-arm silhouette is narrower than the source.
- cover_ears f33–83: failed contact-height reading. Source fingers reach the ear region while the target endpoint sits on the lower head. Cause found: a fixed palm midpoint cannot represent the part of the hand actually touching the head.

Round 2 change: use continuous soft quadrature over the wrist-to-finger segment for head contact, and reduce competing torso-chart influence according to relative source clearance. This changes the general representation, with no clip-specific rules.

Round 2 result: the contact-height problem remained visible in cover_ears f33–83 and cover_face f0–51; increasing contact weight alone did not fix it. Inspection of goals and pictures showed two representation errors: simultaneously pulling multiple samples of a straight forearm onto an enlarged spherical chart demanded a curved forearm; radial ellipsoid enlargement did not preserve anatomical eye/jaw latitudes. Replaced the multiple constraints with one continuous soft closest-region relation over forearm + hand. Signed proximity distinguishes samples inside the coarse source head proxy rather than making them all tie.

Round 3: build the source head correspondence with observed eye, jaw and crown heights and a monotone C1 latitude chart. Target landmarks are eye latitude 0.1, jaw -0.35, crown 1, chin -1. Reduce far-away chart influence with a continuous rational falloff; nearby source relations remain strongest. Make torso orientation and neck collinearity exact by parameterization while retaining variable torso/neck lengths; head orientation is now exactly the 0.6 pitch transformation rather than something the optimizer may trade away. All 47 clips are being rerun with the same settings. Independent measure.py compares true limb bends, foot/ground, pelvis/ground, palm/head, hand pairs, opposite arm, thigh, torso and normalized endpoint speed using the same measurement formula on each skeleton. It does not report PASS/FAIL.

Round 3 prototype pictures: cover_ears f33–83 now has hands at the sides of the head; cover_eyes f30–60 puts hands on the forward head region. cover_face f0–51 still needs final inspection with the revised far-contact falloff. These are observations from the inspected native-frame overviews, not Hsinlung's acceptance.

Round 3 broad review: examined overviews for stand_idle, sit_down, cross_arms, cover_ears, seed_pickup, walk, run, jog, pick_up, bow, sit_bench, sit_ground, squat, squat_down, squat_watch, hands_on_head, scratch_head, rub_eye, cover_face and hands_on_hips. The ground relation was incomplete: sit_ground f64 shows source hands at the floor while mapped hand centre y=-0.0028 m (stroke penetrates farther); mapped hands reach -0.0645 m elsewhere in this sequence. This is a method omission, not a sit_ground exception.

Round 4: extend source-proximity-weighted support to all low elbows, palms, knees, pelvis and torso, using the same inferred plane and normalized measurements; apply the ground half-space to every visible line and the head sphere. All clips rerun. Source pick_up f43–106 reaches forward while crouched rather than reaching the floor; seed_pickup is the replacement evidence for an actual floor pickup. Keep the Kimodo clip as a labelled extra comparison, not as a successful floor-pickup source.

Round 4 result: sit_ground f64 hand centres moved to 0.0519/0.0689 m, visually above the plane; the complete clip minimum hand centre is 0.0343 m with stroke radius 0.026 m. Dense source/target images for cover_ears f16–31 and f88–103 show continuous approach/release, without the old additional hand jump in those inspected windows.

Round 5: a scale audit found that the preview used thinner strokes than the established figure. Nominal line lengths/head radius use 3× the runtime scale to compare with a human at the same metre-based camera, so stroke width must also be 3×0.035=0.105 m (radius 0.0525), with torso multiplier 1.15. Restore these actual proportions in the geometric contact objective and both renderers, then rerun every selected clip. This avoids judging contacts using an artificially thin body. No runtime files changed.

## Round 6 - directed shoulder/hip width

Changed the previous length-only interpretation. For each limb, fold the full neck-root-to-shoulder or pelvis-to-hip vector into its two preferred bone vectors with the configurable 8:2 share. Fit a common rigid rotation of the true anatomical bone pair to those vectors, then optimize one shared rotation and two independent positive lengths. Thus width influences limb orientation, while true elbow/knee flexion remains exact, including originally straight limbs. The 8:2 fold is the directional target; the rigid fit and elastic lengths reconcile its conflict with true bending and nearby contacts. No action identifiers, per-action parameters or frame-specific corrections enter mapper.py. The floor estimate, support objectives, head pitch 0.6 and no-forward-neck parameterization remain as before.

Acceleration diagnosis and general correction: the old head chart fed off-surface hand height into anatomical latitude, so radial departure also swept the target down the face. Its clamped polar latitude followed by sqrt(1-y*y) additionally had a singular derivative at the chin. In phone_call f18, the old head-patch goal has a 161.18 mm native-frame second difference, versus a 5.455 mm scaled source palm second difference. In scratch_head f50-52, the old contact weight drops 0.634 -> 0.572 -> 0.425 during release; f51 patch/base/target second differences are 10.24/7.71/23.20 mm versus source 5.145 mm. Evidence: round5-acceleration-evidence.json.

The revised chart projects the closest-region coordinate onto an anatomical source surface spanning observed chin to crown, then interpolates angular latitude with Hermite curves and zero polar slopes. Clearance and surface latitude remain separate coordinates. Temporal regularization now references observed anatomical joint/palm motion, with one global acceleration-correction weight of 100; it penalizes extra mapping curvature rather than using the constructed chain as its own motion reference. Existing near-contact charts and their continuously varying weights remain in the simultaneous fit.

Solver audit: 240 iterations truncated the native-120-fps solve. At 1,000 iterations, stand_idle changed by at most 3.48 mm and scratch_head by at most 7.01 mm, while seed_pickup changed by up to 58.99 mm and its foot-height mean absolute discrepancy fell from 11.889 to 3.311 mm in target scale. Evidence: solver-convergence.json. Raised the ceiling globally to 2,000 and reran all 47 clips. Most clips stop by tolerance; seed_jog, seed_pickup and seed_lunge reach the ceiling, so mathematical convergence of those three is not asserted. Their final foot-height discrepancies are 3.057 / 1.750 / 2.587 mm versus previous delivery 3.007 / 1.198 / 2.420 mm. These are descriptive same-form measurements, not acceptance limits.

Final same-form source/before/after comparisons are in round6-comparison.json; round5-baseline.npz retains the preceding target geometry. Across all native frames the independently measured true-bend discrepancy is at floating-point roundoff (maximum 9.95e-14 degrees). That establishes bend preservation only, not overall motion acceptance.

| Clip / right-hand frame | Source scaled second difference (mm) | Previous target (mm) | Final target (mm) | Previous/source | Final/source |
| --- | --- | --- | --- | --- | --- |
| scratch_head f51 | 5.145 | 23.201 | 11.714 | 4.51 | 2.28 |
| phone_call f18 | 5.455 | 13.457 | 7.078 | 2.47 | 1.30 |

The table uses world-space second differences at the same native frame rate, scaling source positions to target leg scale; multiplying by fps squared gives acceleration and preserves these ratios. Dense final f48-55 (scratch_head) and f16-23 (phone_call) show continuous movement without an isolated extra jump in the inspected window. The residual amplification, especially scratch_head f51, remains observed and is not called eliminated.

| Hand-to-torso distance / torso length (clip mean) | Source L/R | Previous L/R | Final L/R |
| --- | --- | --- | --- |
| stand_idle | 0.689 / 0.625 | 0.406 / 0.366 | 0.444 / 0.398 |
| walk | 0.704 / 0.706 | 0.416 / 0.420 | 0.492 / 0.496 |
| seed_pickup | 0.797 / 1.149 | 0.428 / 0.785 | 0.595 / 0.963 |
| sit_down | 0.564 / 0.520 | 0.322 / 0.290 | 0.411 / 0.367 |

Visual judgment: hanging upper arms now diverge from the torso, visibly in stand_idle f0/40/80/119, walk f0/11/22/33, seed_pickup f0/53 and sit_down f0/11. The normalized spacing above remains smaller than the source. Crossed-arm elbows at cross_arms f30/60 also remain narrower in front view. Preserve these as remaining differences for review rather than describing spacing as exact.

Final picture review: re-inspected regenerated audit-01..10 and width-01..10 after the 2,000-iteration rebuild, covering every clip at start, one-third, two-thirds and final frame in all three views. Additionally re-inspected final eight-frame overviews for stand_idle, walk, sit_down and seed_pickup; dense final windows: scratch_head f48-55, phone_call f16-23, cover_ears f16-23/f88-95, ng_juggle_kick_L f8-15, ng_penalty_kick f24-31, ng_scissor_kick f32-39, seed_pickup f160-167 and sit_ground f64-71. The W elbows, straight pointing limbs, kicking phases, standing support and low hand support retain the source action in those views. Individual judgments follow. This is sampled inspection, not a claim to have watched every native frame.

## Per-clip visual review - Round 6 final output

Inspected final audit-01..10 and width-01..10: every clip at f0, N//3, 2*N//3, N-1, with source/target pairs in all three views. Also re-inspected eight-frame overviews for stand_idle, walk, sit_down and seed_pickup, plus the dense windows recorded below. Sampled judgments, not a claim to have watched all 6,245 native frames.

| Clip | Inspected native frames (three views) | Judgment / observed difference |
| --- | --- | --- |
| stand_idle | f0/40/80/119 | Arms visibly diverge from torso in front/45-degree views; standing knees stay straight and feet supported. Arm-to-torso spacing is still smaller than source after normalization. |
| sit_down | f0/25/50/74 | Descent and seated right-angle legs retained. Standing arms are separated; hands remain near thighs when seated. Spacing is still narrower relative to torso than source; no chair mesh supplied. |
| cross_arms | f0/30/60/89 | Crossed forearms toward opposite upper arms retained. Elbows still narrower than source at f30/60, especially in front view. |
| cover_ears | f0/39/78/116 | W elbows and hands at sides of head retained. Dense f16-23 and f88-95 show continuous approach/release; endpoints have separated hanging arms. |
| seed_pickup | f0/125/250/374 | Arms separate at standing endpoints; forward bend/reach/recovery and foot support retained in overview and dense f160-167. Hand-to-torso spacing improves substantially, while source curved back is simplified. |
| walk | f0/11/22/33 | Walking stance/swing and straight support phases retained. Downward arms are separated in front view; normalized hand-to-torso spacing remains smaller. |
| run | f0/14/28/41 | Bent running arms, long stride and flight phase retained; no new outward knee bend in the straight phase. |
| jog | f0/9/18/26 | Alternating bent swing knees and opposing arm swing still read as jogging. |
| pick_up | f0/50/100/149 | Low forward-reaching crouch retained with wider hanging-arm separation at endpoints. Source f50/100 reaches forward rather than the floor; not counted as a floor pickup. |
| bow | f0/35/70/104 | Forward torso lean and straight legs retained; endpoints have separated arms and supported feet. |
| sit_bench | f0/30/60/89 | Seated knees, planted feet and hands near thighs remain readable; source has no chair surface. |
| sit_ground | f0/50/100/149 | Low sitting transition and backward supporting arms retained. Dense f64-71 shows hands above the plane and folded legs as in source. |
| squat | f0/20/40/60 | Deep bent knees and low forward hands retained in side/45-degree views. |
| squat_down | f0/40/80/119 | Standing-to-deep-squat poses retained; width does not invent knee bending in the initial straight phase. |
| squat_watch | f0/40/80/119 | Low squat and downward arm reach retained. The single target torso line still simplifies the source curved spine. |
| hands_on_head | f0/40/80/119 | Hands reach upper sides/crown with elbows spread, then lower to arms clearly outside the torso. |
| scratch_head | f0/30/60/89 | Raised right hand and release remain recognizable; dense f48-55 progresses continuously. Extra release acceleration is reduced, not eliminated: f51 11.714 mm versus scaled source 5.145 mm second difference. |
| rub_eye | f0/30/60/89 | One hand remains at the forward face and the opposite arm stays separated from torso; side view reveals the partly occluded contact. |
| cover_face | f0/30/60/89 | Both hands near lower/front face retained; front view still partially hides the hands behind the large head. |
| hands_on_hips | f0/30/60/89 | Hands at waist, outward elbows and weight shift retained; no knee bulge added to the long leg. |
| hands_in_pockets | f0/30/60/89 | Hands near pelvis, bent elbows and downward head pose retained; pocket geometry is absent. |
| handshake_offer | f0/50/100/149 | Solo forward reach and release retained; hanging arm now separates from torso. No second actor supplied. |
| handshake_reply | f0/50/100/149 | Solo forward reach/hold retained with the opposite arm hanging outside torso. No partner contact is observable. |
| rub_hands | f0/30/60/89 | Two hands remain together in front of torso, with the same bent elbows; initial arms separate from torso. |
| phone_call | f0/40/80/119 | Right hand rises toward cheek with a continuous trajectory in f16-23; opposite arm stays apart. f18 extra acceleration reduced to 7.078 mm versus scaled source 5.455 mm second difference. No handset supplied. |
| phone_urgent | f0/30/60/89 | Sustained one-hand cheek gesture and torso/head lean retained; opposite arm separated. No handset supplied. |
| point | f0/35/70/104 | Forward pointing arm stays straight in side/45-degree views; width does not kink the elbow. |
| look_down | f0/30/60/89 | Reduced downward head pitch retained, neck aligned with torso, arms separated in front view. |
| look_up | f0/30/60/89 | Reduced upward pitch retained without forward neck reach; hanging arms remain distinguishable. |
| stand_up | f0/25/50/74 | Seated-to-standing rise and hands near thighs retained; final arms separated and legs long as in source. |
| stand_up_support_back | f0/40/80/119 | Low seated/backward hand support and leaning rise retained; final source and target both remain slightly bent. |
| kneel_hold | f0/20/40/60 | Upright kneeling, rear folded lower legs and knee/ground support retained; arms separated in front view. |
| lean_railing | f0/30/60/89 | Backward bent arms, torso lean and asymmetric legs retained. No railing geometry supplied. |
| wipe_sweat | f0/30/60/89 | Source lower-face forearm sweep and arm withdrawal retained; this source is not an upper-forehead wipe. |
| cheer | f0/35/70/104 | Raised-arm cheer, bent elbows and body bounce retained; final lowered arms separate from torso. |
| hands_up | f0/35/70/104 | Raised arms with matching true elbow bends retained; initial hanging arms now separate. |
| cover_eyes | f0/35/70/105 | Hands reach forward eye region with spread elbows; large head still partly occludes them from front, side view shows relation. |
| clap | f0/74/149/223 | Two hands meet/separate in front of chest with matching elbow folds; endpoint arms separate from torso. |
| point_forward | f0/35/70/104 | Forward arm remains nearly straight as in source; side view retains pointing direction and final withdrawal. |
| wipe_sweat_forearm | f0/38/76/113 | Horizontal forearm sweep near lower/front face and release retained; source still does not clearly wipe the upper forehead. |
| ng_idle_offensive | f0/106/212/317 | Weight shift and alternating long/bent legs retained; first/last straight phases have no invented knee bulge and arms stand apart. |
| ng_jog_fwd | f0/8/17/25 | Running support/swing and opposing arms retained through start/end and two interior samples. |
| ng_juggle_kick_L | f0/6/12/17 | Supporting red leg and blue kicking leg remain distinct; dense f8-15 preserves extension/return and floor relation. |
| ng_penalty_kick | f0/15/30/45 | Forward kick, torso lean and support leg retained; dense f24-31 preserves long kicking-leg progression and recovery. |
| ng_scissor_kick | f0/28/56/83 | Airborne scissor pose, ground roll and recovery retained; dense f32-39 keeps larger head above the plane. |
| seed_jog | f0/127/255/382 | Native running stance/flight and opposing arms retained at all inspected poses, with the inferred plane under the source and target. |
| seed_lunge | f0/348/696/1043 | Deep forward lunge and rear knee bend at f696, upright returns and separated hanging arms at endpoints retained. |

## Previous-round review context (Rounds 1?5)

- Examined every clip's eight-frame three-view overview during development. After restoring the final stroke width, examined audit-01.jpg through audit-10.jpg: every clip at native f=floor(N/3) and floor(2N/3), all three views, source/target side by side. No new obvious regression in those sampled poses. These audit sheets remain under review/ for inspection.
- Dense final-frame pictures inspected: cover_ears f16–23 and f88–95 (approach/release), ng_juggle_kick_L f8–15 (maximum kick and return), ng_scissor_kick f32–39 (landing/roll). Earlier Round 4 dense review also covered cover_ears f24–31 and f96–103. No additional jump was seen in these inspected windows. This is not an exhaustive visual watch of all native frames.
- Observed remaining differences: cross_arms f30/60 target elbows are narrower than the source, most obvious from front; folded arms remain visible obliquely. cover_face f0–51 and cover_eyes f30–60 have hand occlusion by the larger head in front view; side/oblique views reveal the contact. The target torso is one line, so squat_watch's curved source spine is simplified.
- Source limitations remain labelled in the per-clip table. Actual chair/rail meshes and a handshake partner are absent from these skeletal inputs. Their geometric contact is not claimed as verified. No new action was generated.
- origin-invariance.json: adding +1.01 m to every source joint shifts the independently estimated floor by +1.01 m; the eight remapped test poses differ by at most 0.0000212 m. This establishes vertical-origin invariance for that experiment only, not animation quality.
- reference.json freezes the joint-name/index table and neutral source frame actually used. Their original files predate this task; copying identical data into v10 removes live Godot-export dependencies without changing the mapping inputs.
- Final stroke-width regression: inspected audit-01.jpg through audit-10.jpg, covering all 47 clips again. Final dense rechecks: cover_ears f16–23/f88–95, ng_juggle_kick_L f8–15, ng_scissor_kick f32–39. Previously recorded readability judgments remain; no additional jump was seen in those final windows. sit_ground final hand centres at f64 are 0.07775/0.09442 m; the full clip minimum is 0.06055 m with stroke radius 0.0525 m.
- verification.json confirms all 805 pages exist at the expected sizes, images reflect the final parameter timestamp, lazy player arrays reflect the final NPZ timestamps, all coordinates are finite, and source rates/frame counts are retained. Node parses the inline player JavaScript. These checks establish artifact completeness, not motion acceptance.
- Browser screenshot validation was attempted with fresh local profiles: normal headless Chrome failed its GPU process, and a software-rendering attempt timed out. No browser screenshot is claimed. Both temporary profiles and bytecode cache were removed. Image inspection used the actual generated JPGs; the player has syntax/data/link verification, not a successful live browser playback test.

Reproduction order: `python -B codex-iter/mapping-analysis/v10/run.py`, `python -B codex-iter/mapping-analysis/v10/measure.py`, `python -B codex-iter/mapping-analysis/v10/render.py`, `python -B codex-iter/mapping-analysis/v10/audit_sheets.py`, `python -B codex-iter/mapping-analysis/v10/audit_sheets.py --endpoints`, `python -B codex-iter/mapping-analysis/v10/compare_round6.py`, `python -B codex-iter/mapping-analysis/v10/verify.py`. Renderer `--index-only` refreshes review links and copies this table into the player without regenerating images. Numerical relationships have no motion-quality pass threshold.

Reproduce: `python -B codex-iter/mapping-analysis/v10/run.py`; then `python -B codex-iter/mapping-analysis/v10/render.py`. For a small diagnostic subset use `--only` on either script; `render.py --keys` generates overviews only. All outputs stay under v10.


## First width comparison after Round 6 - historical, before the lowering request

Hsinlung requested a comparison, not a decision between the two ideas. The original 8:2 centre geometry is copied byte-for-byte into `width_compare/8-2-centre/`; a fresh solve with explicit 0.8/0.2 differs by at most 0.103371 mm because the previous distal expression was `1 - 0.8` and LBFGS stops by tolerance. Displaying the original avoids silently moving the reference. The original mapper, params, clips, review images, index and REVIEW.html are unchanged (1,081 protected files verified by SHA-256).

### Shared method and controls

`width_compare/width_mapper.py` extends the Round 6 method. `width_proximal` and `width_distal` independently multiply the directed hip/shoulder vector before the same rigid bone-pair fit; their sum is never normalized. `edge_spacing` enables the clearance charts. Edit those controls in `width_compare/presets.json`; `configs.json` records the resulting four complete parameter dictionaries. All other values, the physical radii and the 2,000-iteration ceiling are identical. There are no action names or action-specific parameters in either mapping module. Original source data, floor inference, exact anatomical bending, torso/neck orientation, head pitch, support and temporal regularization are retained.

In edge mode, source-local samples relate each leg to the other leg, each arm to the other arm, and each arm to the torso. The skeleton supplies limb-line clearance; the torso uses the same anatomical radius chart as the existing palm/torso relation. The target radius sum is exactly the contact/renderer radius sum: limb/limb 0.105 m, limb/torso 0.112875 m. When separated, the target centre displacement goal is the scaled source surface gap plus that radius sum. Existing palm/body, palm/opposite-arm and palm-pair relations use the same clearance helper. Head and ground already use the same physical line radius.

The new objective constrains the plane normal to the neighbouring source bone, allowing sliding along it. Soft closest-region coordinates join the neighbouring segments continuously. Homologous knee/ankle and elbow/palm relations also retain lateral passing order in the source body's lateral coordinate, with a common arc-based distal emphasis. A closest-region relation alone loses endpoint identity when a foot passes the opposite shin; that initial failure was measured and removed before delivery. Neither the camera nor motion names enter this method.

A fixed positive radius offset cannot reverse sign continuously at coincident zero-thickness source lines. The offset therefore fades C1 to zero inside a band of one quarter of the target radius sum (26.25 mm in target scale for limb pairs). It has no positive-distance floor or side-switch branch: coincident/crossing source points may produce overlapping target strokes. Very close separated source lines may already have overlapping strokes within that transition band. Shared collapsed roots have an additional C1 spatial fade over one radius sum of source arclength; their inevitable overlap is not treated as an error. These are soft simultaneous goals, not a claim that every rendered gap equals its goal exactly.

The whole foot follows the same horizontal clearance transport: ankle and toe receive the same source-derived displacement, while both original height goals remain unchanged. The first spacing-only solve moved ankles against old toe targets, visibly turning the squat feet; the coherent-foot correction was applied to both edge groups for all eight clips. No pose-specific repair remains. All temporary trial geometry/images were overwritten by the final common method.

### Actual picture inspection

The page provides every native frame in all three views, plus matched source/four-group JPGs for 81 selected front frames and 16 side/45-degree reference rows (485 panels). Proper projected leg-segment intersection and ankle left/right order are recorded separately. Only run contains either kind of source leg crossing in these eight clips; the other seven show closest-approach windows, explicitly labelled rather than presented as crossings. All previews share the Round 6 metre scale, stroke width, ground grid and 10-degree camera elevation.

Inspected the final front sheets/three-pose audit sheets and every final side/45-degree reference. Continuous final run f15-19 and its surrounding crossing windows, walk f0-4, squat f9-13, and hands_on_hips f5-9 were examined. Observations below describe sampled pictures, not an exhaustive watch of all 530 native frames.

| Clip / inspected poses | 8:2 centre (original Round 6) | 8:2 edge | 10:2 centre | 10:2 edge |
| --- | --- | --- | --- | --- |
| run f0/15-19/20-23/27/35-41; side/45 f27 | Near f17-19 the lower-leg strokes merge into a blue/red column; f27 has a visible leg gap. | f27 has a larger gap and wider running elbows; f17-19 still permits overlap while passing. In side f27 the rear foot is farther back than the centre baseline. | f27 gap grows modestly; f17-19 still overlaps. Ankle order differs by one native frame at two events (below). | f27 gap is slightly larger than 8:2 edge; f17-19 remains overlapping, with no isolated outward pop seen in that window. Side stride is also longer than the centre baseline. |
| walk f0-4/17/25/33; side/45 f25 | f0-4 legs nearly merge; f25 red bent leg separates, hanging arms remain relatively close to torso. | f25 leaves more visible knee space and hanging-arm space. f0-4 lower strokes still overlap. Figure is taller than the baseline in f25 side view; width is not the only optimized consequence. | f25 knee gap grows a little; f0-4 is still narrow. Side support/swing remains readable. | f25 knee gap slightly exceeds 8:2 edge; f0-4 still overlaps. Shares the taller edge-mode silhouette in side f25. |
| stand_idle f0/60/89/117-119; side/45 f0 | Straight standing legs, narrow triangular opening; arms diverge from torso. | Wider leg opening and clearer arm/torso gap; common hip tip still overlaps. Feet remain by the plane. | Slightly wider proximal opening than 8:2 centre; the total silhouette is close to that reference. | Leg opening close to 8:2 edge, with a small additional knee gap. Side stance remains upright; not a newly bent-knee pose. |
| ng_juggle_kick_L f0/3-9/14/17; side/45 f14 | Supporting red leg and blue kick/return readable; f5 feet/low shins are close. | f5 lower legs and f14 knees separate more; arms stand farther out. Side f14 retains bent raised leg and the supported other foot. | Small widening of f14 knees relative to baseline, same kick phase. | Very close to 8:2 edge at f5; f14 knee gap slightly larger. Raised/supporting-foot roles remain distinct in side/45. |
| sit_down f0/10/74; side/45 f74 | Standing opening is narrow; final seated knees and hands near thighs read clearly. | f0/10 legs and arms spread; f74 knees spread more. Side f74 still has seated thighs and feet below the knees. | f74 knee spread increases modestly; seated side pose remains close to baseline. | f74 leg gap close to 8:2 edge, a little larger. Hands remain near the thigh/lap region. No chair surface is supplied. |
| squat f0/9-13/15/30/60; side/45 f15 | Deep crouch, folded thighs/shins, source hands forward/down; lower-limb lines overlap densely from front. | More open front leg silhouette, especially the blue lower-limb outline. The folded-leg plane changes visibly in 45 degrees; this is more than a uniform widening. | Front knees slightly wider; the folded-leg silhouette remains much closer to 8:2 centre than either edge group. | Closely resembles 8:2 edge, including the changed 45-degree folded-leg outline. Deep flexion and low foot support persist; numerical height discrepancies increase for the higher foot endpoints (below). |
| cross_arms f0/43/72; side/45 f72 | Compact folded-arm silhouette; elbows relatively narrow. | Folded forearms extend farther sideways; legs also open more. Side/45 still shows arms folded in front, not arms uncrossing. | Small elbow/leg widening relative to original; forearms remain overlapped in front. | Close to 8:2 edge in the inspected folded-arm pose, with a slightly larger leg gap. Side/45 folded-arm relation remains visible. |
| hands_on_hips f0/5-9/19/45/89; side/45 f0 | Narrow stance: knee strokes overlap despite separated source bones. Both elbows read as hands-on-hips. | A visible knee gap appears at f0/5-9. Waist-hand/elbow gesture is retained; no forced separation of the shared hip tip. | Knee overlap becomes slightly smaller but remains at f0; arms retain the waist gesture. | Visible knee gap is slightly larger than 8:2 edge. Side bent/straight-leg relation and hands-at-waist gesture remain. |

No group is selected or recommended here. The edge groups visibly change arm spacing, leg planes and sometimes overall height/stride as the simultaneous fit reconciles the new relation with true bends and contacts; the comparison retains those consequences for judgment.

### Independent measurements - all native frames

True elbows/knees use the same anatomical bone-pair angle on source and target. Foot height comparison uses all four ankle/toe endpoints, subtracts the target stroke radius, normalizes each skeleton by leg length, then converts discrepancies to target-scale millimetres. `all / low` below is mean absolute discrepancy over all endpoints / the lowest source-height quintile, selected independently for each clip. The low samples are not a separately detected planted-foot state.

| Clip: foot-height MAE mm (all / low) | 8:2 centre | 8:2 edge | 10:2 centre | 10:2 edge |
| --- | --- | --- | --- | --- |
| run | 5.045 / 3.618 | 5.834 / 3.474 | 5.085 / 3.608 | 5.922 / 3.456 |
| walk | 3.367 / 2.496 | 4.500 / 2.779 | 3.401 / 2.456 | 4.540 / 2.717 |
| stand_idle | 1.757 / 1.372 | 1.879 / 1.390 | 1.842 / 1.356 | 2.012 / 1.366 |
| ng_juggle_kick_L | 2.248 / 2.066 | 3.387 / 2.393 | 2.312 / 2.066 | 3.327 / 2.431 |
| sit_down | 1.928 / 2.492 | 2.120 / 2.574 | 1.968 / 2.449 | 2.170 / 2.560 |
| squat | 1.791 / 2.831 | 6.084 / 2.274 | 1.667 / 2.699 | 5.952 / 2.268 |
| cross_arms | 1.839 / 1.496 | 1.984 / 1.582 | 1.909 / 1.467 | 2.115 / 1.563 |
| hands_on_hips | 2.033 / 1.993 | 2.862 / 1.676 | 2.089 / 1.942 | 2.626 / 1.675 |

| Across the eight clips | 8:2 centre | 8:2 edge | 10:2 centre | 10:2 edge |
| --- | --- | --- | --- | --- |
| Maximum true-bend discrepancy (degrees) | 7.11e-14 | 8.53e-14 | 5.68e-14 | 7.11e-14 |
| Minimum foot stroke-edge height (mm) | -0.795 | -0.804 | -0.794 | -0.805 |
| Maximum foot-height discrepancy (mm) | 16.752 | 17.181 | 16.748 | 17.598 |
| Maximum solve iterations (global ceiling 2,000) | 653 | 1570 | 648 | 1451 |

The true bends remain exact to floating-point roundoff. Foot support is still approximate: the pre-existing submillimetre floor overlap remains; the edge groups have slightly different height errors. In squat, all-endpoint height MAE rises from 1.791 to 6.084 mm (8:2) and 1.667 to 5.952 mm (10:2), while the lowest-height quintile MAE decreases. This distinguishes the low supporting endpoints from the higher endpoints rather than treating one overall average as proof of support. No new obvious floating-foot event was seen in the inspected reference poses.

The coherent-foot correction retains the foot vector as well as its support height: squat mean source/target foot-direction errors are 9.330 / 5.200 / 8.050 / 5.095 degrees in the four-column order; run is 2.235 / 2.594 / 2.803 / 2.440 degrees. Full per-frame foot directions and all original relational measurements remain in `width_compare/measurements.json` and each group/clip `relations.json`.

At the following displayed reference frames, horizontal knee stroke-edge gap is `abs(x_left - x_right) - 2*line_radius`. The source column is its zero-thickness knee separation, scaled by the same source leg scale. This is a joint-level horizontal diagnostic, not the minimum distance between entire projected leg segments; different knee heights and depth occlusion remain visible in the pictures. Negative means horizontal stroke overlap.

| Clip / frame: knee gap mm | Source scaled | 8:2 centre | 8:2 edge | 10:2 centre | 10:2 edge |
| --- | --- | --- | --- | --- | --- |
| run f27 | 220.66 | 82.71 | 163.39 | 101.78 | 170.89 |
| walk f25 | 184.51 | 45.03 | 130.51 | 61.36 | 136.62 |
| stand_idle f0 | 208.71 | 53.23 | 162.59 | 61.61 | 164.10 |
| ng_juggle_kick_L f14 | 188.07 | 62.78 | 139.31 | 82.00 | 146.64 |
| sit_down f74 | 392.85 | 312.65 | 413.00 | 341.68 | 417.12 |
| squat f15 | 524.81 | 404.25 | 559.87 | 425.92 | 560.98 |
| cross_arms f72 | 296.48 | 141.51 | 269.21 | 153.20 | 273.32 |
| hands_on_hips f0 | 98.05 | -56.71 | 39.70 | -44.90 | 45.37 |

Run source ankle-order changes are f1/16/21/37. Both edge groups and the preserved 8:2 centre retain those same native events. 10:2 centre changes at f1/17/20/37. Proper source leg-segment intersections in the actual front projection occur at f17/18/37/38/39/40; the target centre lines intersect at f0/17/18/19/37/38/39/40/41 (8:2 centre) and f17/18/38/39/40 (the other three). Thus ankle passing order and exact centre-line intersection timing are not interchangeable, and the latter is not claimed exact. Thick strokes also overlap before/after these centre-line intersections.

Reproduce inside this experiment: `python -B codex-iter/mapping-analysis/v10/width_compare/run_compare.py`, then `render_compare.py`, `verify_compare.py`, and `node codex-iter/mapping-analysis/v10/width_compare/check_review.js` (the Python scripts all live beside run_compare.py). `configs.json` contains the three experimental controls and the common parameters. `round6-integrity.json` protects the original library. The verification covers finite data, original source frames, exact cached baseline, identical non-experimental settings, bend preservation, selected images, crossing-window coverage and a dense odd/C1 clearance probe. Node executes all eight offline clip loaders, all three canvas views, selected-frame sliders, step buttons and play/pause with a DOM/canvas harness. Actual JPGs were visually inspected; no successful live-browser pixel test is claimed. No game, commit, push or writes to godot/docs/assets.


## Historical direction-priority edge lowering - REJECTED by Hsinlung

The following section records the previous experiment, not the current method. Hsinlung rejected it because run front stayed visually identical to centre: freezing all bone directions and allowing only 3% length adjustment removed the freedom needed to separate the legs. Its 33 result/tool files are preserved by `width_compare/rigid-lowered-integrity.json`; the current page replaces its column. The original initial-value recommendation below is superseded.

Hsinlung tentatively preferred the original 8:2 edge result, but observed excessive leg spreading in squat. The accepted priority for this revision is limb pointing/bending direction before stroke spacing. This is a general correction for the same eight clips, not a squat exception. The four old groups are still byte-identical (96 protected geometry/metadata/measurement files); the original Round 6 tree is also unchanged.

Measured cause: at squat f15, the original edge group changed the left thigh direction by 37.081 degrees and its bend plane by 32.125 degrees relative to the centre group. The right thigh changed 5.812 degrees and its bend plane 16.455 degrees. At stand_idle f0, left/right thighs changed 1.807/7.814 degrees. Exact flexion alone did not prevent these whole-pair rotations. This confirms the priority error rather than treating the observed spread as a clip-specific anomaly. Plane angles of nearly straight limbs are sensitive; individual bone directions are the reliable standing diagnostic.

### Method and the adjustable number

`lowered_mapper.py` starts from the preserved 8:2 centre pose, which already resolves source bending, support and contact. There are no rotation variables in the residual solve. Root, torso, neck and head coordinates are fixed. Every proximal and distal bone retains its centre-group direction, hence also its true flexion and bend plane. Only lengths may redistribute within a common 3% envelope. No move of the whole leg or change of bend facing can purchase spacing, regardless of edge strength.

For each leg, the two length changes satisfy `upper_y * delta_upper + lower_y * delta_lower = 0`. The ankle therefore keeps its height exactly; the toe receives the identical translation, preserving its height and the foot's direction. Arms have two bounded length freedoms; legs have one floor-tangent redistribution each. The available box is reduced continuously near the floor so existing low joints cannot be lowered through it. Existing source proximity charts protect established near-contact relations with their continuous weights above the spacing tier. Temporal regularization acts on the new correction. The whole native clip is one sparse bounded least-squares solve; no motion names or action-dependent values enter it.

`edge_strength` in `width_compare/presets.json` is the user control. It scales the request from the current centre relation toward the original edge clearance goals. 0 returns the centre geometry exactly; 1 requests the original full edge amount **inside the direction-preserving space**. Reproducing the old edge *pose* at 1 would conflict with the prohibition on its rotations; the page therefore keeps the original edge pose as a separate frozen reference and explicitly labels 1 as the original request amount. The guard remains active at every strength. This is not a pose blend with the old spreading result.

Initial value: **0.25**. I chose it after viewing squat f15 at 45 degrees, stand_idle f0 front and run f17/f27 front at 0.25/0.5/1: the squat no longer swings outward, standing no longer splays to the original edge stance, and small remaining spacing gains are retained. In squat and standing, the available length slack is already exhausted around 0.25, so higher requests do not keep widening them. The page offers exact precomputed solves at 0, 0.01, 0.05, 0.25 and 1, including fine values below saturation. Any value in [0,1] may be entered in presets.json and regenerated; the current value is automatically included in the preview list. Choosing 0.25 is an initial assistant judgment, not Hsinlung's acceptance.

The result deliberately gives up much of the original edge group's visible spacing. It preserves the higher-priority pose and leaves unresolved overlaps. It does not claim to keep all of the original group's large gaps while removing only the squat defect.

### Picture observations for the new group

The page adds the new column immediately after the original 8:2 edge column. All old selected frames and three views are retained: 81 front rows plus 16 reference rows, now 582 source/target panels. Static images and the measurement table show the initial 0.25; the numeric selector changes the new live column only. Source, original groups and camera scale remain unchanged.

Inspected final pictures at the frames below, including the complete run f15-19 crossing window. These are sampled observations, not a claim of watching every native frame.

| Clip / viewed frames | New 8:2 edge lowered (0.25), against centre and original edge |
| --- | --- |
| squat f0/9-12 front; f15 45 degrees | The blue folded-leg outline stays tucked along the centre pose instead of projecting sideways as in the original edge group. The deep crouch, foot direction and torso height remain. Front knee space increases modestly; the large original spread is gone. At f15, 0.25/0.5/1 keep the same tucked direction. |
| stand_idle f0/60/89/117-118 front | Leg rays remain at the centre group's angles, with only a small change in knee placement along those rays. It no longer takes the original edge group's much wider stance. Arms also stay close to the centre silhouette rather than keeping the original group's large side gaps. |
| run f15-19 and f20-23/27 front | Lower legs still merge near f17-19, and no forced outward opening occurs in that inspected crossing window. At f27 the knee opening grows slightly rather than reaching the original edge group's large gap. Running elbow directions and body height stay at the centre reference. |
| walk f17/25/33 front | Bent swing/support phases remain. At f25, extra knee space is very small; lowered group does not acquire the original edge group's taller, more widely spaced silhouette. |
| ng_juggle_kick_L f7-9/14/17 front | Kick/return and supporting leg remain in their centre directions. f14 knees separate a little more; the original edge group's broader leg/arm spacing is mostly relinquished. |
| sit_down f12/37/74 front | Mid-descent and final seated shape remain at the centre reference. At f74 there is a small knee-gap increase, without the original edge group's much broader thighs. Hands retain the lap/thigh gesture. |
| cross_arms f44/45/72/89 front | Folded-arm silhouette and compact elbow placement remain close to centre; it does not retain the original edge group's broadly extended forearms. Small leg-length redistribution slightly enlarges the knee opening at f72. |
| hands_on_hips f0/5-8 front | Elbows and waist-hand gesture remain. The narrow standing legs still overlap as in centre; the original edge group's clear knee gap is not retained. f0 horizontal overlap is 0.277 mm greater than centre, a minor redistribution rather than a successful opening. |

### Independent measurements

The table below compares the same source/target formulas on every native frame. Foot MAE is the previous leg-normalized, target-millimetre height measurement over all ankle/toe endpoints. Lowered foot MAE equals centre exactly because all four endpoint heights are unchanged. The true anatomical flexion discrepancy in the new group is at most 9.95e-14 degrees across all eight clips.

| Clip | Foot MAE mm: centre / original edge / lowered | Lowered true-flex max error (deg) | Bone direction change vs centre max (deg) | Max length change (%) |
| --- | --- | --- | --- | --- |
| run | 5.045 / 5.834 / 5.045 | 9.95e-14 | 6.39e-14 | 2.562 |
| walk | 3.367 / 4.500 / 3.367 | 4.44e-14 | 2.57e-14 | 2.399 |
| stand_idle | 1.757 / 1.879 / 1.757 | 2.84e-14 | 1.27e-14 | 2.200 |
| ng_juggle_kick_L | 2.248 / 3.387 / 2.248 | 5.68e-14 | 2.06e-14 | 2.729 |
| sit_down | 1.928 / 2.120 / 1.928 | 5.68e-14 | 1.67e-14 | 2.209 |
| squat | 1.791 / 6.084 / 1.791 | 4.26e-14 | 1.28e-14 | 2.166 |
| cross_arms | 1.839 / 1.984 / 1.839 | 4.26e-14 | 5.93e-14 | 2.181 |
| hands_on_hips | 2.033 / 2.862 / 2.033 | 8.53e-14 | 3.22e-14 | 2.140 |

Across all clips at 0.25, maximum bone-direction change is 6.39e-14 degrees and bend-plane change 2.87e-13 degrees: roundoff only. Root/torso/neck/head coordinates and all four foot endpoint heights equal the centre values element by element. Foot-ground minimum remains -0.795 mm, the existing centre overlap; no new height correction is introduced. Tests repeat the direction, plane, length-envelope, body and foot-height checks for all 530 native frames at each of the five preview strengths.

At the same front diagnostic frames as before, knee stroke-edge gaps (centre / original edge / lowered) are: run f27 **82.71 / 163.39 / 85.12 mm**; stand_idle f0 **53.23 / 162.59 / 56.49 mm**; squat f15 **404.25 / 559.87 / 415.24 mm**. The remaining gains are small, especially standing and running, because widening no longer has permission to rotate the limb. Hands-on-hips f0 retains horizontal knee overlap: -56.71 / 39.70 / -56.98 mm. These are the same joint-level horizontal diagnostics, not full-segment closest distances.

Verification: 1,081 original Round 6 files and 96 files belonging to the four original width groups are unchanged by SHA-256. New preview geometry is under `8-2-edge-lowered/<clip>/`; `comparison.npz` is the initial 0.25 result, and `strength-samples.npz` contains the five exact preview solves. Node executes all eight clip loaders, all three views and all five strength choices, including frame stepping and playback controls. Actual generated JPGs were inspected; a live-browser pixel check is not claimed.

Reproduce the new group: `python -B codex-iter/mapping-analysis/v10/width_compare/run_compare.py --groups 8-2-edge-lowered`; then run `render_compare.py`, `verify_compare.py`, and `node codex-iter/mapping-analysis/v10/width_compare/check_review.js` at their existing paths. The runner preserves existing historical groups instead of solving over them. No game, commit, push or edits to godot/docs/assets.


## Whole-limb splay with source bend heading locked - three-strength preview

Request: retain the original edge group's running separation without squat splaying. Hsinlung explicitly allowed small root rotations for both arms and legs, while retaining the source bend facing and true flexion. This supersedes the previous absolute direction freeze. No tier is accepted or recommended as a finished mapping.

### Diagnosis: the squat error included bend-facing rotation

At squat f15, the left anatomical plane normal's horizontal heading in the source torso frame is -30.751 degrees. The preserved centre maps it to -43.302; original edge maps it to -73.470. Original edge therefore changes source facing by 42.719 degrees. Plane inclination is -11.558 / -4.829 / +6.351 degrees (source / centre / old edge); the full source-to-edge plane-normal difference is 46.115 degrees. Relative to centre, old edge turns the left thigh 37.081 degrees and shin 33.815 degrees. Both bones move together AND the bend facing swivels. The blue shin projecting sideways in the old 45-degree picture is not explained by harmless outward displacement alone. The right plane heading is 55.953 / 58.797 / 72.353 degrees, a smaller version of the same problem. `plane-diagnosis.json` now includes an independently measured source-frame heading audit.

### Current method and parameter meaning

`swing_mapper.py` keeps the old source adapters, 8:2 width folding, elastic lengths, whole-clip temporal solve, source-proximity contact charts, physical stroke radii and foot/ground objective. Each anatomical bone pair has two rotation freedoms: an in-plane swing and a whole-pair splay about its body-horizontal bend-forward axis. Both bones rotate together, making true flexion exact. Parameterize plane inclination with a bounded tanh while preserving the horizontal heading of its oriented normal in the source torso frame. Thus the bend cannot swivel sideways around the body's up axis, but its plane can lean as the whole limb splays. Root/torso and foot heights are solved again; the previous 3% length cap and frozen feet are removed. No limb endpoints are independently nudged after solving.

Here "locked bend facing" means horizontal heading relative to the body, NOT a fully fixed 3D plane normal. Whole-limb outward splay generally inclines that plane. Heading and inclination are separately measured in `swing-measurements.json`, so this distinction is visible rather than concealed by a flexion-only check. The fixed torso orientation means the source body basis is also the target body orientation.

`width_compare/swing-presets.json` is the single control source: strengths 0.25/0.5/0.75, default display 0.5, proximal/distal shares 0.8/0.2, common direction weight 12. The added edge request is `centre_relation + strength * (original_edge_goal - centre_relation)`. Existing edge-expanded contact offsets use the same linear scaling from centre to edge. Strength changes goals, not a blend of solved poses or a repulsion threshold. The original smooth signed-clearance chart remains continuous through contact/crossing, with shared hip-root overlap still allowed. Direction and spacing compete in the common objective; unachievable clearance remains overlap.

One common pilot at the original direction weight 1 allowed about 29 degrees of left-plane inclination change at squat f15, plus conspicuous standing spread at 0.75. This exceeded the intended small splay. All eight clips and all three strengths were therefore regenerated with direction weight 12 (the existing joint-relation weight level); edge-spacing weight remains 60 and all other original weights remain unchanged. There are no action/frame conditions, action-dependent weights or squat-only limits. These are the final files on the page; the pilot is not mixed into the outputs.

Important reference limitation: even the preserved centre result already rotated source bend heading (-43.302 vs -30.751 at squat f15; much larger deviations occur in near-straight standing). A new exact source-heading constraint cannot reproduce that centre geometry identically at zero. The page keeps the old centre as the requested 0 reference, explicitly labels it as a preserved reference, and does not falsely equate it with a newly solved heading-locked zero. The [0,1] parameter still means zero-to-full ADDITIONAL EDGE REQUEST. No discontinuous return-to-centre special case was added at 0.

### What I actually saw

Viewed the final three-strength focus plates: run front f0/f1/f2/f3/f14, squat 45 degrees f15, and stand_idle front f0. Each plate places source, preserved centre, old edge, 0.25, 0.5, 0.75 at identical physical scale/camera. Observations are sampled, not a claim of watching every native frame.

| Strength | run front f0-f3 and f14 | squat 45 degrees f15 | stand_idle front f0 |
| --- | --- | --- | --- |
| 0.25 | f0-f1 reads as one blue leg with a small red sliver; f2 remains merged. At f3 and f14 the lower endpoints become distinguishable but there is no old-edge-size knee opening. | Blue folded shin stays under the body, with the old horizontal outward hook gone; silhouette is near centre. | Close to centre width; no conspicuous original-edge stance. |
| 0.5 | f1-f2 remains merged; f3 shows a clearer separation near the ankles while upper legs still join. f14 has a narrow lower-leg opening, much less than old edge. | Same tucked bend facing, slightly more root splay than 0.25; no old sideways shin. | Modestly broader than centre: visible additional leg opening, still clearly narrower than old edge. |
| 0.75 | Most lower-leg opening of the three at f3/f14, but f0-f2 is still substantially overlapped. f1/f2 does not recover the old group's separated red bent-leg silhouette. | Folded legs remain recognizable and the blue shin does not stick sideways; somewhat broader than 0.25, rather than perfectly identical to centre. | Additional width is visible relative to centre, though less than old edge. It is not safe to call standing unchanged. |

No tier simultaneously meets all three requested visual criteria. The decisive failure is run f1-f2: old edge has positive horizontal knee gaps 32.72/66.69 mm; even new 0.75 has -66.64/-44.05 mm (stroke overlap). At f0 the old group itself is near overlap (-4.46 mm), so f0 alone is not evidence that old edge completely separates every running frame. The source ankle passes sides near this window. New heading locking retracts the old yaw-based opening, and the remaining root-splay/length freedom under the shared direction/support costs does not restore it. Increasing the tested strength buys more standing width and support error before fixing those run frames. This is an observed tradeoff of this method/settings, not proof that every possible general method is incapable of doing it.

Additional final 0.5 picture checks across all eight:

| Clip / inspected frames | Observed result |
| --- | --- |
| run f15-19 front; f27 side | Crossing window stays merged without a sudden outward opening in these frames. Side view retains forward/back stride and bent trailing leg. |
| walk f17/25/33 front | Walking phases remain; f25 bent red leg lies much closer to blue than in old edge. f33 legs overlap again. Running separation is not secretly achieved by a broader generic walking stance. |
| stand_idle f0 side | Standing and nearly coincident side-view legs remain; no visibly floating-foot event in this reference. |
| ng_juggle_kick_L f7-9/14/17 front | Kick/return recognizable. f14 legs nearly merge; the old edge group's broad opening is lost here too. |
| sit_down f12/37/74 front; f74 45 degrees | Seated thighs and downward shins remain at f74. At f37 the new pelvis/head sit higher and the knees no longer form the centre group's front-view X; exact bend heading has consequences beyond the squat example. |
| squat f15 45 degrees | Blue shin returns from the old horizontal projection; the principal requested squat correction is visible. |
| cross_arms f44/45/72/89 front | Folded forearms remain across the upper body, slightly less compact than centre; standing legs remain broader than centre but narrower than old edge. |
| hands_on_hips f0/5-8 front | Elbow/waist gesture remains. Two lower legs separate more than centre near the ankles, while the upper legs still overlap. This is a visible change from the rejected fully frozen group. |

### Independent geometry and support measurements

All 530 native frames were measured at each strength (1,590 new poses). Maximum true-flexion errors across all four limbs/eight clips are 4.26e-14 / 6.39e-14 / 8.17e-14 degrees at 0.25/0.5/0.75. Maximum source-body bend-heading error is 8.91e-14 degrees at every strength. These establish the imposed relationships, not visual success. Plane inclination remains free: at squat f15, left change is -3.89/-5.79/-8.20 degrees; at stand_idle f0 left/right changes are approximately +/-7.2, +/-8.1, +/-9.1 degrees. The fixed-facing geometry does use root splay; it has not reverted to the previous frozen-direction method.

Foot values use the same source/target leg-normalized ankle/toe height relation as before, converted to target millimetres. Each cell below is **all-endpoint MAE / source-lowest-quintile MAE**; the latter isolates the lowest source endpoints rather than counting higher/airborne feet as planted. Every clip uses the same support objective.

| Clip | Centre reference | Original edge | New 0.25 | New 0.5 | New 0.75 |
| --- | --- | --- | --- | --- | --- |
| run | 5.045 / 3.618 | 5.834 / 3.474 | 5.164 / 3.586 | 5.278 / 3.515 | 5.426 / 3.452 |
| walk | 3.367 / 2.496 | 4.500 / 2.779 | 3.570 / 2.478 | 3.772 / 2.443 | 4.017 / 2.411 |
| stand_idle | 1.757 / 1.372 | 1.879 / 1.390 | 1.758 / 1.379 | 1.732 / 1.381 | 1.677 / 1.381 |
| ng_juggle_kick_L | 2.248 / 2.066 | 3.387 / 2.393 | 2.487 / 1.946 | 2.808 / 1.944 | 3.189 / 1.942 |
| sit_down | 1.928 / 2.492 | 2.120 / 2.574 | 2.031 / 2.441 | 2.068 / 2.446 | 2.101 / 2.451 |
| squat | 1.791 / 2.831 | 6.084 / 2.274 | 3.401 / 2.827 | 4.739 / 2.646 | 6.890 / 2.789 |
| cross_arms | 1.839 / 1.496 | 1.984 / 1.582 | 1.934 / 1.494 | 1.948 / 1.500 | 1.930 / 1.507 |
| hands_on_hips | 2.033 / 1.993 | 2.862 / 1.676 | 3.133 / 1.849 | 3.908 / 1.681 | 4.661 / 1.481 |

| Across eight clips | 0.25 | 0.5 | 0.75 |
| --- | --- | --- | --- |
| Lowest foot stroke edge (mm) | -0.792 | -0.788 | -0.781 |
| Largest endpoint height discrepancy (mm) | 16.732 | 16.729 | 22.722 |

Support is approximate, not identically preserved. The submillimetre floor overlap is inherited in scale, not a hard support guarantee. The 0.75 squat all-endpoint MAE exceeds original edge (6.890 vs 6.084 mm); largest discrepancy is the left ankle at f60, +22.722 mm relative to its source-normalized height. That source endpoint is already above the lowest support band, so this number alone does not establish that a planted foot floats. It is still an increased height-relation error and must not be hidden behind exact bend/heading checks.

Horizontal knee stroke-edge gap diagnostic at the requested front frames, in mm (negative = horizontal overlap; this is not full projected segment clearance):

| Frame | Centre / 0 ref | Original edge | 0.25 | 0.5 | 0.75 |
| --- | --- | --- | --- | --- | --- |
| run f0 | -51.77 | -4.46 | -94.72 | -93.19 | -91.59 |
| run f1 | -31.68 | 32.72 | -72.55 | -69.63 | -66.64 |
| run f2 | -18.54 | 66.69 | -56.44 | -50.39 | -44.05 |
| run f3 | 3.26 | 105.80 | -29.27 | -17.89 | -5.88 |
| run f14 | -21.80 | 64.62 | -60.30 | -51.26 | -41.74 |
| stand_idle f0 | 53.23 | 162.59 | 52.69 | 78.36 | 106.48 |
| squat f15 (front diagnostic, picture is 45 degrees) | 404.25 | 559.87 | 423.50 | 452.52 | 484.19 |

### Files, reproduction and verification

Current results: `width_compare/8-2-edge-swing/<clip>/comparison.npz` is display strength 0.5; `strength-samples.npz` contains all three final solves, alongside `relations-0.25.json`, `relations-0.5.json`, `relations-0.75.json` and solver metadata. `swing-presets.json` controls strengths and the common direction cost. Main page replaces the rejected lowered column; focus plates show all three together. Existing selected frames/crossing windows, front/side/45-degree references and original four reference geometries remain.

Reproduce from repository root: `python -B codex-iter/mapping-analysis/v10/width_compare/run_swing.py`; then the sibling `swing_measure.py`, `render_compare.py`, `render_swing_focus.py`, `verify_compare.py`; finally `node codex-iter/mapping-analysis/v10/width_compare/check_review.js`. To regenerate historical groups, use run_compare.py with an explicit original group selection; its default refuses to accidentally feed the new group through the old mapper. Historical rigid-reproduction instructions above describe the old configuration and are superseded by this workflow.

SHA-256 verification protects 1,081 original Round 6 files, 96 original four-group files, and 33 rejected rigid-lowering result/tool files. All are unchanged. Geometry checks cover source identity, finite coordinates, cached Round 6 equality, shared settings, exact flexion and source-body heading at all three strengths, selected picture freshness, focus images and crossing-window coverage. Node executes the eight offline clip loaders, three strengths, three views, selected frames, step/play controls and six canvases. Actual final JPGs were inspected as listed above; no live-browser pixel validation is claimed. No game, commit, push or edits to godot/docs/assets.


## Round 7 - nominal totals include width; small relative adjustment

Request: continue the R6 8:2 centreline mapping, following Hsinlung's sit_down f51 observation, "大腿太长了啊". The mapping is still unaccepted. The width/edge line is parked; WIDTH-COMPARE.html and all 262 width_compare/ files remain untouched. R6 geometry, params, mapper and manifest were preserved in round6-baseline.npz before changing the main library.

Confirmed causes: R6 replaced nominal segment lengths with projections of the width-added vectors, so nominal .36 m thighs were already roughly .42 m standing. Its positive exponential extensions had no bound; sit_down thighs reached .488 m and squat thighs .473 m while shins compressed. An absolute source pelvis-height target competed with shorter target legs. These were method errors, not clip-specific exceptions.

The R7 width allocation is internal to the nominal total. For each proximal/distal segment, reserve share * magnitude(width) from L, form (L - reserved) * original_bone_unit + share * directed_width, then fit the same one common rigid rotation of the true bone pair as R6. Shares stay .8/.2. This determines preferred directions, never new nominal lengths. Final length is L * (1 + epsilon), with every adjustable epsilon explicitly bounded to [-.03, .03]. The same relative envelope applies to torso, neck, both upper/lower arms, both thighs/shins and feet; head radius stays fixed. Feet also have bounded lengths and independent continuous rotations, rather than unbounded raw endpoints. All original contact weights, line radii and centreline charts remain.

Root travel is constrained horizontally; source pelvis/torso-height objectives are removed. Initial body height is derived from the nominal leg geometry and measured source-relative feet, and the simultaneous solve reconciles the foot goals and bounded legs. There is no separate source hip height for the solver to purchase by stretching thighs. Low hands/elbows/knees still have continuous source-derived support; physical line/head nonpenetration remains soft.

Two audit omissions were repaired globally. R6's claimed exact elbows actually used shoulder-elbow-palm-centre, not shoulder-elbow-wrist (for example ng_penalty_kick right f36 differed by 6.793 degrees from the true wrist elbow). R7 uses the actual wrist bone direction for fitting and independent measurement; contact representatives remain palms. R6 also scaled a rotation-vector x component rather than the visible sagittal pitch (ng_scissor_kick f30 differed by 2.478 degrees). R7 measures neutral-corrected head-up pitch in the source torso sagittal plane, rotates that component by .6, and independently checks the actual target neck-to-head line. Neck stays exactly along the torso.

An initially tested tanh length envelope was rejected during all-frame auditing. cover_eyes f54/55/56 left forearm lengths were .38168/.36092/.37875 m despite smooth source/contact goals; added hand second difference peaked at 26.431 target mm/frame^2 at f55. cover_ears peaked at 12.176 at f21. Saturated variables could not readily move back into their box, stranding adjacent frames near opposite limits. Doubling that solver's ceiling did not reliably remove the saturation artifacts, and SEED pickup still moved by 16.665 mm between 2,000 and 4,000 iterations. Evidence is preserved in round7-solver-diagnosis.npz/.json; these are rejected diagnostic poses, not the review geometry.

The final solver uses the same geometry, objective and +/-3% feasible lengths with explicit L-BFGS-B bounds and analytic Torch gradients. Saturated lengths can re-enter the interval. Native frames are optimized together; no action names, per-action weights, frame fixes or post-solve smoothing enter mapper.py. One global ceiling of 6,000 replaces the truncating 2,000; tolerance may stop any clip earlier. Fixed-window final pictures cover_eyes f53-57 and cover_ears f19-23 show continuous successive positions without the rejected length flicker. Residual added acceleration is still measured and reported, not declared zero.

Final all-frame measurements and final sampled observations follow below. Earlier R1-R6 and width-experiment tables above are historical evidence; they are not R7 acceptance or current geometry.

### Final R7 result and sampled review

All 47 clips / 6,245 native frames were rebuilt with the final explicit-bound solver and the same global settings. REVIEW.html is R7, with 805 native-frame JPG pages, three source/target pairs per frame, current lazy arrays and independent per-clip relations. Every source array is element-identical to R6, input file hashes match, and all 262 parked width_compare/ files retain their original SHA-256. No game, commit, push or writes to Godot/docs/assets.

Across all native frames, largest nominal segment deviation is 3.000000%. True knee/elbow discrepancy maxima are 1.07e-13/8.53e-14 degrees. Actual .6 pitch and neck/torso-collinearity discrepancy maxima are 7.63e-14/5.74e-13 degrees. These establish only the stated geometric contracts. sit_down f51 thighs are 0.370800/0.370800 m, compared with R6 .471574/.477059 m; the matched focus image shows shorter thighs and lower hips.

Support remains approximate. Largest foot height-relation discrepancy: ng_scissor_kick right toe f43, -23.821 mm; lowest target foot stroke edge: sit_down right toe f17, -0.806 mm. The first number is source-normalized endpoint height difference, not automatically a planted-foot float. Per-clip lowest-source-band MAE and actual minimum stroke heights are in AUDIT-R7.md.

Largest remaining added endpoint second difference: ng_scissor_kick right ankle f24, 6.493 target mm/native-frame^2, during the airborne kick. Other inspected residual windows include wipe_sweat_forearm f66-70, cover_ears f84-88, clap f31-35, scratch_head f50-54 and phone_call f15-19. These retain successive movement in the pictures; additional curvature/acceleration remains measured and is not declared eliminated.

44 solves met numerical stopping tolerance; seed_pickup, seed_jog, seed_lunge reached the common 6,000-iteration ceiling. The remaining numerical limitation is the whole-clip native-120-fps fit under the strong acceleration cost; convergence of those three is unconfirmed. Their saved results remain subject to this limitation. No source downsampling or length-envelope relaxation was used to hide it.

Final picture coverage: re-inspected final audit-01..10, every clip at N//3 and 2*N//3 in front, side and 45 degrees, plus the specific final focus/dense frames named below. This is sampled picture inspection, not a claim of watching all native frames in motion. Earlier prototype judgments were refreshed against the final explicit-bound images. Remaining compact elbows, hand-pair compression, frontal stroke overlap, one-line curved-back simplification and missing furniture/partner evidence are retained in the table. Current contact charts still trade these relations against nominal proportions and true bending; this is the present fit, not proof that no general improvement is possible.

| Clip | Actually inspected final native frames (front/side/45) | Judgment / remaining difference |
| --- | --- | --- |
| stand_idle | f40,f80 | Standing legs remain straight and feet are near the plane at f40/80. Thighs no longer contain added hip-width length. Hanging arms still lie closer to the torso than source. |
| sit_down | f25,f50,f51,f74 | Descent f25 and seated knees f50 remain. Matched f51/74 R6/R7 views show visibly shorter thighs and lower hips; f51 left/right thighs are about .371 m rather than .472/.477 m. Hands remain by the lap; no chair surface is supplied. |
| cross_arms | f30,f60 | Folded forearms across the upper torso remain at f30/60. Target elbows are noticeably narrower/closer than source in front view; side/oblique still reads folded arms. |
| cover_ears | f19,f20,f21,f22,f23,f39,f78,f84,f85,f86,f87,f88 | Both hands at the sides of the enlarged head remain at f39/78. Elbows sit lower/narrower than source, with partly hidden hands from front; side shows the ear-region relation. Final fixed f19-23 no longer has the rejected length flicker; f84-88 releases continuously in the inspected images, with residual added left-hand acceleration at f86. |
| seed_pickup | f125,f160,f250 | Forward bend/reach and recovery remain at f125/250; matched f160/250 R6/R7 views show shorter thighs and preserved foot support/reaching-arm roles. The curved source back is simplified to a line. Solver still reaches 6000 iterations; this sequence is not claimed converged. |
| walk | f11,f22 | Alternating stance/swing and opposing arms remain recognizable. Front f11 legs overlap into a narrow column; f22 side stride remains clear. Hanging hands remain closer to the torso than the source. |
| run | f14,f28 | Side f14 bent swing and f28 long stride remain running. Front f14 knees/shins merge; the centreline overlap remains, with the separate width experiment parked. |
| jog | f9,f18 | Side f9 folded trailing shin and f18 opposing stride remain jogging. Front legs overlap heavily; bent arms are compact around the chest. |
| pick_up | f50,f100 | Low crouch and forward reach remain. Source f50/100 reaches forward rather than to the ground; target f100 reaching arm is held more forward/higher. Not evidence for a floor pickup; seed_pickup supplies that source activity. |
| bow | f35,f70 | Forward bow at f35 and upright recovery f70 remain. Knees stay straight. The one-line torso simplifies the curved source back; actual reduced head pitch follows the torso. |
| sit_bench | f30,f60 | Shorter seated thighs, downward shins and hands near the lap remain at f30/60. Knees and elbows look more compact than source in front view; no bench surface is supplied. |
| sit_ground | f50,f64,f85,f100 | f50 descent and f100 knees-up seated/back-hand-support pose remain. Also inspected f64/85 in the overview: hands are by the plane. Front thick leg/arm strokes merge more than the thin source lines. |
| squat | f15,f20,f40,f51 | Deep folded legs and forward/down hands remain at f20/40. Also inspected matched R6/R7 f15/51: thighs shorten and shins no longer shrink to compensate; frontal leg folds remain densely occluded. |
| squat_down | f40,f51,f68,f80,f85 | Descent f40 and low folded legs f80 remain. Front lower limbs are densely merged; the side view preserves the squat. Also inspected f51/68/85: the straight target torso cannot reproduce the curved source back. |
| squat_watch | f40,f80 | Low crouch and downward arms remain at f40/80. Front knees/hands crowd together; side shows the source curved back replaced by one straight torso line. |
| hands_on_head | f34,f40,f68,f80 | Hands reach crown/upper head at f40/80, but elbows remain visibly lower and narrower than source. The same difference is visible at overview f34/68; short upper-arm/long forearm proportions and enlarged head compete with source bend/contact. |
| scratch_head | f30,f50,f51,f52,f53,f54,f60 | Raised right hand and release remain at f30/60. Dense f50-54 has continuous successive positions with no isolated snap visible in those pictures; measured added right-hand acceleration remains at f52, not eliminated. |
| rub_eye | f30,f60 | One hand at the forward face f30, lowering f60, opposite arm down. Hand partly hidden in front view; side reveals the relation. Target raised elbow remains lower/closer than source. |
| cover_face | f30,f60 | Both hands at lower/front face f30 and withdrawal f60 remain. Front head occludes part of the hands; side shows the contact. Also inspected f25/51: no upper-forehead placement is claimed. |
| hands_on_hips | f30,f60 | Waist hands and outward elbows remain at f30/60. Narrow standing leg strokes overlap strongly; target elbows are narrower than the source, and no edge-spacing solve was applied. |
| hands_in_pockets | f30,f60 | Hands near pelvis and bent elbows remain at f30/60, with reduced downward head pitch. Source hanging-hand/torso separation is larger; pocket geometry is absent. |
| handshake_offer | f50,f100 | Solo forward offer at f50 and withdrawal f100 remain. Hand is forward and below neck in side view; target arms look more compact. No partner is supplied, so actual hand-to-hand contact is unobserved. |
| handshake_reply | f50,f100 | Forward reach/hold remains at f50/100 with opposite arm down. Solo gesture is recognizable; no second actor is supplied to check handshake contact. |
| rub_hands | f30,f60 | Paired hands stay together in front of upper torso at f30/60. The target contact sits close below the large head and its elbows are more compact; rubbing is represented only by endpoint motion. |
| phone_call | f15,f16,f17,f18,f19,f40,f80 | Right hand at cheek f40/80, opposite arm down. Dense f15-19 approaches continuously in the inspected images; added right-hand acceleration at f17 remains measured. No handset is supplied. |
| phone_urgent | f30,f60 | Sustained cheek-hand gesture and torso/head lean remain at f30/60. Target bent elbow sits more compactly than source; no handset geometry is present. |
| point | f35,f70 | Forward arm stays almost straight at f35/70 in side/oblique views; no width-induced elbow kink. Front projection foreshortens the pointing arm as in the source. |
| look_down | f30,f60 | Reduced downward head tilt is visible at f30/60; neck stays along the torso. Hanging hands are still closer to torso than source. |
| look_up | f30,f60 | Upward head tilt is reduced at f30/60 without a forward neck extension. Feet remain near the plane in these samples; source arm spacing remains larger. |
| stand_up | f25,f50 | Seated knees f25 and bent-leg rise f50 remain. Thighs are shorter than R6; hands remain by thighs/hips. There is no chair surface to verify. |
| stand_up_support_back | f40,f80 | Forward-leaning rise f40 and near-upright recovery f80 retain arms behind the body. No supporting furniture is supplied; side/oblique views show the arm-back relation. |
| kneel_hold | f0,f20,f34,f40 | Upright kneeling and rear-folded shins remain at f20/40. Also inspected overview f0/34: leg strokes merge from front while side preserves kneeling; source knee-to-floor clearance itself is nonzero. |
| lean_railing | f30,f60 | Backward bent arms and torso lean remain at f30; asymmetric arm/weight shift at f60 remains. No railing surface is present; target bent arms are more compact. |
| wipe_sweat | f30,f60 | Forearm near lower/front face f30 and withdrawal f60 remain. Source does not clearly wipe the upper forehead; this limitation is in the source activity itself. |
| cheer | f35,f70 | Both raised bent arms and body bounce remain at f35/70. Target elbows sit closer to/lower around the large head than the source; the side body lean is retained. |
| hands_up | f35,f70 | Both raised bent arms remain at f35/70. Target elbows lie closer to the large head than source, and the upper-arm silhouette is more compact. |
| cover_eyes | f35,f53,f54,f55,f56,f57,f70 | Both hands reach the forward eye region at f35/70. Front head occludes the endpoints; side/oblique reveals them, with lower/closer elbows than source. Final f53-57 is steady through the rejected f55 length-flicker window; remaining acceleration is quantified independently. |
| clap | f31,f32,f33,f34,f35,f74,f149 | Paired forward hands and elbow folds remain at f74/149. At f74 the target palms remain visibly closer together than the separated source hands: hand-pair separation is still compressed in this solve. Dense f31-35 shows successive opening positions; measured added right-hand acceleration at f33 remains. |
| point_forward | f35,f70 | Forward arm remains nearly straight at f35/70, clearest from side. Hanging opposite arm remains closer to the torso than source; there is no artificial elbow kink. |
| wipe_sweat_forearm | f38,f66,f67,f68,f69,f70,f76 | Forearm sweep across the lower/front face f38 and withdrawal f76 remain. Source does not clearly wipe the upper forehead; target hand/forearm is partly hidden by its large head in front view. Side f66-70 has a more pronounced forearm release rotation than source; added right-hand acceleration remains at f68. |
| ng_idle_offensive | f106,f212 | Weight shift f106 and raised bent leg f212 remain. Supporting leg is long/straight as in source; downward arms remain closer to torso after shoulder collapse. |
| ng_jog_fwd | f8,f17 | Opposing running stride at f8/17 remains in side view. Front knees/lower legs merge; target elbows are more compact than source. |
| ng_juggle_kick_L | f6,f8,f12,f14 | Supporting red leg and lifted blue leg remain at f6/12. Matched f8/14 shows extension then folded return, with shorter thigh than R6 and unchanged support/swing roles; frontal lower-leg overlap remains at f14. |
| ng_penalty_kick | f15,f24,f30 | Run-up f15 and follow-through f30 remain. Matched f24/30 views show forward kicking red leg and bent blue support leg; thighs shorten without changing the source knee bends. Front legs overlap during passing. |
| ng_scissor_kick | f22,f23,f24,f25,f26,f28,f32,f38,f56 | Airborne scissor f28 and seated recovery f56 remain. Matched f32/38 views retain raised legs/ground roll; the enlarged target head sits close to the floor and thick arm/leg strokes merge during the roll. Dense airborne f22-26 retains continuous kick rotation; right-ankle added acceleration peaks at f24, before the ground roll. |
| seed_jog | f127,f255 | Bent running legs, stride/flight and opposing arms remain at f127/255. Front f255 lower legs merge despite separated source lines; side stride stays readable. Solver reaches 6000 iterations, so numerical convergence is unconfirmed. |
| seed_lunge | f348,f696 | Forward stride f348 and low bent-knee lunge f696 remain in side/oblique views; nominal shorter thighs lower the figure relative to R6. Frontal lower-limb overlap remains. Solver reaches 6000 iterations; convergence is unconfirmed. |

Final reproduction: run.py; render.py; audit_round7.py; render_r7.py; audit_sheets.py and audit_sheets.py --endpoints; refresh render.py --index-only after notes; verify.py; node check_review.js (all scripts under v10). The audit has one row per clip and worst-frame numbers for all segment lengths, ratios, anatomical bends, foot heights, hand/torso relation, actual head pitch, neck alignment and all six endpoint accelerations. Offline player checks establish control/data execution, not browser pixel validation. Mapping remains unaccepted.
