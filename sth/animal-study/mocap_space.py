"""Drive the MoCapAnything V2 HF Space over its raw gradio queue API.

usage:
  python mocap_space.py probe <dset> <i0> <i1>          # print species names at gallery indices
  python mocap_space.py run <dset> <species> <video> <outdir>
"""
import json, os, sys, uuid, time
import httpx

ROOT = "https://kehong-mocapanythingv2.hf.space"
API = ROOT + "/gradio_api"
FN_ON_SPECIES, FN_RUN = 8, 9
TRIG_SPECIES_GALLERY, TRIG_RUN_BTN = 43, 16

_tok_file = os.environ.get("HF_TOKEN_FILE", r"D:\mocap-trial\hf_token.txt.txt")
_tok = os.environ.get("HF_TOKEN") or (open(_tok_file).read().strip() if os.path.exists(_tok_file) else None)
print("HF token:", "yes" if _tok else "NO (anonymous quota)")
cli = httpx.Client(timeout=httpx.Timeout(60, read=900), follow_redirects=True,
                   headers={"Authorization": f"Bearer {_tok}"} if _tok else {})


def call(fn, trigger, data, session, event_data=None):
    r = cli.post(API + "/queue/join", json={"data": data, "event_data": event_data,
                                            "fn_index": fn, "trigger_id": trigger,
                                            "session_hash": session})
    r.raise_for_status()
    with cli.stream("GET", API + "/queue/data", params={"session_hash": session}) as s:
        for line in s.iter_lines():
            if not line.startswith("data:"):
                continue
            m = json.loads(line[5:])
            kind = m.get("msg")
            if kind == "progress":
                pd = m.get("progress_data") or []
                if pd:
                    print("  progress:", pd[0].get("desc"), pd[0].get("index"), flush=True)
            elif kind == "estimation":
                print("  queue rank", m.get("rank"), "eta", m.get("rank_eta"), flush=True)
            elif kind == "process_completed":
                out = m.get("output") or {}
                if not m.get("success", True) or "error" in out:
                    raise RuntimeError(f"space error: {json.dumps(m, ensure_ascii=False)[:2000]}")
                return out.get("data")
            elif kind in ("close_stream",):
                break
    raise RuntimeError("stream ended without result")


def pick_species(dset, idx, session):
    return call(FN_ON_SPECIES, TRIG_SPECIES_GALLERY, [dset], session,
                event_data={"index": idx, "value": None, "selected": True})


def upload(path):
    with open(path, "rb") as f:
        r = cli.post(API + "/upload", files={"files": (os.path.basename(path), f, "video/mp4")})
    r.raise_for_status()
    return r.json()[0]


def fetch(url_or_path, dst):
    url = url_or_path if url_or_path.startswith("http") else f"{API}/file={url_or_path}"
    r = cli.get(url); r.raise_for_status()
    open(dst, "wb").write(r.content)
    return dst


def main():
    mode = sys.argv[1]
    if mode == "probe":
        dset, i0, i1 = sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
        s = uuid.uuid4().hex[:11]
        for i in range(i0, i1):
            print(i, pick_species(dset, i, s)[1], flush=True)
        return
    dset, species, video, outdir = sys.argv[2:6]
    os.makedirs(outdir, exist_ok=True)
    s = uuid.uuid4().hex[:11]
    # find the gallery index of the species
    idx = None
    for i in range(80):
        md = pick_species(dset, i, s)[1]
        if f"**{species[:16]}**" in md:
            idx = i; break
        if "No target" in md:
            break
    if idx is None:
        raise SystemExit(f"species {species} not found in {dset}")
    print("species", species, "at index", idx)
    up = upload(video)
    vid = {"path": up, "orig_name": os.path.basename(video), "mime_type": "video/mp4",
           "meta": {"_type": "gradio.FileData"}}
    t0 = time.time()
    out = call(FN_RUN, TRIG_RUN_BTN, [vid, None, None, dset, None], s)
    print("run done in %.0fs" % (time.time() - t0))
    json.dump(out, open(os.path.join(outdir, "result.json"), "w"), indent=1)
    for item in out:
        cands = []
        if isinstance(item, dict):
            cands = [item] + [v for v in item.values() if isinstance(v, dict)]
        for c in cands:
            if isinstance(c, dict) and c.get("url"):
                name = os.path.basename(c.get("path") or c["url"]).replace("#", "_")
                print("  saved", fetch(c["url"], os.path.join(outdir, name)))


if __name__ == "__main__":
    main()
