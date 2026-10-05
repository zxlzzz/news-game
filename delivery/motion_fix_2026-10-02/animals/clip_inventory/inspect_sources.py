"""Read all formal animations, merge Godot metadata and authored loop contracts.

No authoring solver or runtime simulation is used. Exported GLB endpoints are
evaluated independently with all skinned vertices. Writes inspection reports only.
"""
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "godot/modeling/animals/animal_tools"))
from skin_sampler import GLB, mesh_data, sample, skin


def main():
    imported = json.loads((HERE / "godot_imported.json").read_text(encoding="utf-8"))
    configuration = json.loads((ROOT / "godot/npc/animal-models.json").read_text(encoding="utf-8"))
    report = {"source_animation_count": 0, "imported_animation_count": 0,
              "reset_imported": False, "breeds": {},
              "configuration_sha256": hashlib.sha256((ROOT / "godot/npc/animal-models.json").read_bytes()).hexdigest(),
              "limits": "A coincident endpoint is evidence for a closed pose, not evidence that a one-shot action should repeat."}
    for breed in ["husky", "shibainu", "cat"]:
        file = ROOT / "godot/models" / ("animal_" + breed + ".glb")
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        assert digest == imported["inputs_sha256"]["res://models/animal_" + breed + ".glb"], "Source changed after Godot inventory"
        glb = GLB(file)
        data = mesh_data(glb)
        library = ROOT / "godot/modeling/animals/motions" / (breed + "_motion_library")
        config = json.loads((library / "motion_specs.json").read_text(encoding="utf-8"))
        specs = {clip["name"]: clip for clip in config["clips"]}
        runtime = {clip["name"]: clip for clip in imported["breeds"][breed]}
        declared = {animation["name"] for animation in glb.d["animations"]}
        name_map = {name: name for name in declared}
        # This actual import uses name suffix processing. Record the observed
        # rename explicitly; unknown name changes must fail this inspection.
        name_map["NG_Sniff_Ground_Loop"] = "NG_Sniff_Ground"
        assert set(name_map.values()) == set(runtime), (breed, "Unaccounted imported names")
        species = configuration["breeds"][breed]["species"]
        roles = {}
        for action in configuration["species"][species]:
            definition = configuration["actions"][action]
            for role in ["in", "out"]:
                for clip in definition.get(role, []):
                    roles.setdefault(clip, []).append({"action": action, "role": role})
            if "hold" in definition:
                roles.setdefault(definition["hold"], []).append({"action": action, "role": "hold"})
        records = []
        for animation in glb.d["animations"]:
            name = animation["name"]
            keys = [glb.accessor(sampler["input"]).ravel() for sampler in animation["samplers"]]
            start = min(float(times[0]) for times in keys)
            end = max(float(times[-1]) for times in keys)
            world = sample(glb, animation, np.array([start, end]))
            vertices = skin(data, world)
            gap = float(np.linalg.norm(vertices[1] - vertices[0], axis=1).max())
            joints = glb.d["skins"][0]["joints"]
            joint_gap = float(np.linalg.norm(world[1, joints, :3, 3] - world[0, joints, :3, 3], axis=1).max())
            relative = world[1, joints, :3, :3] @ world[0, joints, :3, :3].transpose(0, 2, 1)
            rotation_gap = float(np.degrees(np.linalg.norm(Rotation.from_matrix(relative).as_rotvec(), axis=1)).max())
            pose_continuous = joint_gap < 1e-6 and rotation_gap < 1e-4
            extras = animation.get("extras", {})
            is_ng = name in specs
            source_loop = extras.get("loop")
            spec = specs.get(name, {})
            if is_ng:
                assert source_loop == spec["loop"], (breed, name, "Loop declarations disagree")
                assert abs((end - start) - spec["seconds"]) < 1e-5, (breed, name, "Duration disagrees")
                if source_loop:
                    assert gap < 1e-6, (breed, name, "Authored loop seam")
            actual = runtime[name_map[name]]
            assert abs(actual["duration_seconds"] - (end - start)) < 1e-5, (breed, name, "Import duration disagrees")
            records.append({**actual, "source_name": name, "godot_name": actual["name"],
                            "source_extras": extras, "source": "NG_authored" if is_ng else "preserved_original",
                            "source_start_seconds": start, "source_end_seconds": end,
                            "source_loop_declared": source_loop, "kind": spec.get("kind"),
                            "base_state": extras.get("base_state"), "end_state": extras.get("end_state"),
                            "source_native_fps": extras.get("fps"),
                            "maximum_source_track_keys": max(len(times) for times in keys),
                            "first_last_skin_difference_m": gap,
                            "first_last_joint_translation_difference_m": joint_gap,
                            "first_last_joint_rotation_difference_degrees": rotation_gap,
                            "first_last_bone_pose_continuous": pose_continuous,
                            "bone_pose_continuity_tolerance": {"translation_m": 1e-6, "rotation_degrees": 1e-4},
                            "closed_pose_at_1micrometer": gap < 1e-6,
                            "declared_loop_seam_verified": bool(source_loop and gap < 1e-6),
                            "runtime_action_roles": roles.get(actual["name"], [])})
        report["breeds"][breed] = {"sha256": digest, "source_animation_count": len(records),
                                    "original_animation_count": sum(not r["name"].startswith("NG_") for r in records),
                                    "NG_animation_count": sum(r["name"].startswith("NG_") for r in records),
                                    "NG_declared_loop_count": sum(r["source_loop_declared"] is True for r in records),
                                    "import_loop_modes": dict(Counter(r["loop_mode_name"] for r in records)),
                                    "clips": records}
        report["source_animation_count"] += len(records)
        report["imported_animation_count"] += len(runtime)
        report["reset_imported"] |= "RESET" in runtime
        print(breed, "clips", len(records), "NG loops", sum(r["source_loop_declared"] is True for r in records))
    assert report["source_animation_count"] == report["imported_animation_count"] == 170
    (HERE / "inventory.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    lines = ["# Animal clip inventory", "", "Read from the actual Godot import and independently from the formal GLBs. No source/runtime changes.", "",
             "170 real animations: Husky 60 (12 original + 48 NG), Shiba 60 (12 + 48), Cat 50 (2 + 48). No RESET is imported.", "",
             "Name mapping: source NG_Sniff_Ground_Loop imports as NG_Sniff_Ground in all three libraries and is marked LINEAR. Every other name is unchanged. inventory.json stores source_name and godot_name separately.", "",
             "All original clips currently have Godot LOOP_NONE and no exported loop declaration (absence is not an explicit false). Their measured whole-bone translation/rotation closure is recorded in inventory.json, along with whole-skin closure. Bone-pose continuity is tested at 1 micrometer / 0.0001 degree. Each dog has ten closed-pose originals; Death and Jump_ToIdle have substantially different endpoints. Cat Idle is closed; Walking is approximately closed, with 0.282884 mm joint position / 0.194863 degree rotation / 0.326997 mm skin differences, so this inspection does not label it a strict closed-loop pass. Pose closure alone does not establish the intended repeat behavior of an attack/jump/react action.", "",
             "NG source extras.loop agrees with motion_specs.json. All declared NG loops have matching first/last whole-skin poses within 1 micrometer. Godot currently imports only NG_Sniff_Ground_Loop as LINEAR for each breed; all other NG clips import as NONE. Thus imported loop_mode alone loses the authored hold-loop contract.", "",
             "Every in/hold/out clip is individually present. Selecting an enter or exit plays its own full duration once; it need not be wrapped in locomotion. The previous controller sequences remain a separate transition/interrupt diagnostic.", ""]
    for breed, record in report["breeds"].items():
        lines += ["## " + breed, "", "| Exact clip name | Seconds | Source loop | Godot loop | State start to end | Whole-skin endpoint gap (mm) |", "|---|---:|---|---|---|---:|"]
        for clip in record["clips"]:
            declared = "yes" if clip["source_loop_declared"] is True else "no" if clip["source_loop_declared"] is False else "unspecified"
            state = ((clip["base_state"] or "") + " to " + (clip["end_state"] or "")) if clip["base_state"] is not None else "original"
            name_label = clip["source_name"] if clip["source_name"] == clip["godot_name"] else clip["source_name"] + " -> " + clip["godot_name"]
            lines.append(f'| {name_label} | {clip["duration_seconds"]:.6g} | {declared} | {clip["loop_mode_name"]} | {state} | {1000 * clip["first_last_skin_difference_m"]:.6g} |')
        lines.append("")
    (HERE / "inventory.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("SOURCE_CLIP_INVENTORY_OK 170")


if __name__ == "__main__":
    main()
