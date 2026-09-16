"""Replace Quaternius fake-interior materials with flat black in-place.

The tool intentionally edits only explicitly named MI_FakeInterior materials.
It leaves meshes, other materials, textures, images, and the binary GLB chunk
byte-for-byte unchanged. Run it only after inspecting a model selected for use.

Usage:
    python blacken_fake_interiors.py model.glb [model.glb ...]
"""

from __future__ import annotations

import json
from pathlib import Path
import struct
import sys
import tempfile


GLB_MAGIC = b"glTF"
GLB_VERSION = 2
JSON_CHUNK = 0x4E4F534A


def read_glb(path: Path) -> tuple[list[tuple[int, bytes]], dict]:
    payload = path.read_bytes()
    if len(payload) < 20:
        raise ValueError(f"{path}: file is too short to be a GLB")

    magic, version, declared_length = struct.unpack_from("<4sII", payload, 0)
    if magic != GLB_MAGIC or version != GLB_VERSION:
        raise ValueError(f"{path}: expected a GLB v2 file")
    if declared_length != len(payload):
        raise ValueError(
            f"{path}: header length {declared_length} does not match file length {len(payload)}"
        )

    chunks: list[tuple[int, bytes]] = []
    cursor = 12
    while cursor < len(payload):
        if cursor + 8 > len(payload):
            raise ValueError(f"{path}: truncated chunk header")
        chunk_length, chunk_type = struct.unpack_from("<II", payload, cursor)
        cursor += 8
        end = cursor + chunk_length
        if end > len(payload):
            raise ValueError(f"{path}: truncated chunk payload")
        chunks.append((chunk_type, payload[cursor:end]))
        cursor = end

    json_chunks = [data for chunk_type, data in chunks if chunk_type == JSON_CHUNK]
    if len(json_chunks) != 1:
        raise ValueError(f"{path}: expected exactly one JSON chunk")

    document = json.loads(json_chunks[0].rstrip(b" \x00").decode("utf-8"))
    return chunks, document


def referenced_image_name(document: dict, texture_index: int | None) -> str:
    if texture_index is None:
        return "none"
    textures = document.get("textures", [])
    images = document.get("images", [])
    if not 0 <= texture_index < len(textures):
        return f"invalid-texture-{texture_index}"
    image_index = textures[texture_index].get("source")
    if not isinstance(image_index, int) or not 0 <= image_index < len(images):
        return f"texture-{texture_index}"
    return images[image_index].get("name", f"image-{image_index}")


def blacken_materials(path: Path, document: dict) -> list[str]:
    changed: list[str] = []
    for material in document.get("materials", []):
        name = material.get("name", "")
        if not name.startswith("MI_FakeInterior"):
            continue

        pbr = material.setdefault("pbrMetallicRoughness", {})
        texture_info = pbr.pop("baseColorTexture", None)
        texture_index = texture_info.get("index") if isinstance(texture_info, dict) else None
        image_name = referenced_image_name(document, texture_index)

        pbr["baseColorFactor"] = [0.0, 0.0, 0.0, 1.0]
        pbr["metallicFactor"] = 0.0
        pbr["roughnessFactor"] = 1.0
        material.pop("emissiveTexture", None)
        material["emissiveFactor"] = [0.0, 0.0, 0.0]

        extensions = material.get("extensions")
        if isinstance(extensions, dict):
            extensions.pop("KHR_materials_emissive_strength", None)
            if not extensions:
                material.pop("extensions")

        changed.append(f"{name} <- {image_name}")

    if not changed:
        raise ValueError(f"{path}: no MI_FakeInterior materials found; inspect this model manually")
    return changed


def write_glb_in_place(path: Path, chunks: list[tuple[int, bytes]], document: dict) -> None:
    json_payload = json.dumps(
        document,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    json_payload += b" " * (-len(json_payload) % 4)

    rebuilt_chunks: list[tuple[int, bytes]] = []
    for chunk_type, data in chunks:
        rebuilt_chunks.append((chunk_type, json_payload if chunk_type == JSON_CHUNK else data))

    total_length = 12 + sum(8 + len(data) for _chunk_type, data in rebuilt_chunks)
    output = bytearray(struct.pack("<4sII", GLB_MAGIC, GLB_VERSION, total_length))
    for chunk_type, data in rebuilt_chunks:
        output.extend(struct.pack("<II", len(data), chunk_type))
        output.extend(data)

    with tempfile.NamedTemporaryFile(
        mode="wb",
        prefix=f".{path.stem}-",
        suffix=".tmp",
        dir=path.parent,
        delete=False,
    ) as temporary:
        temporary.write(output)
        temporary_path = Path(temporary.name)

    try:
        temporary_path.replace(path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise


def process(path: Path) -> None:
    chunks, document = read_glb(path)
    non_json_chunks = [data for chunk_type, data in chunks if chunk_type != JSON_CHUNK]
    changed = blacken_materials(path, document)
    write_glb_in_place(path, chunks, document)

    verified_chunks, verified_document = read_glb(path)
    verified_non_json = [data for chunk_type, data in verified_chunks if chunk_type != JSON_CHUNK]
    if verified_non_json != non_json_chunks:
        raise RuntimeError(f"{path}: a non-JSON GLB chunk changed unexpectedly")

    for material in verified_document.get("materials", []):
        if not material.get("name", "").startswith("MI_FakeInterior"):
            continue
        pbr = material.get("pbrMetallicRoughness", {})
        if "baseColorTexture" in pbr or pbr.get("baseColorFactor") != [0.0, 0.0, 0.0, 1.0]:
            raise RuntimeError(f"{path}: failed to verify {material.get('name')}")

    print(f"BLACKENED {path}")
    for entry in changed:
        print(f"  {entry}")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Pass one or more GLB paths")
    for argument in sys.argv[1:]:
        path = Path(argument).resolve()
        if path.suffix.lower() != ".glb" or not path.is_file():
            raise SystemExit(f"Not a GLB file: {path}")
        process(path)


if __name__ == "__main__":
    main()
