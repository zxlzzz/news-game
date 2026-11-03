# Building window sealing — 2026-09-29

Authorized scope: seal building windows, keep hollow interiors, replace the existing
models directly. No room design, scene edits, shader changes or Git commit.

## Result

- Replaced 42 `godot/models/building*.glb` files. The open construction site is
  unchanged. The parking garage keeps its open structure; its roof-room reveal
  winding is corrected.
- Corrected 10,816 reversed triangles in window/door reveals in the newer batch.
  The old edge-closure check could not detect this: the edges were joined but the
  adjacent faces had inconsistent winding. This produced visible holes in shadows.
- Expanded 1,662 opaque window panels into their jambs by 2 cm on each edge.
  Ground-level door dimensions stay unchanged. Roof doors are sealed as described below. Existing recessed windows and shop display niches
  retain their exterior shape.
- Added inward-facing boundaries to 59 building volumes (including 13 roof rooms) (some assets contain
  several volumes). These define empty cavities behind the sealed outer walls;
  they are not solid filler blocks. No rooms, partitions or furniture were added.
  Inner walls sit behind the deepest relevant recess plus an 18 cm backing; roof
  and base thickness is 18 cm. Dimensions live in `../../building-seal.json`.

Roof-door completion: 12 models contain 13 roof doors, including prefixed rooms in
rowhouses. These rooms now have hollow inner boundaries too. Their door panels
overlap the jambs by 2 cm and close 4 cm behind the facade, replacing the previous
48 cm deep entrance recess. The verifier checks this setback. All 12 models were
rebuilt twice identically and replaced directly. `roof_door_before.png` and
`roof_door_after.png` show the close-up. `before_roof_doors.zip` preserves the
models immediately before this additional repair.

## Rebuilding and checking

The existing `build_building_<name>.py` entry points now finish with
`../../building_seal.py`. Keep that helper, its JSON and `../../check_model.py`
beside the builders. Blender builders still use Blender; the newer architecture
builders still use Python + Shapely. The pass runs on freshly built GLBs, not on
already processed models (a second application is an error).

- All 42 modified models were rebuilt from their scripts twice: byte-identical.
  `rebuild_hashes.json` records the final hashes.
- All 43 buildings pass `check_model.py`.
- `python godot/modeling/check_building_shells.py` reports
  `BUILDING_SHELLS_OK 43 models; 59 hollow bodies` (`shell_checks.txt`). It checks
  consistent winding and closed boundaries, negative-volume cavity surfaces, and
  six rays from each cavity that cross an inner wall followed by an outer wall.
- Six representative models were inspected in Godot: corner shop, walkup,
  office tower, department store (including angled turret windows), laundry and
  hotel. Matching before/after captures for corner shop and walkup are retained.
  The walkup's numerous bright holes in its ground shadow are gone.
- `res://modeling/review_buildings.tscn -- --asset building_walkup_a --shot <png>`
  is an isolated visual check without crowd/navigation simulation. It uses the
  existing game palette and shading. `--model <glb path>` reads a comparison GLB
  directly; `--yaw <degrees>` changes the view.

General shadow-map edge offset/aliasing is unchanged; this task fixes the building
geometry, not all possible lighting artifacts.

## Rollback

`originals.zip` contains the original building models, builders and import settings
from before this work. To undo this change, restore the modified model and builder
paths from that archive (do not reset unrelated workspace changes). The shared
sealing helper/config and new review/check tools can then be removed. No existing
import settings were changed. Reimport the restored GLBs in Godot.
