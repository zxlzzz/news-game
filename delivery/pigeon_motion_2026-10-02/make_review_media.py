"""Repackage actual Godot pixels; never generate or adjust a pose.

Run with the workspace Python. GIFs append separately captured exact endpoints,
retain the manifest clock to 10 ms cumulative quantization, and play once.
Ground detail grids use one fixed crop for every time/view, without recentering.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


BASE = Path(__file__).resolve().parent


def read_capture(name):
    folder = BASE / name
    rows = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    return {r["id"].split(":", 1)[1]: (folder, r) for r in rows}


def cells(folder, rec, size=None):
    result = []
    with Image.open(folder / (rec["label"] + ".png")) as sheet:
        cell = rec["cell"]
        rows = (rec["samples"] + rec["columns"] - 1) // rec["columns"]
        for i in range(rec["samples"]):
            views = []
            for v in range(len(rec["views"])):
                x = i % rec["columns"] * cell
                y = (v * rows + i // rec["columns"]) * cell
                part = sheet.crop((x, y, x + cell, y + cell)).convert("RGB")
                if size is not None and size != cell:
                    part = part.resize((size, size), Image.Resampling.LANCZOS)
                views.append(part)
            result.append(views)
    return result


def provenance(folder, rec):
    png = folder / (rec["label"] + ".png")
    return {"manifest": str(folder / "manifest.json"), "label": rec["label"],
            "png_sha256": hashlib.sha256(png.read_bytes()).hexdigest(),
            "times": rec["times"], "inputs_sha256": rec["inputs_sha256"]}


def main():
    actual, focus, ends, flap = [read_capture(n) for n in
                                  ("actual", "focus_dense", "exact_endpoints", "flap_60hz")]
    gif_dir = BASE / "gifs"
    detail_dir = BASE / "details"
    gif_dir.mkdir(exist_ok=True)
    detail_dir.mkdir(exist_ok=True)
    timing = []
    ids = ["unfold_direct", "unfold_lift", "fold_direct", "fold_after_lift",
           "launch_power", "launch_open", "flap_to_glide_stroke", "flap_to_glide_soft",
           "land_flare", "land_absorb", "hop", "flap", "walk_in_place", "look_around"]
    for id_ in ids:
        folder, rec = flap[id_] if id_ == "flap" else focus.get(id_, actual[id_])
        size = rec["cell"]
        parts = cells(folder, rec)
        times = list(rec["times"])
        sources = [provenance(folder, rec)]
        end_time = rec["start"] + rec["duration"]
        exact_added = id_ in ends
        if exact_added:
            end_folder, end_rec = ends[id_]
            assert end_rec["views"] == rec["views"]
            for key, sha in rec["inputs_sha256"].items():
                if key.startswith("res://npc/pigeon") or key.endswith("/procedural_pigeon.gd"):
                    assert end_rec["inputs_sha256"][key] == sha, key
            assert abs(end_rec["times"][0] - end_time) < 1e-8
            assert end_rec["times"][0] > times[-1]
            parts += cells(end_folder, end_rec, size)
            times += end_rec["times"]
            sources.append(provenance(end_folder, end_rec))
            end_time = end_rec["start"] + end_rec["duration"]
        ticks = [round(100 * (t - times[0])) for t in times + [end_time]]
        assert all(b > a for a, b in zip(ticks, ticks[1:])), id_
        milliseconds = [(b - a) * 10 for a, b in zip(ticks, ticks[1:])]
        frames = []
        for views in parts:
            frame = Image.new("RGB", (size * len(views), size))
            for v, part in enumerate(views):
                frame.paste(part, (v * size, 0))
            frames.append(frame)
        output = gif_dir / f"pigeon_{id_}.gif"
        frames[0].save(output, save_all=True, append_images=frames[1:],
                       duration=milliseconds, disposal=2)
        with Image.open(output) as encoded:
            total = 0
            assert "loop" not in encoded.info
            for i in range(encoded.n_frames):
                encoded.seek(i)
                total += encoded.info["duration"]
        expected_ms = (end_time - times[0]) * 1000
        assert abs(total - expected_ms) <= 5.00001
        timing.append({"id": id_, "file": str(output), "exact_end_hold_appended": exact_added,
                       "views": rec["views"], "sources": sources, "times": times,
                       "frame_durations_ms": milliseconds, "encoded_duration_ms": total,
                       "expected_duration_ms": expected_ms, "one_pass": True})
    (gif_dir / "timing.json").write_text(json.dumps(timing, indent=2) + "\n", encoding="utf-8")

    detail_index = []
    crop = (85, 95, 240, 210)
    zoom = 2
    for id_ in ("walk_in_place", "look_around"):
        folder, rec = actual[id_]
        assert rec["cell"] == 320
        images = cells(folder, rec)
        width, height = (crop[2] - crop[0]) * zoom, (crop[3] - crop[1]) * zoom
        for v, angle in enumerate(rec["views"]):
            out = Image.new("RGB", (4 * width, 6 * (height + 24)), (206, 206, 206))
            draw = ImageDraw.Draw(out)
            for i, group in enumerate(images):
                x, y = i % 4 * width, i // 4 * (height + 24)
                part = group[v].crop(crop).resize((width, height), Image.Resampling.NEAREST)
                out.paste(part, (x, y + 24))
                draw.text((x + 4, y + 5), f"{id_}  {rec['times'][i]:.3f}s  {angle:g}deg", fill=(0, 0, 0))
            name = f"pigeon_{id_}_view{v}.png"
            out.save(detail_dir / name)
            detail_index.append({"file": name, "source": provenance(folder, rec),
                                 "view": angle, "crop": crop, "zoom": zoom,
                                 "method": "fixed crop; nearest pixel magnification; no recentering"})
    (detail_dir / "index.json").write_text(json.dumps(detail_index, indent=2) + "\n", encoding="utf-8")
    print(f"ACTUAL_REVIEW_MEDIA_OK {len(timing)} one-pass GIFs; {len(detail_index)} fixed detail grids")


if __name__ == "__main__":
    main()
