"""Compare a source glTF with its colour-preserving repacked GLB.

Usage after Blender's `--` separator:
    source.gltf output.glb
"""

from pathlib import Path
import sys

import bpy
from mathutils import Vector


def sampled_channel_delta(image):
    image.scale(min(64, image.size[0]), min(64, image.size[1]))
    pixels = list(image.pixels)
    maximum = 0.0
    for offset in range(0, len(pixels), 4):
        red, green, blue = pixels[offset], pixels[offset + 1], pixels[offset + 2]
        maximum = max(maximum, abs(red - green), abs(red - blue), abs(green - blue))
    return maximum


def linked_images(socket, found, visited):
    for link in socket.links:
        node = link.from_node
        if node in visited:
            continue
        visited.add(node)
        if node.type == "TEX_IMAGE" and node.image is not None:
            found.add(node.image)
        else:
            for input_socket in node.inputs:
                linked_images(input_socket, found, visited)


def inspect(model_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(model_path))

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    bounds = None
    if points:
        bounds = tuple(round(value, 4) for value in (
            min(point.x for point in points), min(point.y for point in points), min(point.z for point in points),
            max(point.x for point in points), max(point.y for point in points), max(point.z for point in points),
        ))

    colour_images = set()
    factor_chroma = 0.0
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            base = node.inputs.get("Base Color")
            if base is None:
                continue
            linked_images(base, colour_images, set())
            red, green, blue, _alpha = base.default_value
            factor_chroma = max(
                factor_chroma,
                abs(red - green), abs(red - blue), abs(green - blue),
            )

    image_chroma = max((sampled_channel_delta(image) for image in colour_images), default=0.0)
    return {
        "meshes": len(meshes),
        "materials": len(bpy.data.materials),
        "colour_images": len(colour_images),
        "image_chroma": image_chroma,
        "factor_chroma": factor_chroma,
        "bounds": bounds,
    }


args = sys.argv[sys.argv.index("--") + 1 :]
if len(args) != 2:
    raise SystemExit("Expected source glTF and output GLB after --")

source_path, output_path = (Path(arg).resolve() for arg in args)
source = inspect(source_path)
output = inspect(output_path)
print(f"SOURCE_CONTENT {source}")
print(f"OUTPUT_CONTENT {output}")

for field in ("meshes", "materials", "colour_images", "bounds"):
    if source[field] != output[field]:
        raise SystemExit(f"Content mismatch for {field}: {source[field]} != {output[field]}")

source_chroma = max(source["image_chroma"], source["factor_chroma"])
output_chroma = max(output["image_chroma"], output["factor_chroma"])
if source_chroma <= 0.002:
    raise SystemExit("Representative source has no measurable base-colour chroma")
if abs(source_chroma - output_chroma) > 0.002:
    raise SystemExit(f"Base-colour chroma changed: {source_chroma} != {output_chroma}")

print("COLOUR_GLB_OK")
