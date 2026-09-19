# NPC motion study

Independent preview: `http://localhost:<port>/sth/motion-study/` from the repository's HTTP server.
No game runtime imports or source NPZ edits. This is a visual experiment, not a finalized NPC rig.

Three synchronized views isolate the changes:

1. `style_test`'s 11 selected points and old connections (head attachment included).
2. The same 11-point connections and source proportions, anatomical head axis and lighter distal strokes.
3. The same 11-point connections and stroke treatment, adjustable internal bone lengths, two-bone leg IK preserving
   source ankle X/Z trajectories and foot clearance, optional wrist-to-head proximity correction.

Hsinlung preferred the original 11-point silhouette. Shoulder/hip/spine helper joints remain
internal; their anatomical connections are no longer drawn, including in the joint overlay.
Proportion controls affect only the right column. The left column remains the original baseline.

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
