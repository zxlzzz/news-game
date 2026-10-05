"""Split actual batch-capture sheets into readable, synchronized review pages.

python tools/motion_sheet_pages.py <capture-dir> <output-dir> [--ids labels ...]
The output index retains original capture times and indices. No poses are generated.
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
    parser.add_argument("--samples", type=int, default=32)
    parser.add_argument("--columns", type=int, default=8)
    parser.add_argument("--start", type=float, default=float("-inf"))
    parser.add_argument("--end", type=float, default=float("inf"))
    args = parser.parse_args()
    assert args.samples > 0 and args.columns > 0
    records = json.loads((args.captures / "manifest.json").read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)
    index = []
    for rec in records:
        if args.ids and rec["label"] not in args.ids and rec["id"] not in args.ids:
            continue
        chosen = [i for i, t in enumerate(rec["times"]) if args.start <= t <= args.end]
        with Image.open(args.captures / (rec["label"] + ".png")) as original:
            cell = rec["cell"]
            source_rows = (rec["samples"] + rec["columns"] - 1) // rec["columns"]
            for page, offset in enumerate(range(0, len(chosen), args.samples)):
                items = chosen[offset:offset + args.samples]
                rows = (len(items) + args.columns - 1) // args.columns
                result = Image.new("RGB", (args.columns * cell, rows * cell * len(rec["views"])), original.getpixel((0, 0)))
                for view in range(len(rec["views"])):
                    for n, i in enumerate(items):
                        x = i % rec["columns"] * cell
                        y = (view * source_rows + i // rec["columns"]) * cell
                        result.paste(original.crop((x, y, x + cell, y + cell)),
                                     (n % args.columns * cell, (view * rows + n // args.columns) * cell))
                name = f"{rec['label']}_{page:02}.png"
                result.save(args.output / name)
                index.append({"file": name, "capture": str(args.captures.resolve() / "manifest.json"),
                              "label": rec["label"], "source_indices": items,
                              "times": [rec["times"][i] for i in items], "views": rec["views"]})
    (args.output / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    print("REVIEW_PAGES", len(index))


if __name__ == "__main__":
    main()
