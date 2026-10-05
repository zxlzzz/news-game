"""Overview from a dump: per clip one row, NF frames x (src | pre (own clip, current mapping) | final), + side src/pre/final.
python ov2.py <dump> <outdir> clip ..."""
import sys
from sheets import *
dump = json.load(open(sys.argv[1])); OUTD = SCR / sys.argv[2]; OUTD.mkdir(exist_ok=True)
ids = sys.argv[3:] or [k for k in dump if "error" not in dump[k]]
PER = 5; NF = 4
def panel(ax, kind, r, view, c):
    ax.set_aspect("equal"); ax.axis("off"); ax.axhline(0, color="#999", lw=0.5)
    ax.set_xlim(-0.32, 0.32); ax.set_ylim(-0.03, 0.72)
    if kind == "src":
        s = r["src"]
        if s is None: return
        for a, b in SOMA_DRAW:
            x, y = proj(s[[a, b]], view); ax.plot(x, y, color="#2a4", lw=1.0)
        hc = (s[SOMA["Head"]] + s[SOMA["HeadEnd"]]) / 2; x, y = proj(hc, view)
        ax.add_patch(plt.Circle((x, y), 0.1 * c.r, color="#2a4", fill=False, lw=0.8))
    elif kind == "pre":
        draw_fig(ax, r["pre"]["segs"], r["pre"]["head"], view, color="#777", lw=1.6)
    else:
        f = r["final"]; draw_fig(ax, f["segs"], f["head"], view, lw=1.6)
        for t in r["things"]:
            if t.get("visible", True): draw_box(ax, t["box"], view, "#c33" if not t.get("object") else "#39c")
for g in range(0, len(ids), PER):
    chunk = ids[g:g+PER]
    fig, axes = plt.subplots(len(chunk), NF*3 + 3, figsize=((NF*3+3)*0.8, len(chunk)*1.05))
    if len(chunk) == 1: axes = axes[None]
    for ri, cid in enumerate(chunk):
        c = Clip(cid); rec = dump[cid]
        frames = rec["frames"]; picks = np.linspace(0, len(frames), NF, endpoint=False).astype(int)
        rows = []
        for k in picks:
            me = [p for p in frames[k]["people"] if p["main"]][0]
            i = c.frame_of(me["phase"])
            rows.append({"src": c.source(i), "pre": me["pre"], "final": me["final"], "things": me["things"]})
        for fi, r in enumerate(rows):
            for ki, kind in enumerate(("src", "pre", "final")):
                panel(axes[ri, fi*3+ki], kind, r, "front", c)
        mid = rows[1]
        for ki, kind in enumerate(("src", "pre", "final")):
            panel(axes[ri, NF*3+ki], kind, mid, "side", c)
        cfg = INTER["clips"].get(cid, {})
        tag = ("BASE=" + cfg["base"] + " " if cfg.get("base") else "") + " ".join(k for k in ("body","feet","hands","head_direction") if k in cfg)
        axes[ri, 0].text(-0.32, 0.67, f"{cid}  {tag}", fontsize=6, color="#a00" if cfg.get("base") else "k")
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0, wspace=0, hspace=0.02)
    fig.savefig(OUTD / f"p_{g//PER:02d}.png", dpi=100); plt.close(fig)
print("ok")
