"""Turn actual review_motion_batch screenshots into one-pass, synchronized-view GIFs.

python tools/motion_sheet_gif.py <capture-directory> <output-directory> [--ids clip ...]
Uses manifest times and cells, without resampling or regenerating any pose.
"""
import argparse
import json
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("captures", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--ids", nargs="+")
    args = parser.parse_args()
    manifest = json.loads((args.captures / "manifest.json").read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)
    for item in manifest:
        if args.ids and item["id"] not in args.ids:
            continue
        samples, columns, cell = (item[key] for key in ("samples", "columns", "cell"))
        rows = (samples + columns - 1) // columns
        with Image.open(args.captures / (item["label"] + ".png")) as sheet:
            frames = []
            for i in range(samples):
                frame = Image.new("RGB", (cell * len(item["views"]), cell))
                for view in range(len(item["views"])):
                    x, y = i % columns * cell, (view * rows + i // columns) * cell
                    frame.paste(sheet.crop((x, y, x + cell, y + cell)), (view * cell, 0))
                frames.append(frame)
        # All views use the same time sequence. Omit the GIF loop extension so a
        # one-shot demonstration remains at its final pose after its first pass.
        times = item["times"][:samples]
        step = item["duration"] / samples
        # GIF timing uses whole centiseconds. Quantize cumulative time so 60 Hz
        # samples alternate 10/20 ms instead of each 16.7 ms being truncated to 10.
        ticks = [round(100 * (t - times[0])) for t in times + [times[-1] + step]]
        if any(ticks[i + 1] <= ticks[i] for i in range(samples)):
            raise ValueError("GIF cannot retain samples closer than 10 ms; choose a lower capture rate")
        durations = [(ticks[i + 1] - ticks[i]) * 10 for i in range(samples)]
        path = args.output / (item["label"] + ".gif")
        frames[0].save(path, save_all=True, append_images=frames[1:], duration=durations, disposal=2)
        print(path)


if __name__ == "__main__":
    main()
