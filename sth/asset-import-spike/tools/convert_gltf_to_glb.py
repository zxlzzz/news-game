"""Convert glTF files to self-contained, colour-preserving GLB files with Blender.

Usage after Blender's `--` separator:
    source.gltf output.glb [source.gltf output.glb ...]
    --source-dir source_directory output_directory

The directory form converts every .gltf directly inside source_directory and
keeps the original stem.  No texture or material colour transformation is
performed; Blender is used only to repack each asset as a self-contained GLB.
"""

from pathlib import Path
import sys

import bpy
from mathutils import Vector


def scene_bounds():
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return None
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


def convert(source: Path, output: Path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))

    bounds = scene_bounds()
    if bounds:
        lo, hi = bounds
        size = hi - lo
        print(
            f"ASSET_BOUNDS {source.name}: "
            f"min=({lo.x:.3f},{lo.y:.3f},{lo.z:.3f}) "
            f"max=({hi.x:.3f},{hi.y:.3f},{hi.z:.3f}) "
            f"size=({size.x:.3f},{size.y:.3f},{size.z:.3f})"
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_yup=True,
    )
    print(f"WROTE_GLB {output}")


args = sys.argv[sys.argv.index("--") + 1 :]
if args[:1] == ["--source-dir"]:
    if len(args) != 3:
        raise SystemExit("Expected: --source-dir source_directory output_directory")
    source_dir = Path(args[1]).resolve()
    output_dir = Path(args[2]).resolve()
    sources = sorted(source_dir.glob("*.gltf"), key=lambda path: path.name.lower())
    if not sources:
        raise SystemExit(f"No .gltf files found directly inside {source_dir}")
    args = []
    for source in sources:
        args.extend((str(source), str(output_dir / f"{source.stem}.glb")))

if not args or len(args) % 2:
    raise SystemExit("Expected source/output path pairs or --source-dir after --")

for index in range(0, len(args), 2):
    convert(Path(args[index]).resolve(), Path(args[index + 1]).resolve())
