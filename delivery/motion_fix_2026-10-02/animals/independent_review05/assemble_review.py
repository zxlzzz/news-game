"""Repack existing candidate_05 pixels for complete two-angle visual review.

Does not render, modify source assets, infer motion quality, or discard samples.
Each page contains two clips, every supplied frame and both original views.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'source/husky_candidate_05'


def pack(folder, manifest_name, prefix, pair_count=2):
    manifest = json.loads((folder / manifest_name).read_text())
    records = []
    for record in manifest:
        name = record['name']
        count = len(record['times_s'])
        rows = (count+5)//6
        block = Image.new('RGB', (1800, rows*300*2+40), '#dddddd')
        draw = ImageDraw.Draw(block)
        draw.text((8, 8), name+' | all times, game then side', fill='black')
        for v, angle in enumerate(['game', 'side']):
            for i in range(count):
                image = Image.open(folder / f'{name}__{angle}__{i:02}.png')
                assert image.size == (300, 300), image.size
                block.paste(image, ((i%6)*300, 40+(v*rows+i//6)*300))
        records.append((name, block))
    coverage = []
    for p in range(0, len(records), pair_count):
        group = records[p:p+pair_count]
        image = Image.new('RGB', (1800, sum(x[1].height for x in group)), '#dddddd')
        y = 0
        for name, block in group:
            image.paste(block, (0, y)); y += block.height
        filename = f'{prefix}_{p//pair_count+1:02}.png'
        image.save(HERE/filename)
        coverage.append({'page': filename, 'clips': [x[0] for x in group]})
    (HERE / (prefix+'_pages.json')).write_text(json.dumps(coverage, indent=2))


if __name__ == '__main__':
    pack(SOURCE/'frames', 'manifest.json', 'all48')
    pack(SOURCE/'shake_60hz', 'manifest.json', 'shake', 1)
