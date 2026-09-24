"""Compose unaltered Godot screenshots into category contact sheets (requires Pillow)."""
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'review'/'supply'
catalog=json.loads((ROOT/'supply_catalog.json').read_text(encoding='utf-8'))
for group in dict.fromkeys(e['group'] for e in catalog):
    entries=[e for e in catalog if e['group']==group]
    columns=3
    sheet=Image.new('RGB',(columns*640,((len(entries)+columns-1)//columns)*360),'#cccccc')
    for i,entry in enumerate(entries):
        source=OUT/'images'/(entry['name']+'.png')
        with Image.open(source) as im:
            im.thumbnail((640,360),Image.Resampling.LANCZOS)
            sheet.paste(im,((i%columns)*640,(i//columns)*360))
    sheet.save(OUT/(group+'.png'))
    print(group,len(entries))
