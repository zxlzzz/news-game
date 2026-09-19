# NPC motion study

Independent preview: `http://localhost:<port>/sth/motion-study/` from the repository's HTTP server.
No game runtime imports or source NPZ edits. This is a visual experiment, not a finalized NPC rig.

Two synchronized views compare the accepted version against a further line refinement:

1. Accepted 11-point silhouette, anatomical head attachment and `DEFAULTS` body proportions.
2. The same motion with a narrower default shoulder and continuous limb-width taper and a small quadratic
   rounding of elbow/knee corners. Hands and feet stay at the exact retargeted endpoints.
   At softness 0.7 each corner trims at most 5.25 cm along its incident source segments;
   the visible curve displacement is smaller. This only changes drawing, not joint data.
   The central neck/torso junction sits 20% from Neck1 toward Chest. Each upper arm
   retains its own LeftArm/RightArm shoulder start: collapsing these to the central
   junction caused the drawn arms to cross the head despite the internal rig being clear.
   A cubic curve leaves the torso outward, uses the shoulder as a control point,
   then joins the upper arm a short distance below/along it. This removes the old
   overshooting shoulder hook while retaining the shoulder as an anatomical guide.
   Wrist endpoints stay fixed after retargeting; debug markers show shoulder guides.


Hsinlung selected the adjusted proportions and 3× stroke width. Hip/spine helpers remain
internal; shoulder guides route the visible arms without drawing the full anatomical skeleton.
Shoulder width is adjustable from 0.50 to 1.30, with a candidate default of 0.85
(previously 1.08). Narrowing it can increase head/arm overlap at some viewing angles.
Proportion/contact controls affect only the right column; the left uses the accepted defaults.
The shared stroke multiplier affects both figures (including street scale), defaults to
3×, and ranges from 0.5× to 4×. It leaves head radius and ground guides unchanged.
Softness 0 disables corner rounding but retains continuous taper. The refinement is a
candidate, not a replacement accepted by Hsinlung.

Validation includes the actual arm drawing path at the reported raised-arm frame 55:
with defaults its 3D centreline clears the head proxy by approximately 4.0 / 7.6 cm at the original 1.08 shoulder setting.
This is not a universal collision guarantee: projection, stroke thickness, parameter
changes and other source poses can still create overlap; palm/finger contact is not solved.

The browser uses a simple orthographic canvas renderer. It reproduces the skeleton geometry,
not Godot's complete scene shader. It follows horizontal root motion, shares camera/scale/time
across panels, and pauses at clip end. The source is Y-up metres; nothing is flattened to 2D
before the camera projection. Original head/finger articulation is not fully represented.

`motions.json` is a reproducible subset of six existing NPZs: stand_idle, phone_walk,
scratch_head, squat_watch, bow, wave_both_overhead. All frames are retained. `squat_watch`
is a holding pose, not a squat-down transition. Ankle = Foot, wrist = Hand, head top = HeadEnd.
The 26 retained joints follow the official SOMASkeleton77 names/parents.

Rebuild data (numpy, no model/GPU needed):

```powershell
python scripts/export-motion-study.py --skeleton-definition C:/kimodo-trial/kimodo/kimodo/skeleton/definitions.py
node scripts/check-motion-study.mjs
```

Source foot slip/penetration are retained, not silently fixed. Wrist proximity is a heuristic;
there is no precise palm, finger or object-contact solver. Extreme slider combinations may
make goals unreachable; bone lengths remain fixed and the UI reports clamped targets.
Default parameters are experimental. No classification, exit phases or runtime migration is implied.
