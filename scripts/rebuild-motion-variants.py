"""Rebuild explicitly selected single variants from their content-addressed sources.

Ranges live in each variant's meta.json. This neither guesses gesture boundaries
nor merges variants; all native arrays and source timing are preserved.
"""
import hashlib
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
for folder in sorted((ROOT / "assets/animations/npz").iterdir()):
    if not (folder / "meta.json").exists():
        continue
    meta = json.loads((folder / "meta.json").read_text(encoding="utf-8-sig"))
    if "single_variant" not in meta:
        continue
    selection = meta["single_variant"]
    source = ROOT / selection["source"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == selection["source_sha256"], source
    with np.load(source) as motion:
        arrays = {key: motion[key].copy() for key in motion.files}
    count = len(arrays["posed_joints"])
    first, last = selection["frames"]
    assert 0 <= first < last < count
    trimmed = {key: array[first:last + 1] if array.shape and array.shape[0] == count else array
               for key, array in arrays.items()}
    np.savez_compressed(folder / "motion.npz", **trimmed)
    print(folder.name, first, last)
