"""Read-only pair audit from audit_dump.gd; writes evidence beside the dump.

Run from any directory: python check_pairs.py [human_dump.json]
Samples measure represented motion, not visual acceptance. Box measurements are
distances to enclosing boxes, not meshes/grip markers. Pose units are converted
to world metres using current empty-ground adult body scale.
"""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
NPC = REPO / "godot/npc"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def basis(person):
    forward = np.asarray(person["root"][1], dtype=float)
    return np.column_stack(([forward[2], 0, -forward[0]], [0, 1, 0], forward))


def world(person, point, scale):
    return np.asarray(person["root"][0]) + basis(person) @ np.asarray(point) * scale


def joint(person, name, stage, scale):
    return world(person, person[stage][name], scale)


def summary(values, times):
    arr = np.asarray(values)
    return {"min_m": float(arr.min()), "max_m": float(arr.max()),
            "mean_m": float(arr.mean()), "min_at_s": float(times[arr.argmin()]),
            "max_at_s": float(times[arr.argmax()])}


def source_meta(name):
    meta = read(REPO / "assets/animations/npz" / name / "meta.json")
    clip = read(NPC / "motion" / (name + ".json"))
    frames = np.asarray(clip["frames"])
    names = read(NPC / "motion/index.json")["names"]
    hips = names.index("Hips")
    delta = frames[-1, hips] - frames[0, hips]
    seam = np.max(np.linalg.norm(frames[-1] - frames[0] - delta, axis=1))
    chains = seam <= 0.001
    original = np.load(REPO / "assets/animations/npz" / name / "motion.npz", allow_pickle=False)
    source = original["posed_joints"][:, read(NPC / "motion/index.json")["soma77_index"]]
    lat = source[0, names.index("LeftArm")] - source[0, names.index("RightArm")]
    up = source[0, names.index("Neck1")] - source[0, hips]
    up /= np.linalg.norm(up)
    lat -= up * np.dot(lat, up)
    lat /= np.linalg.norm(lat)
    forward = np.cross(lat, up)
    hand_motion = {}
    for hand in ["LeftHand", "RightHand"]:
        q = source[:, names.index(hand)] - source[:, hips]
        fwd = q @ forward
        hand_motion[hand] = {"forward_min_max_m": [float(fwd.min()), float(fwd.max())],
                             "height_above_hips_min_max_m": [float(q[:, 1].min()), float(q[:, 1].max())]}
        steps = np.linalg.norm(np.diff(q, axis=0), axis=1)
        hand_motion[hand]["largest_adjacent_source_steps"] = [
            {"frames": [int(i), int(i+1)], "times_s": [float(i/clip["fps"]), float((i+1)/clip["fps"])],
             "distance_m": float(steps[i])}
            for i in np.argsort(steps)[-3:][::-1]]
    return {"source_text": meta.get("text"), "frames": len(frames),
            "clip_duration_s": (len(frames) - int(chains)) / clip["fps"],
            "chains": bool(chains), "source_root_delta_m": delta.tolist(),
            "source_hand_motion": hand_motion,
            "export_max_difference_m": float(np.linalg.norm(frames-source, axis=2).max())}


def box_distance(person, thing, world_point, scale):
    """A lower bound: surrounding axis-aligned box of the dumped oriented box."""
    point = basis(person).T @ (np.asarray(world_point)-person["root"][0]) / scale
    bounds = np.asarray(thing["box"])
    clipped = np.clip(point, bounds.min(axis=0), bounds.max(axis=0))
    return float(np.linalg.norm(point-clipped)*scale)


def main():
    dump = read(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "human_dump.json")
    setup = read(NPC / "clip-setup.json")["clips"]
    interactions = read(NPC / "interactions.json")["clips"]
    crowd = read(NPC / "crowd-params.json")
    scale = read(NPC / "body-types.json")[crowd["body"]]["scale"]
    result = {"method": {"figure_scale": scale, "samples": "stage-cycle uniform; no artificial wrap step",
                         "scope": "all configured partners plus all interaction override displacement"},
              "pairs": {}, "interactions": {}, "held_item_box_gaps": {}, "prop_transfer_samples": {},
              "source_evidence": {}}
    for name, config in setup.items():
        if "partner" not in config:
            continue
        other_name = config["partner"]["clip"]
        rec = dump[name]
        frames = rec["frames"]
        times = np.array([f["t"] for f in frames])
        rows = []
        for frame in frames:
            people = {p["clip"]: p for p in frame["people"]}
            a, b = people[name], people[other_name]
            af = joint(a, "handRight", "final", scale)
            bf = joint(b, "handRight", "final", scale)
            ap = joint(a, "handRight", "pre", scale)
            bp = joint(b, "handRight", "pre", scale)
            distances = [np.linalg.norm(joint(a, x, "final", scale) - joint(b, y, "final", scale))
                         for x in ["handLeft", "handRight"] for y in ["handLeft", "handRight"]]
            forearm = np.asarray(b["final"]["segs"][3])
            support = world(b, forearm[0] + .58 * (forearm[1] - forearm[0]), scale)
            rows.append({"t": frame["t"], "phase": [a["phase"], b["phase"]],
                         "roots": [a["root"][0], b["root"][0]],
                         "root_gap_m": float(np.linalg.norm(np.asarray(a["root"][0]) - b["root"][0])),
                         "right_hand_gap_m": float(np.linalg.norm(af-bf)),
                         "nearest_hand_gap_m": float(min(distances)),
                         "pre_right_hand_gap_m": float(np.linalg.norm(ap-bp)),
                         "right_hand_override_m": [float(np.linalg.norm(af-ap)), float(np.linalg.norm(bf-bp))],
                         "support_gap_m": float(np.linalg.norm(af-support))})
        if name in ["distribute_flyer", "give_item", "breakfast_sell", "table_tennis_play"]:
            props = []
            for frame in frames:
                if name == "table_tennis_play":
                    keep = any(abs(frame["t"]-t)<1e-6 for t in [0, 1])
                else:
                    keep = .2 <= frame["t"]/rec["cycle"] <= .72
                if not keep:
                    continue
                people = {p["clip"]: p for p in frame["people"]}
                a, b = people[name], people[other_name]
                for thing in a["things"]:
                    if thing.get("object") or not thing["visible"]:
                        continue
                    if name == "table_tennis_play" and thing["name"] != "held_table_tennis_ball":
                        continue
                    props.append({"t": frame["t"], "prop": thing["name"],
                                  "hand_box_lower_bounds_m": {p["clip"]: {h:box_distance(a,thing,joint(p,h,"final",scale),scale)
                                                                        for h in ["handLeft", "handRight"]}
                                                             for p in [a,b]}})
            result["prop_transfer_samples"][name] = props
        result["pairs"][name] = {
            "partner": config["partner"], "cycle_s": rec["cycle"], "sample_count": len(rows),
            "sources": {name: source_meta(name), other_name: source_meta(other_name)},
            "config": {name: interactions.get(name, {}), other_name: interactions.get(other_name, {})},
            "summary": {key: summary([r[key] for r in rows], times)
                        for key in ["root_gap_m", "right_hand_gap_m", "nearest_hand_gap_m", "pre_right_hand_gap_m", "support_gap_m"]},
            "timeline": rows}
    for name, config in interactions.items():
        result["source_evidence"][name] = source_meta(name)
        rec = dump[name]
        frames = rec["frames"]
        times = [f["t"] for f in frames]
        persons = [next(p for p in f["people"] if p["clip"] == name) for f in frames]
        changed = {}
        for hand in ["handLeft", "handRight"]:
            shifts = [np.linalg.norm(joint(p, hand, "final", scale)-joint(p, hand, "pre", scale)) for p in persons]
            path = [joint(p, hand, "final", scale) for p in persons]
            steps = np.linalg.norm(np.diff(path, axis=0), axis=1)
            index = int(np.argmax(steps))
            pre_path = [joint(p, hand, "pre", scale) for p in persons]
            changed[hand] = {**summary(shifts, times), "max_adjacent_step_m": float(steps.max()),
                             "step_interval_s": [times[index], times[index+1]],
                             "pre_step_at_same_interval_m": float(np.linalg.norm(pre_path[index+1]-pre_path[index])),
                             "whole_cycle_contact": hand in config.get("hands", {}) and "window" not in config["hands"][hand]}
        result["interactions"][name] = {"base": config.get("base"), "cycle_s": rec["cycle"],
                                        "hand_changes": changed}
    for name, config in setup.items():
        if "item" not in config:
            continue
        rec = dump[name]
        rows = []
        for frame in rec["frames"]:
            person = next(p for p in frame["people"] if p["clip"] == name)
            item = next(t for t in person["things"] if t["name"] == config["item"]["type"] + ".tscn")
            if not item["visible"]:
                continue
            hands = {"left":["handLeft"], "right":["handRight"], "both":["handLeft","handRight"], "back":["neck"]}[config["item"]["hand"]]
            rows.append({"t":frame["t"], "gap_lower_bound_m": max(box_distance(person,item,joint(person,h,"final",scale),scale) for h in hands)})
        if rows:
            result["held_item_box_gaps"][name] = {"type":config["item"]["type"],
                                                  "summary":summary([r["gap_lower_bound_m"] for r in rows],[r["t"] for r in rows]),
                                                  "timeline":rows}
    output = HERE / "pair_metrics.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    for name, rec in result["pairs"].items():
        s = rec["summary"]
        print(name, "roots", round(s["root_gap_m"]["min_m"], 3), round(s["root_gap_m"]["max_m"], 3),
              "RHgap", round(s["right_hand_gap_m"]["min_m"], 3), round(s["right_hand_gap_m"]["max_m"], 3),
              "nearest", round(s["nearest_hand_gap_m"]["min_m"], 3), round(s["nearest_hand_gap_m"]["max_m"], 3))
    print("Evidence:", output)


if __name__ == "__main__":
    main()
