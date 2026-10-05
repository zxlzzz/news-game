# Pigeon local pose and transition library

Implemented; numerical checks and assistant actual visual review completed.
Hsinlung's acceptance of the motion acting style is pending. The caller
owns the root position, heading, destination and route. Each selection samples
only its named action. No fixed circle, world position keyframes or autonomous
action sequence is stored in this library.

## Interface

- `PigeonMotion.entries()` returns bare id, Chinese label, duration, loop,
  start_pose, end_pose, variant, support, frame, root_height and target_height.
- `duration(id)` and `loop(id)` read the named entry's contract.
- `sample(id, time, Pigeon.load_params(), context={})` returns local points that
  can be passed directly to `Pigeon.silhouette`. Origin belongs to the caller;
  +Y is up and +Z is forward. Nonloops clamp, loops wrap their own duration.
- `channels(id,time)` exposes the sampled scalar pose controls for diagnosis.
- `library()` reads `npc/pigeon-motion.json`; missing/invalid names, keys, values
  or incompatible wing-frame counts fail explicitly.

`context.velocity` supplies the climb angle through vertical/horizontal speed;
its horizontal heading is deliberately not applied. `turn_rate` supplies bank,
positive heading rotation toward +X banking that side down. `brake` extends feet,
raises the body pitch and spreads the tail. The caller independently rotates and
places the resulting figure. Adaptation is continuous, bounded by JSON values,
and fades with the pose's air_weight so shared grounded endpoints stay identical.
Changing context does not choose a different entry or advance a hidden route.

## Contents and endpoints

37 independent entries comprise 10 held poses, 4 ground/flight loops and 23 single
transitions. They include folded/spread/upstroke/downstroke/glide/climb/dive,
left/right bank and brake/extended feet; continuous flap, ground stepping, pecking
and looking; direct/raised wing unfold and fold; two launch processes; two
flap-to-glide processes; climb/dive/bank enter/exit; left-to-right bank; braking,
two landing processes, touchdown folding and a separate hop.

Shared pose ids are the composition contract. Endpoints interpolate complete
scalar poses without a discrete air/ground mode switch. Native wing rings come
from existing `pigeon-wings.json`; legs keep the existing two-bone solve and
silhouette renderer. The procedural renderer only adds optional head-rest,
foot-point and toe-curl overrides, leaving all existing create/step inputs and
ordinary state behavior unchanged.

Same-endpoint alternatives differ in their middle process: direct wing spreading
versus raising then spreading; direct folding versus raising then folding;
crouch/downstroke launch versus open/upstroke launch; completing a flap versus
lowering held wings into glide; steady foot placement versus crouch absorption.
For landing the 18 mm crouch is 24% of the 75 mm hip height, so a blanket 25 mm
point-difference threshold would reject this meaningful body difference. The
check uses 15 mm and records actual differences; it is not a change to geometric
reach/floor tolerances or a visual-quality pass.

Hop is a 0.65 s single folded→folded action. It crouches, prepares the leg/wing
configuration before lifting, shows an 80 mm local body lift, then plants feet,
crouches 18 mm to absorb and returns to folded standing. It stores no horizontal
target or world root route. Local body_lift/crouch describe body motion relative
to the caller's root. The initial leg mix was caught below its local support
plane and replaced by preparing the tucked chain before leaving it; no floor
clamp was added.

## Checks and preview

`check_pigeon_motion.gd` samples all 37 entries at 120 Hz, in neutral and continuous
flight contexts. It verifies finite/drawable points, unchanged leg lengths,
ground foot clearance, deterministic seek, once-end holding, loop seam proximity,
116 shared-pose connections, five distinct variant pairs, hop lift/absorption and
the legacy create/step walk/peck/fly/land API. Horizontal velocity X/Z interchange
does not turn the pose; vertical speed and turn rate change the sampled attitude.
Results are `library_check.json` and `check.log`: `PIGEON_MOTION_OK`.

Ground preview root height is 0. Air/transition preview root height is a fixed 0.35 m
so the full downstroke, whose local wing tip reaches about −0.15 m, clears the
floor. This is framing data applied by the preview caller, not a generated flight
route. Thus transition previews show the posture at a constant root height;
actual world takeoff/touchdown placement remains the caller's job.

## Actual visual review

Every entry was reviewed at its own duration: all 37 × 24 times × three views,
plus nine dense transition/hop captures at 48 times × three views. Flapping was
reviewed at all 96 times over 1.6 s (60 Hz, two periods). The 23 single actions
were also reviewed at their exact duration and duration + 0.1 s from all three
views. These endpoint images show the declared final pose being held; the
earlier i/n capture's near-end image was not treated as its exact endpoint.
The per-entry observations, reviewed indices and source paths are in
[review_coverage.json](review_coverage.json).

The five pairs with matching endpoints have visibly different middle processes.
The dense launch captures distinguish a crouch/full downstroke from unfolding
into an upstroke. Flap-to-glide distinguishes completing a stroke from lowering
the raised wings directly. Hop shows crouch, local lift, descent and absorption
before returning to folded standing. The two flapping periods continue without
an observed pause or pose switch. No leg flip or disconnected chain was observed
in these captures. This is an assistant visual observation, not acceptance of
the style or a claim of biological realism.

The following limits remain:

- Air/transition previews use a static 0.35 m root height. Launch, landing and
  touchdown-fold therefore show local posture while the grounded endpoint can
  still float above the preview floor. They do not demonstrate completed world
  takeoff/touchdown; caller positioning must provide that motion.
- Ground stepping visibly alternates the feet, but the head and torso stay fixed.
  It reads lightly at the general preview scale.
- Looking is only a small beak-direction change; the spherical head center stays
  fixed. It is particularly difficult to read from the side.
- Landing absorption is a small crouch and is less distinct at distant framing.
- The named-motion previews use neutral context. A separate fixed-root actual
  comparison now reviews flap/glide under constant climb/left/right/brake inputs
  (see [context_review.md](context_review.md)). Time-varying route context and an
  external route playing all 116 possible connections were not visually reviewed.

## Review media and provenance

[gifs/](gifs/) contains 14 one-pass GIFs made only from the recorded pixels:
the five variant pairs, hop, flap, ground stepping and looking. Singles append
the separately captured exact endpoint and 0.2 s of hold. Timing uses cumulative
10 ms quantization, not rounding each high-frequency frame independently.
All encoded total durations match their requested total; per-frame durations,
source times and pixel/input hashes are in [gifs/timing.json](gifs/timing.json).

Suggested comparisons:

- [Direct unfold](gifs/pigeon_unfold_direct.gif) and
  [raised unfold](gifs/pigeon_unfold_lift.gif).
- [Power launch](gifs/pigeon_launch_power.gif) and
  [open launch](gifs/pigeon_launch_open.gif).
- [Stroke to glide](gifs/pigeon_flap_to_glide_stroke.gif) and
  [soft glide](gifs/pigeon_flap_to_glide_soft.gif).
- [Landing flare](gifs/pigeon_land_flare.gif) and
  [landing absorption](gifs/pigeon_land_absorb.gif).
- [Hop](gifs/pigeon_hop.gif) and [two flap periods](gifs/pigeon_flap.gif).

`make_review_media.py` can rebuild this media and the ground-detail crops from
the manifests. It does not generate or modify poses. `snapshot.json` records
the frozen library/check inputs. The capture manifests record the actual
renderer/tool inputs at capture time; a later removal of an unused controller
override path from the capture tool changes that tool's current hash, not these
already captured pixels or the frozen bird library.
