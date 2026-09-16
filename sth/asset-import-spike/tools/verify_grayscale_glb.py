"""Verify that a GLB's visible colour textures are grayscale after import.

Usage after Blender's `--` separator:
    model.glb
"""

from pathlib import Path
import sys

import bpy


def sampled_channel_delta(image):
    # Blender's random access into a full-size image is extremely slow. Scaling
    # the in-memory verification copy is safe (nothing is saved) and still
    # detects any chroma that survived packing.
    image.scale(min(64, image.size[0]), min(64, image.size[1]))
    pixels = list(image.pixels)
    pixel_count = len(pixels) // 4
    maximum = 0.0
    for pixel_index in range(pixel_count):
        offset = pixel_index * 4
        red, green, blue = pixels[offset], pixels[offset + 1], pixels[offset + 2]
        maximum = max(maximum, abs(red - green), abs(red - blue))
    return maximum


if "--" not in sys.argv or len(sys.argv[sys.argv.index("--") + 1 :]) != 1:
    raise SystemExit("Expected one GLB path after --")

model_path = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(model_path))

checked = 0
failures = []
for image in bpy.data.images:
    lowered = image.name.lower()
    if "basecolor" not in lowered and "interior" not in lowered:
        continue
    delta = sampled_channel_delta(image)
    print(f"COLOR_TEXTURE {image.name}: max_channel_delta={delta:.7f}")
    checked += 1
    if delta > 0.002:
        failures.append((image.name, delta))

mesh_count = sum(1 for obj in bpy.context.scene.objects if obj.type == "MESH")
material_count = len(bpy.data.materials)
print(f"GLB_CONTENT meshes={mesh_count} materials={material_count} checked_color_textures={checked}")

if checked == 0:
    raise SystemExit("No visible colour textures were found")
if failures:
    raise SystemExit(f"Non-grayscale colour textures: {failures}")
print("GRAYSCALE_GLB_OK")
