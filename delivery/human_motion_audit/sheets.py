"""Per-clip comparison sheets + metrics.  python sheets.py [clip ...]"""
import json, sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from audit import *

OUT = SCR / "sheets"; OUT.mkdir(exist_ok=True)
P_NS = dict(P0, minSpread=0)
NCOL = 6
SOMA_DRAW = [(SOMA[p], SOMA[n]) for n, p in BONES if p and not any(k in n for k in ("Thumb", "Index", "Middle", "Ring", "Pinky", "Eye", "Jaw", "ToeBase"))]
SOMA_DRAW += [(SOMA["LeftFoot"], SOMA["LeftToeEnd"]), (SOMA["RightFoot"], SOMA["RightToeEnd"])]

def proj(p, view):
    # front: camera at +Z looking -Z -> screen x = -x ; side: camera at +X looking -X -> screen x = -z... use z
    p = np.asarray(p)
    return (-p[..., 0], p[..., 1]) if view == "front" else (p[..., 2], p[..., 1])

def draw_fig(ax, segs, head, view, color="k", lw=2.2, hr=None):
    for a, b in segs:
        x, y = proj(np.array([a, b]), view)
        ax.plot(x, y, color=color, lw=lw, solid_capstyle="round")
    if head is not None:
        x, y = proj(np.array(head), view)
        ax.add_patch(plt.Circle((x, y), hr or P0["headR"], color=color))

def draw_box(ax, box, view, color):
    b = np.array(box)
    for i in range(8):
        for j in range(i + 1, 8):
            if bin(i ^ j).count("1") == 1:
                x, y = proj(b[[i, j]], view)
                ax.plot(x, y, color=color, lw=0.8)

def mapped_np(c, i):
    return c.mapped[i]

def stage_poses(cid, rec, c, cn):
    """list over sampled frames of dict stage -> (segs, head, things)"""
    frames = rec["frames"]
    picks = np.linspace(0, len(frames), NCOL, endpoint=False).astype(int)
    rows = []
    for k in picks:
        fr = frames[k]
        me = [p for p in fr["people"] if p["main"]][0]
        i = c.frame_of(me["phase"])
        src = c.source(i)
        base = INTER["clips"].get(cid, {}).get("base")
        rows.append({"phase": me["phase"], "i": i, "src": src,
                     "nospread": cn.mapped[i], "map": c.mapped[i],
                     "final": me["final"], "things": me["things"], "others": [p for p in fr["people"] if not p["main"]]})
    return rows

def render(cid, rec):
    c = Clip(cid); cn = Clip(cid, P_NS)
    rows = stage_poses(cid, rec, c, cn)
    cfg = INTER["clips"].get(cid, {})
    stages = ["src", "nospread", "map", "final"]
    labels = ["source (npz)", "map, no minSpread", "map (accepted)", "final runtime"]
    fig, axes = plt.subplots(4, NCOL * 2, figsize=(NCOL * 2 * 1.0, 4 * 1.25))
    for vi, view in enumerate(("front", "side")):
        for col, r in enumerate(rows):
            for si, st in enumerate(stages):
                ax = axes[si, vi * NCOL + col]
                ax.set_aspect("equal"); ax.axis("off")
                ax.axhline(0, color="#999", lw=0.6)
                if st == "src":
                    if r["src"] is not None:
                        s = r["src"]
                        for a, b in SOMA_DRAW:
                            x, y = proj(s[[a, b]], view)
                            ax.plot(x, y, color="#335", lw=1.2)
                        hc = (s[SOMA["Head"]] + s[SOMA["HeadEnd"]]) / 2
                        x, y = proj(hc, view)
                        ax.add_patch(plt.Circle((x, y), 0.1 * c.r, color="#335", fill=False, lw=1))
                elif st in ("nospread", "map"):
                    m = r[st]
                    draw_fig(ax, m["segs"], m["head"], view, color="#333" if st == "map" else "#555")
                else:
                    f = r["final"]
                    draw_fig(ax, [(a, b) for a, b in f["segs"]], f["head"], view)
                    for t in r["things"]:
                        if t.get("visible", True):
                            draw_box(ax, t["box"], view, "#c33" if not t.get("object") else "#39c")
                ax.set_xlim(-0.33, 0.33)
                ax.set_ylim(-0.04, 0.72)
                if col == 0 and vi == 0:
                    ax.text(-0.33, 0.66, labels[si], fontsize=6)
                if si == 0:
                    ax.set_title(f"{view} φ{r['phase']:.2f}", fontsize=6)
    tag = []
    if cfg.get("base"): tag.append("BASE=" + cfg["base"])
    for k in ("body", "feet", "hands", "head_direction", "shift"):
        if k in cfg: tag.append(k + (":" + ",".join(cfg[k].keys()) if isinstance(cfg[k], dict) and k in ("feet", "hands") else ""))
    fig.suptitle(cid + "   " + "  ".join(tag), fontsize=8)
    plt.subplots_adjust(left=0.005, right=0.995, top=0.92, bottom=0.005, wspace=0.02, hspace=0.05)
    fig.savefig(OUT / f"{cid}.png", dpi=110)
    plt.close(fig)

if __name__ == "__main__":
    dump = load_dump(SCR / "dump.json")
    ids = sys.argv[1:] or list(dump)
    for cid in ids:
        if "error" in dump[cid]:
            print("ERR", cid, dump[cid]["error"]); continue
        render(cid, dump[cid])
    print("done", len(ids))
