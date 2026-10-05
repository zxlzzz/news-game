"""Draw the aligned site plan's line work (and spot heights) over the imagery: checks align_plan.py.
Usage: python overlay_plan.py x0 z0 x1 z1 out.png [align.json]"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
from crop import crop  # noqa: E402
from align_plan import to_scene  # noqa: E402


def main(x0, z0, x1, z1, out, A=None):
    A = json.loads(Path(A).read_text()) if A else None
    img, _ = crop(x0, z0, x1, z1, zoom=1)
    k = 1600 / img.width
    img = img.resize((1600, int(img.height * k)))
    d = ImageDraw.Draw(img)
    px = lambda q: [((x - x0) / (x1 - x0) * img.width, (z - z0) / (z1 - z0) * img.height) for x, z in q]
    D = json.loads((HERE / 'raw/tender/site_plan.json').read_text(encoding='utf-8'))
    for lay, col in (('地形', (255, 60, 60)), ('-建筑-现状', (255, 0, 255)), ('--景观设计', (0, 255, 255))):
        for l in D['lines'].get(lay, []):
            q = to_scene(l['pts'], A)
            if len(q) >= 2:
                d.line(px(q), fill=col, width=1)
    img.save(out)
    print(out)


if __name__ == '__main__':
    a = sys.argv[1:]
    main(*map(float, a[:4]), a[4], a[5] if len(a) > 5 else None)
