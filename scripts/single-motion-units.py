"""Keep one authored gait unit; preserve the complete source by content hash.

Only exact whole-body returns are eligible. Gesture-bearing walks with no such
return are left intact: a gait cycle is not a substitute for their hand action.
Run without --apply to inspect candidates. No generation or time scaling.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "assets/animations/npz"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    endpoints_path = ROOT / "assets/animations/clip_endpoints.json"
    endpoints = json.loads(endpoints_path.read_text(encoding="utf-8"))
    index = json.loads((ROOT / "godot/npc/motion/index.json").read_text(encoding="utf-8"))
    hips = index["soma77_index"][index["names"].index("Hips")]
    rows = []
    for entry in index["clips"]:
        name = entry["id"]
        folder = SOURCES / name
        meta = json.loads((folder / "meta.json").read_text(encoding="utf-8-sig"))
        if meta.get("single_unit"):
            previous = meta["single_unit"]
            rows.append({k: previous[k] for k in ("clip", "source_sha256", "original_frames", "take_frames", "original_units", "frames", "duration")})
            if args.apply:
                declaration = endpoints["clips"].setdefault(name, {"loop": True})
                declaration["entry"] = {"clip": name, "frame": 0}
                declaration["exit"] = {"clip": name, "frame": previous["frames"] - 1}
                with np.load(folder / "motion.npz") as current:
                    posed = current["posed_joints"].astype(float)
                    delta = posed[-1, hips] - posed[0, hips]
                    declaration["source_root_delta_m"] = delta.tolist()
                    declaration["endpoint_root_aligned_max_joint_m"] = float(np.linalg.norm(posed[-1] - delta - posed[0], axis=1).max())
            continue
        if not meta.get("loop", endpoints["clips"].get(name, {}).get("loop", False)):
            continue
        path = folder / "motion.npz"
        with np.load(path) as source:
            arrays = {k: source[k].copy() for k in source.files}
        posed = arrays["posed_joints"].astype(float)
        root = posed[:, hips:hips + 1]
        relative = posed - root
        count = len(posed) - 1
        # Stationary holds are already one hold; tiny breathing fluctuations
        # must not be misidentified as a locomotion cycle.
        if np.linalg.norm(root[-1, 0] - root[0, 0]) < 0.1:
            continue
        period = None
        for k in range(max(2, round(meta["fps"] * 0.4)), count // 2 + 1):
            if count % k:
                continue
            seams = [np.linalg.norm(relative[t] - relative[0], axis=1).max()
                     for t in range(k, count + 1, k)]
            if max(seams) <= 0.001:
                period = k
                break
        if period is None:
            continue
        first = count - period
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        record = {"clip": name, "source_sha256": digest,
                  "original_frames": count + 1, "take_frames": [first, count],
                  "original_units": count // period, "frames": period + 1,
                  "duration": period / meta["fps"]}
        rows.append(record)
        if not args.apply:
            continue
        archive = ROOT / "assets/animations/generation_inputs" / (digest + ".npz")
        archive.parent.mkdir(parents=True, exist_ok=True)
        if not archive.exists():
            shutil.copyfile(path, archive)
        for key, array in arrays.items():
            if array.shape and array.shape[0] == count + 1:
                arrays[key] = array[first:count + 1]
        np.savez_compressed(path, **arrays)
        meta["single_unit"] = {**record,
            "source": str(archive.relative_to(ROOT)).replace("\\", "/"),
            "reason": "Keep the last complete authored whole-body cycle, with its original timing and root travel."}
        (folder / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        declaration = endpoints["clips"].setdefault(name, {"loop": True})
        declaration["entry"] = {"clip": name, "frame": 0}
        declaration["exit"] = {"clip": name, "frame": period}
        declaration["source_root_delta_m"] = (arrays["root_positions"][-1] - arrays["root_positions"][0]).tolist()
        declaration["endpoint_root_aligned_max_joint_m"] = float(np.linalg.norm(relative[-1] - relative[first], axis=1).max())
    if args.apply:
        endpoints_path.write_text(json.dumps(endpoints, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main()
