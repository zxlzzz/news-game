"""Compose the remaining runtime sheets for whole-library visual screening."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
HERE=Path(__file__).parent;G=HERE.parent.parent/'godot/npc'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
cfg=read(G/'interactions.json')['clips'];setup=read(G/'clip-setup.json')['clips']
contacts=set(cfg)|{k for k,v in setup.items() if 'partner' in v}|{v['partner']['clip'] for v in setup.values() if 'partner' in v}
ids=sorted(set(c['id'] for c in read(G/'motion/index.json')['clips'])-contacts)
out=HERE/'standalone_sheets';out.mkdir(exist_ok=True);manifest=[]
for page in range((len(ids)+3)//4):
    chunk=ids[page*4:page*4+4];canvas=Image.new('RGB',(1536,2096),'#ddd');draw=ImageDraw.Draw(canvas)
    for i,cid in enumerate(chunk):
        x,y=(i%2)*768,(i//2)*1048;draw.text((x+10,y+5),cid,fill='black')
        canvas.paste(Image.open(HERE/'humans'/f'{cid}.png').resize((768,1024)),(x,y+24))
    target=out/f'standalone_{page+1:02d}.png';canvas.save(target)
    manifest.append({'page':page+1,'clips':chunk,'path':str(target)})
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(len(ids),'standalone clips;',len(manifest),'pages')
