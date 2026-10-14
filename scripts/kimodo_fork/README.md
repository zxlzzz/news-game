# Changes to the local Kimodo fork (C:\kimodo-trial\kimodo, mounted at /workspace)

The fork lives outside this repository; these copies keep our changes versioned.

- `scene_guidance.py` → copy to `C:\kimodo-trial\kimodo\kimodo\scene_guidance.py`. Scene guidance: during the late
  denoising steps the clean-motion prediction is nudged so the game's stick figure (thick strokes, big head) stays
  out of object boxes. Used by `scripts/kimodo_motion_batch.py` when a request has `"scene"`. The correction is
  blurred along the frames before it is applied (`"blur"`, default 2 frames): applied raw it made the output tremble
  (2026-10-14).
- `kimodo_model_hook.txt` → the four lines to insert in the fork (it is not a git checkout): call `model.scene_guidance` in `denoising_step` between the
  clean prediction and the sampler.

Boxes come from `godot/tools/export_scene_boxes.gd` (object type + post marker, stance frame).
A held thing (`"item_boxes"`, `"item_hand"` in the request's scene) is kept off the torso, head, thighs and the arms
up to just before the hands. Requests are normally written by `scripts/motion_request.py` from
`assets/motion_specs/<clip>.json` (docs/动作重做方案.md §11), not by hand.
