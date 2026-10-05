"""Read frozen skin matrices and independently sweep a leg's fixed-axis plane.

No Godot or production edits. Changes upper/lower transforms by rotating them
around the actual fixed hip-to-wrist axis, retaining wrist/distal transforms.
The sweep evaluates every GLB skin vertex influenced by those two bones.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "godot/modeling/animals/animal_tools"))
from glb import GLB
from skin_sampler import mesh_data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--breed", required=True)
    parser.add_argument("--scenario", required=True)
    parser.add_argument("--frame", type=int, required=True)
    parser.add_argument("--remove-raise", type=float, default=0)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    manifest_bytes = (args.folder / "runtime.json").read_bytes()
    dump = json.loads(manifest_bytes)
    assert dump["inputs_before"] == dump["inputs_after"]
    info = dump["breeds"][args.breed]
    scenario = next(s for s in info["scenarios"] if s["label"] == args.scenario)
    binary = Path(scenario["file"]).read_bytes()
    raw = np.frombuffer(binary, dtype="<f4").reshape(len(scenario["states"]), len(info["names"]), 4, 3)[args.frame]
    basis = raw[:, :3, :].transpose(0, 2, 1).astype(float)
    origin = raw[:, 3, :].astype(float)
    origin[:, 1] -= args.remove_raise
    glb_path = ROOT / f"godot/models/animal_{args.breed}.glb"
    g = GLB(glb_path)
    assert hashlib.sha256(g.raw).hexdigest() == dump["inputs_before"][f"res://models/animal_{args.breed}.glb"]
    points, weights, ids, joints, inverse = mesh_data(g)
    names = [g.d["nodes"][j]["name"] for j in joints]
    bones = np.array([info["names"].index(name) for name in names])[ids]
    local = np.einsum("nkij,nj->nki", inverse[ids], points)[..., :3]
    world = np.einsum("nkij,nkj->nki", basis[bones], local) + origin[bones]
    xyz = (world * weights[..., None]).sum(axis=1)
    upper = info["names"].index("BackLeg.L")
    lower = info["names"].index("BackUpperLeg.L")
    wrist = info["names"].index("BackLowerLeg.L")
    affected = ((bones == upper) | (bones == lower)) & (weights > 0)
    vertices = np.flatnonzero(affected.any(axis=1))
    r = origin[upper]
    axis = origin[wrist] - r
    axis /= np.linalg.norm(axis)
    arm = ((world - r) * weights[..., None] * affected[..., None]).sum(axis=1)
    parallel = np.outer(arm @ axis, axis)
    base = xyz - arm + parallel
    cosine = arm - parallel
    sine = np.cross(axis, arm)
    angles = np.linspace(-np.pi, np.pi, 7201)
    heights = (base[vertices, 1, None] + cosine[vertices, 1, None] * np.cos(angles)
               + sine[vertices, 1, None] * np.sin(angles))
    floors = heights.min(axis=0)
    best = int(floors.argmax())
    bad = vertices[np.argmin(heights[:, best])]
    current_bad = vertices[np.argmin(xyz[vertices, 1])]
    ceiling = base[:, 1] + np.hypot(cosine[:, 1], sine[:, 1])
    impossible = vertices[ceiling[vertices] < -1e-6]

    def vertex(index):
        return {"index": int(index), "point_m": xyz[index].tolist(),
                "influences": [{"bone": info["names"][int(bone)], "weight": float(weight), "bind_local_m": loc.tolist()}
                               for bone, weight, loc in zip(bones[index], weights[index], local[index]) if weight > 0]}

    # Validate reconstruction against imported weighted sole point sets.
    sole_check = {}
    for key, imported in info["soles"].items():
        positions = []
        for influences in imported:
            positions.append(sum((basis[bone] @ np.array(loc) + origin[bone]) * weight for bone, loc, weight in influences))
        positions = np.array(positions)
        sole_check[key] = {"min_y_m": float(positions[:, 1].min()), "mean_xz_m": positions.mean(axis=0)[[0, 2]].tolist()}
    output = {"scope": "Fixed captured hip and wrist, upper/lower plane rotated only. Distal orientation remains captured; not a proof that the full 4-bone leg has no feasible pose.",
              "folder": str(args.folder.resolve()), "breed": args.breed, "scenario": args.scenario,
              "frame": args.frame, "time": scenario["states"][args.frame]["time"],
              "removed_uniform_raise_m": args.remove_raise,
              "glb_sha256": hashlib.sha256(g.raw).hexdigest(), "dump_sha256": hashlib.sha256(binary).hexdigest(),
              "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
              "hip_m": r.tolist(), "wrist_m": origin[wrist].tolist(),
              "sole_reconstruction": sole_check, "all_skin_current_floor_m": float(xyz[:, 1].min()),
              "all_skin_lowest": vertex(int(xyz[:, 1].argmin())),
              "leg_vertex_count": len(vertices), "sweep_step_degrees": 0.05,
              "current_leg_floor_m": float(xyz[vertices, 1].min()), "current_lowest": vertex(current_bad),
              "optimal_plane_degrees": float(np.degrees(angles[best])), "optimal_leg_floor_m": float(floors[best]),
              "optimal_limiting_vertex": vertex(bad),
              "angles_at_or_above_floor_count": int((floors >= -1e-6).sum()),
              "individually_impossible_vertices": [{**vertex(i), "highest_possible_y_m": float(ceiling[i])} for i in impossible]}
    args.output.write_text(json.dumps(output, indent=2)+"\n")
    print({key: output[key] for key in ["breed", "frame", "current_leg_floor_m", "optimal_plane_degrees", "optimal_leg_floor_m", "angles_at_or_above_floor_count"]})
    print("individual_impossible", len(impossible), "sole", sole_check)


if __name__ == "__main__":
    main()
