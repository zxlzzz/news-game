# NPC motion study

Independent preview: `http://localhost:<port>/sth/motion-study/` from the repository's HTTP server.
No game runtime imports or source NPZ edits. This is a visual experiment, not a finalized NPC rig.

Two synchronized views compare the accepted version against a further line refinement:

1. Accepted 11-point silhouette, anatomical head attachment and `DEFAULTS` body proportions.
2. The same initial pose/proportions with continuous limb-width taper and a small quadratic
   rounding of elbow/knee corners. Hands and feet stay at the exact retargeted endpoints.
   At softness 0.7 each corner trims at most 5.25 cm along its incident source segments;
   the visible curve displacement is smaller. This only changes drawing, not joint data.
   The common drawn arm/torso junction sits 20% from Neck1 toward Chest instead of
   at Neck2, leaving a short visible neck. Chest itself was too low; the moving
   shoulder midpoint rises too far during arm lifts. The display still has 11 points: it replaces the junction rather
   than exposing extra shoulder joints. Head, elbows, hands, knees and feet are unchanged.

Hsinlung selected the adjusted proportions and 3× stroke width. Shoulder/hip/spine helpers
remain internal; their anatomical connections are not drawn, including in the joint overlay.
Proportion/contact controls affect only the right column; the left uses the accepted defaults.
The shared stroke multiplier affects both figures (including street scale), defaults to
3×, and ranges from 0.5× to 4×. It leaves head radius and ground guides unchanged.
Softness 0 disables corner rounding but retains continuous taper. The refinement is a
candidate, not a replacement accepted by Hsinlung.

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
