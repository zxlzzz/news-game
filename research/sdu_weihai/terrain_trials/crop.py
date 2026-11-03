"""Crop the site imagery at its own pixels (nearest-neighbour zoom), optionally contrast-stretched,
with a scene-metre grid and optional marks. For looking at edges, steps and shadows.

Usage: python crop.py x0 z0 x1 z1 out.png [--zoom N] [--grid M] [--stretch] [--mark x z x z label]...
x0 z0 x1 z1 are scene metres (X east, Z south).
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parents[3]
IMG = ROOT / 'research/sdu_weihai/imagery'


def load():
    meta = json.loads((IMG / 'site.json').read_text(encoding='utf-8'))
    return Image.open(IMG / 'site.jpg'), meta['metres_per_px'], meta['origin_xz']


def crop(x0, z0, x1, z1, zoom=4, stretch=False):
    im, mpp, (ox, oz) = load()
    box = tuple(round(v) for v in ((x0 - ox) / mpp, (z0 - oz) / mpp, (x1 - ox) / mpp, (z1 - oz) / mpp))
    c = np.asarray(im.crop(box).convert('RGB')).astype(float)
    if stretch:
        lo, hi = np.percentile(c, [1, 99])
        c = np.clip((c - lo) / max(hi - lo, 1) * 255, 0, 255)
    out = Image.fromarray(c.astype(np.uint8)).resize(((box[2] - box[0]) * zoom, (box[3] - box[1]) * zoom), Image.NEAREST)
    return out, mpp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('x0', type=float); ap.add_argument('z0', type=float)
    ap.add_argument('x1', type=float); ap.add_argument('z1', type=float)
    ap.add_argument('out')
    ap.add_argument('--zoom', type=int, default=4)
    ap.add_argument('--grid', type=float, default=5)
    ap.add_argument('--stretch', action='store_true')
    ap.add_argument('--mark', nargs=5, action='append', default=[], metavar=('xa', 'za', 'xb', 'zb', 'label'))
    a = ap.parse_args()
    img, mpp = crop(a.x0, a.z0, a.x1, a.z1, a.zoom, a.stretch)
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('arial.ttf', 14)
    except OSError:
        font = ImageFont.load_default()
    px = lambda x: (x - a.x0) / (a.x1 - a.x0) * img.width
    pz = lambda z: (z - a.z0) / (a.z1 - a.z0) * img.height
    g = (a.x0 // a.grid + 1) * a.grid
    while g < a.x1:
        d.line([(px(g), 0), (px(g), img.height)], fill=(255, 255, 0))
        d.text((px(g) + 2, 2), f'{g:g}', fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
        g += a.grid
    g = (a.z0 // a.grid + 1) * a.grid
    while g < a.z1:
        d.line([(0, pz(g)), (img.width, pz(g))], fill=(0, 255, 255))
        d.text((2, pz(g) + 2), f'{g:g}', fill=(0, 255, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
        g += a.grid
    for xa, za, xb, zb, label in a.mark:
        xa, za, xb, zb = map(float, (xa, za, xb, zb))
        d.line([(px(xa), pz(za)), (px(xb), pz(zb))], fill=(255, 0, 0), width=3)
        for x, z in ((xa, za), (xb, zb)):
            d.ellipse([px(x) - 4, pz(z) - 4, px(x) + 4, pz(z) + 4], outline=(255, 0, 0), width=2)
        d.text((px(xb) + 6, pz(zb) - 8), label, fill=(255, 64, 64), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    img.save(a.out)
    print('CROP', a.out, img.size, f'{mpp} m/px')


if __name__ == '__main__':
    main()
