"""Add manually read endpoint pages to the dog direct-clip visual ledger.

Only name pages after actually reading every four-cell clip tile on them.
The original 24-phase records remain intact; endpoint/hold evidence is separate.
"""
import argparse
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pages", nargs="+", required=True)
    parser.add_argument("--note", required=True)
    args = parser.parse_args()
    captures = HERE / "individual_endpoints"
    page_folder = captures / "dog_review_pages"
    pages = json.loads((page_folder / "index.json").read_text())
    selected = {int(value) for value in args.pages}
    assert all(0 <= value < len(pages) for value in selected)
    labels = {label for value in selected for label in pages[value]["labels"]}
    raw = (captures / "manifest.json").read_bytes()
    records = {record["label"]: record for record in json.loads(raw)}
    report_path = HERE / "individual_dog_visual_review.json"
    report = json.loads(report_path.read_text())
    for record in report["records"]:
        label = record["label"]
        if label not in labels:
            continue
        endpoint = records[label]
        assert abs(endpoint["start"] - endpoint["cycle"]) < 1e-6
        file = captures / (label + ".png")
        record["endpoint_review"] = {
            "file": str(file.resolve()), "sheet_sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
            "manifest_sha256": hashlib.sha256(raw).hexdigest(),
            "source_duration_seconds": endpoint["cycle"], "times_viewed": endpoint["times"],
            "views_degrees": endpoint["views"], "inputs_sha256": endpoint["inputs_sha256"],
            "screening_status": "observed_exact_end_and_post_end_hold",
            "observations": args.note,
            "coverage_limit": "Exact duration and duration+0.1 seconds are rendered; no continuous long hold or Animal recovery is exercised."}
        record["exact_end_frame_viewed"] = True
        labels.remove(label)
    assert not labels, labels
    report["endpoint_clip_count"] = sum("endpoint_review" in record for record in report["records"])
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("ENDPOINT_RECORDS", report["endpoint_clip_count"])


if __name__ == "__main__":
    main()
