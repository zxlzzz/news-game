"""Close-up frames of a clip on the empty ground, for checking where hands, hips and feet meet the object
(docs/动作重做方案.md §4.7): four views (front, left side, right side, from above) around one point, the clip's
frames every 1/5 s in a grid, one PNG.

python godot/tools/closeup.py <out.png> <clip> <x> <y> <z> [--size 1.2] [--every 0.2] [--cut 0.7]
x y z: the point to look at in empty-ground metres (the person of an in-place clip stands at the origin facing +Z);
--size: metres of screen height; --cut: anything nearer the camera than this many metres in front of the point
is cut away (poles, awnings between the camera and the person). Needs Pillow; Godot from GODOT or the default install on D:.
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from record_clip import GODOT, PROJECT

VIEWS = [('front', 0, 8), ('left', 90, 8), ('right', -90, 8), ('above', 0, 70)]
SIZE = 480


def capture(clip, x, y, z, size, cut, yaw, pitch, frames, every, folder):
    cmd = [GODOT, '--path', str(PROJECT), '--resolution', f'{SIZE}x{SIZE}', 'res://scenes/empty_ground/level.tscn', '--',
           '--entry', clip, '--yaw', str(yaw), '--pitch', str(pitch), '--time', '0', '--look', str(x), str(z),
           '--look-y', str(y), '--size', str(size), '--cut', str(cut), '--capture', str(folder), '--frames', str(frames), '--every', str(every)]
    run = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace',
                         stdin=subprocess.DEVNULL, timeout=900)
    if run.returncode != 0 or 'EMPTY_GROUND_CAPTURED' not in run.stdout:
        sys.exit(f'{clip} yaw {yaw}: capture failed\n{run.stdout[-2000:]}\n{run.stderr[-2000:]}')
    return sorted(Path(folder).glob('*.png'))


def main():
    a = argparse.ArgumentParser()
    a.add_argument('out')
    a.add_argument('clip')
    a.add_argument('xyz', type=float, nargs=3)
    a.add_argument('--size', type=float, default=1.2)
    a.add_argument('--every', type=float, default=0.2)
    a.add_argument('--cut', type=float, default=0.7)
    o = a.parse_args()
    from PIL import Image, ImageDraw
    baked = json.loads((PROJECT / 'npc/baked' / f'{o.clip}.json').read_text(encoding='utf-8'))
    fps = 60  # the empty ground renders at 60 frames/s; --every counts rendered frames
    step = max(1, round(o.every * fps))
    frames = int((baked['frames'] - 1) / baked['fps'] * fps / step) + 1
    columns = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, yaw, pitch in VIEWS:
            folder = Path(tmp) / name
            shots = capture(o.clip, *o.xyz, o.size, o.cut, yaw, pitch, frames, step, folder)
            columns.append([Image.open(p).convert('RGB') for p in shots])
        rows = min(len(c) for c in columns)
        out = Image.new('RGB', (SIZE * len(VIEWS), (SIZE + 16) * rows), 'white')
        d = ImageDraw.Draw(out)
        for r in range(rows):
            for c, (name, _, _) in enumerate(VIEWS):
                out.paste(columns[c][r], (c * SIZE, r * (SIZE + 16) + 16))
                d.text((c * SIZE + 4, r * (SIZE + 16) + 2), f'{name}  {r * step / fps:.2f} s', fill='red')
    out.save(o.out)
    print(o.out)


if __name__ == '__main__':
    main()
