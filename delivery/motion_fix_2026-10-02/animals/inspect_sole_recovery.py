"""Read frozen Godot transforms and imported sole skin influences; report recovery errors.

This diagnostic does not run Godot or modify its runtime/source. It measures the
actual captured sole vertices, rather than a rigid paw-origin approximation.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folders", nargs="+", type=Path)
    parser.add_argument("--scenario", default="scratch_urgent")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = {"scope": "Frozen actual Godot transform dump + imported weighted sole vertices; not a current-runtime acceptance", "datasets": []}
    for folder in args.folders:
        raw_json = (folder / "runtime.json").read_bytes()
        dump = json.loads(raw_json)
        assert dump["inputs_before"] == dump["inputs_after"]
        for breed, info in dump["breeds"].items():
            for scenario in info["scenarios"]:
                if scenario["label"] != args.scenario:
                    continue
                states = scenario["states"]
                binary = Path(scenario["file"]).read_bytes()
                raw = np.frombuffer(binary, dtype="<f4").reshape(len(states), len(info["names"]), 4, 3)
                basis = raw[:, :, :3, :].transpose(0, 1, 3, 2)
                origin = raw[:, :, 3, :]
                soles = {}
                for key, vertices in info["soles"].items():
                    xyz = np.zeros((len(states), len(vertices), 3))
                    for vertex, influences in enumerate(vertices):
                        for bone, local, weight in influences:
                            xyz[:, vertex] += ((basis[:, bone] @ np.array(local)) + origin[:, bone]) * weight
                    sole = xyz.mean(axis=1)
                    sole[:, 1] = xyz[:, :, 1].min(axis=1)
                    soles[key] = sole
                measured = {}
                worst_frames = set()
                for key, sole in soles.items():
                    target = np.array([state["feet"][key]["point"] for state in states])
                    active = np.array([state["phase"] == "return" and key in state["return_contacts"] and not state["feet"][key]["swing"] for state in states])
                    error = np.linalg.norm(sole - target, axis=1)
                    frame = int(np.argmax(np.where(active, error, -1)))
                    measured[key] = {"support_frames": int(active.sum()), "max_support_error_m": float(error[frame]) if active.any() else None,
                                     "worst_frame": frame if active.any() else None}
                    if active.any():
                        worst_frames.add(frame)
                rows = []
                for center in sorted(worst_frames):
                    for frame in range(max(0, center-1), min(len(states), center+2)):
                        state = states[frame]
                        rows.append({"frame": frame, "time": state["time"], "phase": state["phase"], "return_contacts": state["return_contacts"],
                                     "body_origin_m": origin[frame, 0].tolist(),
                                     "feet": {key: {"sole_m": sole[frame].tolist(), "target_m": state["feet"][key]["point"],
                                                    "swing": state["feet"][key]["swing"],
                                                    "error_m": float(np.linalg.norm(sole[frame]-state["feet"][key]["point"]))}
                                              for key, sole in soles.items()}})
                output["datasets"].append({"folder": str(folder.resolve()), "breed": breed, "scenario": scenario["label"], "fps": dump["fps"],
                                           "manifest_sha256": hashlib.sha256(raw_json).hexdigest(), "binary_sha256": hashlib.sha256(binary).hexdigest(),
                                           "inputs_sha256": dump["inputs_before"], "feet": measured, "worst_frame_neighborhoods": rows})
                print(breed, "support_error_mm", {key: round(value["max_support_error_m"]*1000, 3) if value["max_support_error_m"] is not None else None for key, value in measured.items()})
    args.output.write_text(json.dumps(output, indent=2)+"\n", encoding="utf-8")


if __name__ == "__main__":
    main()
