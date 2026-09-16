"""Create a glTF staging copy whose visible colour inputs are grayscale.

Base-colour textures and RGB base-colour factors are converted. Geometry,
normal maps, occlusion/roughness/metallic maps, alpha, and all other glTF data
are preserved. The staged glTF can then be packed into a self-contained GLB.

Usage:
    python prepare_grayscale_gltf.py source.gltf staged_output.gltf
"""

from __future__ import annotations

import json
from pathlib import Path
import shutil
import sys

from PIL import Image


REC709 = (0.2126, 0.7152, 0.0722, 0.0)


def grayscale_image(source: Path, output: Path) -> None:
    with Image.open(source) as image:
        rgb = image.convert("RGB")
        luminance = rgb.convert("L", REC709)
        alpha = image.convert("RGBA").getchannel("A")
        has_alpha = image.mode in {"RGBA", "LA"} or "transparency" in image.info
        if has_alpha:
            result = Image.merge("RGBA", (luminance, luminance, luminance, alpha))
        else:
            result = Image.merge("RGB", (luminance, luminance, luminance))
        result.save(output, format="PNG", optimize=True)


def factor_to_gray(factor: list[float]) -> list[float]:
    red, green, blue = factor[:3]
    gray = red * REC709[0] + green * REC709[1] + blue * REC709[2]
    return [gray, gray, gray, *factor[3:]]


def prepare(source_path: Path, output_path: Path) -> None:
    source_path = source_path.resolve()
    output_path = output_path.resolve()
    source_dir = source_path.parent
    output_dir = output_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)

    document = json.loads(source_path.read_text(encoding="utf-8"))
    textures = document.get("textures", [])
    images = document.get("images", [])

    grayscale_sources: set[int] = set()
    for material in document.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        texture_ref = pbr.get("baseColorTexture")
        if texture_ref is not None:
            texture_index = texture_ref["index"]
            grayscale_sources.add(textures[texture_index]["source"])
        if "baseColorFactor" in pbr:
            pbr["baseColorFactor"] = factor_to_gray(pbr["baseColorFactor"])

    copied_uris: set[str] = set()
    for buffer in document.get("buffers", []):
        uri = buffer.get("uri")
        if uri and not uri.startswith("data:"):
            shutil.copy2(source_dir / uri, output_dir / uri)
            copied_uris.add(uri)

    converted_names: list[str] = []
    for image_index, image_entry in enumerate(images):
        uri = image_entry.get("uri")
        if not uri or uri.startswith("data:"):
            continue
        source_image = source_dir / uri
        output_image = output_dir / uri
        output_image.parent.mkdir(parents=True, exist_ok=True)
        if image_index in grayscale_sources:
            grayscale_image(source_image, output_image)
            converted_names.append(uri)
        elif uri not in copied_uris:
            shutil.copy2(source_image, output_image)
        copied_uris.add(uri)

    document.setdefault("asset", {}).setdefault("extras", {})[
        "newsGameConversion"
    ] = "Rec.709 grayscale base colour; geometry and PBR detail maps preserved"
    output_path.write_text(
        json.dumps(document, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"WROTE_STAGED_GLTF {output_path}")
    for name in sorted(converted_names):
        print(f"GRAYSCALE_BASE_COLOR {name}")


if len(sys.argv) != 3:
    raise SystemExit("Expected: source.gltf staged_output.gltf")

prepare(Path(sys.argv[1]), Path(sys.argv[2]))
