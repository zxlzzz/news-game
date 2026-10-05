"""Group runtime contact sheets without changing production files.

Four full 24-time/two-view sheets per page; each cell becomes 128 px. These
pages support coverage/triage; zoom individual originals for conclusions.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
I = json.loads((REPO / "godot/npc/interactions.json").read_text(encoding="utf-8"))["clips"]
S = json.loads((REPO / "godot/npc/clip-setup.json").read_text(encoding="utf-8"))["clips"]
IDS = sorted(set(I) | {k for k,v in S.items() if "partner" in v} | {v["partner"]["clip"] for v in S.values() if "partner" in v})
OUT = HERE / "contact_sheets"
OUT.mkdir(exist_ok=True)
manifest = []
for page in range((len(IDS)+3)//4):
    ids = IDS[page*4:page*4+4]
    canvas = Image.new("RGB", (1536, 2096), "#dddddd")
    draw = ImageDraw.Draw(canvas)
    available = []
    for i, name in enumerate(ids):
        path = HERE / "humans" / (name+".png")
        x, y = (i%2)*768, (i//2)*1048
        draw.text((x+10,y+5), name, fill="black")
        if path.exists():
            canvas.paste(Image.open(path).resize((768,1024)),(x,y+24))
            available.append(name)
        else:
            draw.text((x+10,y+40), "pending capture", fill="black")
    path = OUT / f"contacts_{page+1:02d}.png"
    canvas.save(path)
    manifest.append({"page":page+1,"ids":ids,"available":available,"path":str(path)})
(OUT / "manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"requested":len(IDS),"available":sum(len(m["available"]) for m in manifest),"pages":len(manifest)},ensure_ascii=False))
