"""Record manually viewed individual capture sheets, without inferring a PASS.

Usage: python record_visual_review.py --labels husky_Attack ... --note "Observed ..."
Run only after actually reading every selected sheet.
"""
import argparse
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", nargs="+", required=True)
    parser.add_argument("--note", required=True)
    parser.add_argument("--status", default="observed_coarse_direct_clip")
    args = parser.parse_args()
    folder = HERE / "individual_actual"
    raw = (folder / "manifest.json").read_bytes()
    records = json.loads(raw)
    report_path = HERE / "individual_dog_visual_review.json"
    if report_path.exists():
        report = json.loads(report_path.read_text(encoding="utf-8"))
    else:
        report = {"reviewer": "game_history: source-author engineering visual review",
                  "scope": "Husky60 + Shiba60 direct sample/FK actual rendered clips. No Animal recovery or procedural gait wrapper is exercised.",
                  "acceptance": "Engineering observation; no user acceptance; no runtime recovery/contact PASS inferred.",
                  "manifest_sha256": hashlib.sha256(raw).hexdigest(), "records": []}
    old = {record["label"]: record for record in report["records"]}
    selected = set(args.labels)
    assert len(selected) == len(args.labels)
    for record in records:
        if record["label"] not in selected:
            continue
        file = folder / (record["label"] + ".png")
        old[record["label"]] = {"label": record["label"], "id": record["id"],
                                 "file": str(file.resolve()), "sheet_sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                                 "duration_seconds": record["duration"], "times_viewed": record["times"],
                                 "views_degrees": record["views"], "input_sha256": record["inputs_sha256"],
                                 "screening_status": args.status, "observations": args.note,
                                 "exact_end_frame_viewed": any(abs(time-record["duration"]) < 1e-6 for time in record["times"])}
        selected.remove(record["label"])
    assert not selected, selected
    report["records"] = list(old.values())
    report["viewed_clip_count"] = len(old)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("VISUAL_RECORDS", len(old))


if __name__ == "__main__":
    main()
