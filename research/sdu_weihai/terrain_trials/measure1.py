"""Trial 1 numbers: brightness profiles across shadow edges, and FABDEM / terrain.bin heights on both
sides of each site's edge. Prints what the report quotes.

Usage: python measure1.py
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import tifffile

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'godot/real_place'))
sys.path.insert(0, str(HERE))
from crop import load
from geo import Site
from build_ground import read_tiff_window

SCENE = ROOT / 'godot/scenes/sdu_weihai'
site = Site(SCENE)
t = json.loads((SCENE / 'terrain.json').read_text())
TB = np.fromfile(SCENE / 'terrain.bin', '<f4').reshape(t['height'], t['width'])


def terrain_bin(x, z):
    return float(TB[int(z - t['z0']), int(x - t['x0'])])


tif = tifffile.TiffFile(ROOT / 'research/sdu_weihai/data/FABDEM_N37E122.tif')
page = tif.pages[0]
sx, sy, _ = page.tags[33550].value
tie = page.tags[33922].value


def fabdem_raw(x, z):
    """The FABDEM sample nearest to (x, z), no interpolation, and its centre in scene metres."""
    lon, lat = site.xz_to_lonlat_np(np.array([x]), np.array([z]))
    col = int(round((lon[0] - tie[3]) / sx))
    row = int(round((tie[4] - lat[0]) / sy))
    v = read_tiff_window(tif, page, row, row + 1, col, col + 1)[0, 0]
    return float(v), (row, col)


IM, MPP, (OX, OZ) = load()


def profile_x(z, x0, x1, half=1.0):
    """Mean grey along x at row z (averaged over +-half metres of z), one value per pixel."""
    box = (round((x0 - OX) / MPP), round((z - half - OZ) / MPP), round((x1 - OX) / MPP), round((z + half - OZ) / MPP))
    g = np.asarray(IM.crop(box).convert('L')).astype(float).mean(0)
    xs = x0 + (np.arange(len(g)) + .5) * MPP
    return xs, g


def dark_run(xs, g, start, thresh):
    """From x >= start, the first run of pixels darker than thresh: (x_from, x_to)."""
    i = int(np.searchsorted(xs, start))
    while i < len(g) and g[i] >= thresh:
        i += 1
    j = i
    while j < len(g) and g[j] < thresh:
        j += 1
    return (xs[i] - MPP / 2, xs[j - 1] + MPP / 2) if j > i else None


if __name__ == '__main__':
    print('== sun: see sun.py; shadow direction due east (scene +X) ==')
    print('\n== trapezoid in front of the main building: shadow east of its east edge ==')
    for z in (132, 136, 140, 144, 148):
        xs, g = profile_x(z, 20, 40, 0.6)
        lit = np.median(g[(xs > 33) & (xs < 38)])
        run = dark_run(xs, g, 26, lit * 0.7)
        print(f'z {z}: plaza grey {lit:.0f}, dark run {run[0]:.1f}..{run[1]:.1f} m, width {run[1] - run[0]:.1f} m' if run else f'z {z}: no dark run')
        print('   grey', ' '.join(f'{v:.0f}' for v in g[(xs > 24) & (xs < 36)]))
    print('\n== building 学24 (17 levels): east tower, shadow east of its east wall x -308 ==')
    for z in (102, 108, 114):
        xs, g = profile_x(z, -312, -220, 1.0)
        sm = np.convolve(g, np.ones(7) / 7, 'same')
        print(f'z {z}: grey every 3 m from -312:', ' '.join(f'{v:.0f}' for v in sm[::10]))
    print('\n== heights on both sides ==')
    sites = {
        'A plaza boundary (x 20)': [(20, 212), (20, 262)],
        'B east housing, strip z -97 (x 365)': [(365, -103), (365, -91)],
        'B east housing, strip z -68 (x 365)': [(365, -74), (365, -62)],
        'C trapezoid, west / east (z 138)': [(5, 138), (36, 138)],
        '学24 wall / shadow end (z 108)': [(-308, 108), (-247, 108)],
    }
    for name, (p, q) in sites.items():
        fp, rp = fabdem_raw(*p)
        fq, rq = fabdem_raw(*q)
        tp, tq = terrain_bin(*p), terrain_bin(*q)
        same = ' (same FABDEM sample)' if rp == rq else ''
        print(f'{name}: FABDEM {fp:.2f} -> {fq:.2f} = {fp - fq:+.2f}{same};  terrain.bin {tp:.2f} -> {tq:.2f} = {tp - tq:+.2f}')
