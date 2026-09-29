"""Render part of the site imagery with a scene-metre grid, for reading positions off the image.

Usage: python godot/real_place/view_area.py godot/scenes/<site> x0 z0 x1 z1 out.png [grid_m] [overlay]
x0 z0 x1 z1 are scene metres (X east, Z south). Grid lines every grid_m (default: about 8 per side),
labelled with their coordinate. overlay: optional cover_preview blended at 40% ('cover') or a
ground build preview ('ground').
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from geo import Site

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parents[2]


def main(scene, x0, z0, x1, z1, out, grid=None, overlay=None):
    site = Site(scene)
    d = ROOT / site.cfg['imagery']['dir']
    meta = json.loads((d / 'site.json').read_text(encoding='utf-8'))
    mpp = meta['metres_per_px']
    ox, oz = meta['origin_xz']
    im = Image.open(d / 'site.jpg')
    box = tuple(round(v) for v in ((x0 - ox) / mpp, (z0 - oz) / mpp, (x1 - ox) / mpp, (z1 - oz) / mpp))
    crop = im.crop(box).convert('RGB')
    if overlay:
        ov = Image.open(d / ('cover_preview.png' if overlay == 'cover' else 'ground_preview.png')).convert('RGB')
        k = im.width / ov.width
        o = ov.crop(tuple(round(v / k) for v in box)).resize(crop.size, Image.NEAREST)
        crop = Image.blend(crop, o, 0.45)
    scale = 1400 / max(crop.size)
    crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.LANCZOS)
    draw = ImageDraw.Draw(crop)
    if grid is None:
        span = max(x1 - x0, z1 - z0) / 8
        grid = next(g for g in (1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500) if g >= span)
    try:
        font = ImageFont.truetype('arial.ttf', 14)
    except OSError:
        font = ImageFont.load_default()
    px = lambda x: (x - x0) / (x1 - x0) * crop.width
    pz = lambda z: (z - z0) / (z1 - z0) * crop.height
    g = (x0 // grid + 1) * grid
    while g < x1:
        draw.line([(px(g), 0), (px(g), crop.height)], fill=(255, 255, 0), width=1)
        draw.text((px(g) + 2, 2), f'{g:g}', fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
        g += grid
    g = (z0 // grid + 1) * grid
    while g < z1:
        draw.line([(0, pz(g)), (crop.width, pz(g))], fill=(0, 255, 255), width=1)
        draw.text((2, pz(g) + 2), f'{g:g}', fill=(0, 255, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
        g += grid
    crop.save(out)
    print('VIEW', out, crop.size, 'grid', grid)


if __name__ == '__main__':
    a = sys.argv
    main(a[1], *map(float, a[2:6]), a[6], float(a[7]) if len(a) > 7 and a[7] != '-' else None, a[8] if len(a) > 8 else None)
