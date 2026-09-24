"""Record tools/locomotion_review.tscn to GIFs (and a first-frame PNG) for review pages.

python godot/tools/record_review.py <out dir> [mode ...]      modes: dog leash bicycle scooter (default all)
Each mode is recorded from the side and from the game's high angle, 15 frames/s, 480x320.
Needs Pillow; Godot path from the GODOT environment variable or the default install on D:.
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

GODOT = os.environ.get('GODOT', r'D:/Godot/Godot_v4.7.2-stable_win64_console.exe')
PROJECT = Path(__file__).resolve().parents[1]
# mode: (start time s, seconds recorded, camera yaw for the high view)
TAKES = {'dog': (1.0, 18.0, 50), 'leash': (1.0, 18.0, 60), 'bicycle': (1.0, 10.0, 50), 'scooter': (1.0, 10.0, 50)}
EVERY = 4  # simulation steps of 1/60 s per recorded frame -> 15 frames/s
VIEWS = {'side': 90, 'high': None}


def record(mode, view, out):
    start, seconds, high_yaw = TAKES[mode]
    frames = int(seconds * 60 / EVERY)
    with tempfile.TemporaryDirectory() as tmp:
        cmd = [GODOT, '--path', str(PROJECT), '--resolution', '960x640', 'res://tools/locomotion_review.tscn', '--',
               '--mode', mode, '--view', view, '--yaw', str(VIEWS[view] or high_yaw), '--time', str(start),
               '--capture', tmp, '--frames', str(frames), '--every', str(EVERY)]
        run = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=900)
        if run.returncode != 0 or 'LOCOMOTION_CAPTURED' not in run.stdout:
            sys.exit(f'{mode}/{view} failed:\n{run.stdout[-2000:]}\n{run.stderr[-2000:]}')
        images = [Image.open(p).convert('RGB').resize((480, 320), Image.LANCZOS) for p in sorted(Path(tmp).glob('*.png'))]
    name = out / f'{mode}_{view}'
    images[0].save(name.with_suffix('.png'))
    palette = [im.quantize(colors=32, method=Image.Quantize.MEDIANCUT) for im in images]
    palette[0].save(name.with_suffix('.gif'), save_all=True, append_images=palette[1:], duration=1000 * EVERY // 60, loop=0)
    print(name.with_suffix('.gif'), len(images), 'frames')


def main():
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    for mode in sys.argv[2:] or list(TAKES):
        for view in VIEWS:
            record(mode, view, out)


if __name__ == '__main__':
    main()
