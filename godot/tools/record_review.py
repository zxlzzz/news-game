"""Record the movers of the empty ground (scenes/empty_ground, movers.json) to GIFs and a still PNG a third of the way in.

python godot/tools/record_review.py <out dir> [mover ...]      movers: the ids in scenes/empty_ground/movers.json (default all)
Each is recorded from the side and from the game's high angle, 15 frames/s, 480x320; the view height and
whether the camera follows come from movers.json.
Needs Pillow; Godot path from the GODOT environment variable or the default install on D:.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

GODOT = os.environ.get('GODOT', r'D:/Godot/Godot_v4.7.2-stable_win64_console.exe')
PROJECT = Path(__file__).resolve().parents[1]
MOVERS = json.loads((PROJECT / 'scenes/empty_ground/movers.json').read_text(encoding='utf-8'))['movers']
# mover: (start time s, seconds recorded, camera yaw for the high view)
# the leash's high view looks from the dog's side (the leash hand), so the dog is not hidden behind the walker
TAKES = {'dog': (1.0, 18.0, 50), 'pigeon': (0.0, 26.0, 50), 'pigeon_fly': (14.0, 10.0, 50), 'leash': (1.0, 15.0, -60),
         'bicycle': (1.0, 9.0, 50), 'scooter': (1.0, 9.0, 50)}
DEFAULT_TAKE = (0.0, 10.0, 50)
EVERY = 4  # simulation steps of 1/60 s per recorded frame -> 15 frames/s
VIEWS = {'side': (90, 8), 'high': (None, 38)}  # view: (yaw or None = the take's, pitch)


def record(mover, view, out):
    start, seconds, high_yaw = TAKES.get(mover, DEFAULT_TAKE)
    yaw, pitch = VIEWS[view]
    frames = int(seconds * 60 / EVERY)
    with tempfile.TemporaryDirectory() as tmp:
        cmd = [GODOT, '--path', str(PROJECT), '--resolution', '960x640', 'res://scenes/empty_ground/level.tscn', '--',
               '--entry', mover, '--yaw', str(yaw if yaw is not None else high_yaw), '--pitch', str(pitch), '--time', str(start),
               '--capture', tmp, '--frames', str(frames), '--every', str(EVERY)]
        run = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace',
                             stdin=subprocess.DEVNULL, timeout=900)
        if run.returncode != 0 or 'EMPTY_GROUND_CAPTURED' not in run.stdout:
            sys.exit(f'{mover}/{view} failed:\n{run.stdout[-2000:]}\n{run.stderr[-2000:]}')
        images = [Image.open(p).convert('RGB').resize((480, 320), Image.LANCZOS) for p in sorted(Path(tmp).glob('*.png'))]
    name = out / f'{mover}_{view}'
    images[len(images) // 3].save(name.with_suffix('.png'))
    palette = [im.quantize(colors=32, method=Image.Quantize.MEDIANCUT) for im in images]
    palette[0].save(name.with_suffix('.gif'), save_all=True, append_images=palette[1:], duration=1000 * EVERY // 60, loop=0)
    print(name.with_suffix('.gif'), len(images), 'frames')


def main():
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    for mover in sys.argv[2:] or list(MOVERS):
        if mover not in MOVERS:
            sys.exit(f'no mover {mover} in movers.json ({", ".join(MOVERS)})')
        for view in VIEWS:
            record(mover, view, out)


if __name__ == '__main__':
    main()
