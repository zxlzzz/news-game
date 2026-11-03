"""Record only the selected animal/bird motion, from its first frame.

python godot/tools/record_animals.py <out dir> [species:clip ...]
With no selection, records every actual animal clip for each breed and every bird
motion. Loop declarations and durations come from their source; once clips include
an end-pose hold. Capture settings live in empty_ground/movers.json.
"""
import json
import math
import os
import subprocess
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
GODOT = os.environ.get("GODOT", "D:/Godot/Godot_v4.7.2-stable_win64_console.exe")


def run(script, output, marker, log, headless=False):
    command = [GODOT, "--path", str(PROJECT), "--log-file", str(log)]
    if headless:
        command.append("--headless")
    command += ["-s", "res://tools/" + script, "--", str(output)]
    kwargs = {}
    if os.name == "nt":
        info = subprocess.STARTUPINFO()
        info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        info.wShowWindow = subprocess.SW_HIDE
        kwargs["startupinfo"] = info
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8",
                            errors="replace", stdin=subprocess.DEVNULL, timeout=1800, **kwargs)
    (log.with_suffix(".stdout.log")).write_text(result.stdout, encoding="utf-8")
    (log.with_suffix(".stderr.log")).write_text(result.stderr, encoding="utf-8")
    if result.returncode or marker not in result.stdout or "SCRIPT ERROR:" in result.stderr:
        raise RuntimeError(result.stdout[-2000:] + result.stderr[-2000:])


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    catalog = out / "catalog.json"
    run("export_animal_motion_catalog.gd", catalog, "ANIMAL_MOTION_CATALOG_OK", out / "catalog.log", True)
    entries = json.loads(catalog.read_text(encoding="utf-8"))
    chosen = sys.argv[2:]
    unknown = set(chosen) - {e["id"] for e in entries}
    if unknown:
        raise ValueError("Unknown motion name: " + ", ".join(sorted(unknown)))
    settings = json.loads((PROJECT / "scenes/empty_ground/movers.json").read_text(encoding="utf-8"))["capture"]
    requested = []
    for e in entries:
        if chosen and e["id"] not in chosen:
            continue
        duration = e["duration"] + (0 if e["loop"] else settings["end_hold"])
        requested.append({**e, "duration": duration, "samples": max(1, math.ceil(duration * settings["fps"]))})
    captures = out / "captures"
    request = {"output": str(captures), "entries": requested,
               **{key: settings[key] for key in ["columns", "cell", "views", "pitch"]},
               "provenance": ["res://tools/review_motion_batch.gd", "res://tools/animal_clip_preview.gd",
                   "res://scenes/empty_ground/stage.gd", "res://npc/pigeon_motion.gd", "res://npc/pigeon-motion.json",
                   "res://npc/animal_model.gd", "res://npc/procedural_pigeon.gd",
                   "res://models/animal_husky.glb", "res://models/animal_shibainu.glb", "res://models/animal_cat.glb"]}
    request_file = out / "capture_request.json"
    request_file.write_text(json.dumps(request, indent=2) + "\n", encoding="utf-8")
    run("review_motion_batch.gd", request_file, "MOTION_CAPTURED", out / "capture.log")
    subprocess.run([sys.executable, str(PROJECT / "tools/motion_sheet_gif.py"), str(captures), str(out / "gifs")], check=True)
    print("Recorded", len(requested), "individual motions:", out)


if __name__ == "__main__":
    main()
