import json, numpy as np
from audit import INTER
dump = json.load(open("dump.json"))
def spaces(t):
    out = set()
    if "keys" in t:
        for _, k in t["keys"]: out |= spaces(k)
    elif "arcs" in t:
        for a in t["arcs"]: out |= spaces(a[2]) | spaces(a[3])
    else: out.add(t.get("space", "root"))
    return out
rows = []
for cid, c in INTER["clips"].items():
    for h, t in c.get("hands", {}).items():
        rec = dump.get(cid)
        if not rec or "error" in rec: continue
        ds = []
        for fr in rec["frames"]:
            me = [p for p in fr["people"] if p["main"]][0]
            if me["clip"] != cid: continue
            ds.append(np.linalg.norm(np.array(me["final"][h]) - np.array(me["pre"][h])) * 3)
        if not ds: continue
        rows.append((cid, h, "base" in c, "window" in t, ",".join(sorted(spaces(t))), round(max(ds), 3), round(float(np.mean(ds)), 3)))
rows.sort(key=lambda r: -r[6])
for r in rows: print(*r)
print(len(rows))
