"""Arrange existing runtime capture cells for inspection; no production rendering."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
manifest = json.loads((HERE/'captures/manifest.json').read_text(encoding='utf-8'))
groups = {}
for entry in manifest:
    group = entry['label'].split('_')[0]
    groups.setdefault(group, []).append(entry)
for group, entries in groups.items():
    for page in range(0, len(entries), 4):
        part = entries[page:page+4]
        sheet = Image.new('RGB', (2048, 4*170*len(part)), '#ffffff')
        draw = ImageDraw.Draw(sheet)
        for row, entry in enumerate(part):
            im = Image.open(HERE/'captures'/ (entry['label']+'.png')).convert('RGB')
            draw.text((6,row*680+2), entry['label'], fill='#000000')
            cells=[]
            boxes=[]
            for vi in range(2):
                for k in range(32):
                    tile=im.crop(((k%8)*256, (vi*4+k//8)*256, (k%8+1)*256, (vi*4+k//8+1)*256))
                    a=np.asarray(tile)
                    mask=(a[32:,:,:].max(axis=2)<45)
                    yy,xx=np.where(mask)
                    if len(xx): boxes.append((xx.min(),yy.min()+32,xx.max(),yy.max()+32))
                    cells.append(tile)
            if boxes:
                boxes=np.array(boxes)
                box=(max(0,int(boxes[:,0].min()-8)),max(32,int(boxes[:,1].min()-8)),min(256,int(boxes[:,2].max()+8)),min(256,int(boxes[:,3].max()+8)))
            else:box=(32,32,224,224)
            for i,tile in enumerate(cells):
                crop=tile.crop(box)
                crop.thumbnail((126,146))
                x=(i%16)*128
                y=row*680+20+(i//16)*165
                sheet.paste(crop,(x+(128-crop.width)//2,y+(146-crop.height)//2))
                draw.text((x+2,y+147),f"{entry['times'][i%32]:.2f}s",fill='#000000')
        sheet.save(HERE/f'overview_{group}_{page//4+1}.png')
        print(group,page//4+1,[e['label'] for e in part])
