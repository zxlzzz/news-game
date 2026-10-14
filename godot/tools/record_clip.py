"""Record human clips of the empty ground as review videos (docs/动作重做方案.md §4.7): for each clip one MP4,
two views side by side (the game's high angle on the left, the side on the right), at normal speed, 30 frames/s,
the whole clip once plus half a second of its last pose. Objects, held things and the partner are in the picture
because the empty ground places them (npc/clip-setup.json).

python godot/tools/record_clip.py <out dir> <clip> [<clip> ...] [--sheet] [--game-yaw <degrees>]
--game-yaw: the game view from another side (the street camera turns all the way round), for a person a near post of
their object would hide.
--sheet also writes <clip>_sheet.png: the video's frames every 1/6 s in a grid (both views), for a quick self-check
before anyone watches the video. Needs ffmpeg on PATH and Pillow; Godot from GODOT or the default install on D:.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

GODOT = os.environ.get('GODOT', r'D:/Godot/Godot_v4.7.2-stable_win64_console.exe')
PROJECT = Path(__file__).resolve().parents[1]
FPS = 30
HOLD = 0.5  # seconds of the last pose after the clip
VIEWS = [('game', 30, 25, 0), ('side', 90, 6, 0.5)]  # name, yaw, pitch (the high view lowered a little: canopies hid
# people), cut: for an in-place clip, anything more than this many metres nearer the camera than the person is left
# out (0: nothing): from the side the near end of a bench or counter would stand in front of the person and read as
# cutting through them (2026-10-14).
CLOSE = 2.8  # metres of screen height for a clip that stays in place: framed on the person, not on a big object
SIZE = '720x720'


def clip_seconds(clip):
    baked = json.loads((PROJECT / 'npc/baked' / f'{clip}.json').read_text(encoding='utf-8'))
    return (baked['frames'] - 1) / baked['fps']


def record_view(clip, yaw, pitch, cut, frames, folder):
    baked = json.loads((PROJECT / 'npc/baked' / f'{clip}.json').read_text(encoding='utf-8'))
    # The person of an in-place clip stands at the origin of the empty ground.
    close = ['--look', '0', '0', '--size', str(CLOSE)] if baked['in_place'] else []
    if baked['in_place'] and cut > 0:
        close += ['--cut', str(cut)]
    cmd = [GODOT, '--path', str(PROJECT), '--resolution', SIZE, 'res://scenes/empty_ground/level.tscn', '--',
           '--entry', clip, '--yaw', str(yaw), '--pitch', str(pitch), '--time', '0'] + close + [
           '--capture', str(folder), '--frames', str(frames), '--every', '2']
    cmd = [c for c in cmd if c != '']
    run = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace',
                         stdin=subprocess.DEVNULL, timeout=900)
    if run.returncode != 0 or 'EMPTY_GROUND_CAPTURED' not in run.stdout:
        sys.exit(f'{clip} yaw {yaw}: capture failed\n{run.stdout[-2000:]}\n{run.stderr[-2000:]}')


def sheet(video, target, every=1 / 6, width=420, cols=6):
    from PIL import Image, ImageDraw
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(video), '-vf',
                        f'fps={1 / every},scale={width}:-1', str(Path(tmp) / '%03d.png')], check=True)
        frames = [Image.open(p).convert('RGB') for p in sorted(Path(tmp).glob('*.png'))]
    w, h = frames[0].size
    rows = (len(frames) + cols - 1) // cols
    out = Image.new('RGB', (w * cols, (h + 14) * rows), 'white')
    draw = ImageDraw.Draw(out)
    for i, im in enumerate(frames):
        x, y = (i % cols) * w, (i // cols) * (h + 14)
        out.paste(im, (x, y + 14))
        draw.text((x + 2, y + 1), f'{i * every:.2f} s', fill='red')
    out.save(target)


def main():
    global VIEWS
    if '--game-yaw' in sys.argv:
        i = sys.argv.index('--game-yaw')
        VIEWS = [(VIEWS[0][0], float(sys.argv[i + 1])) + VIEWS[0][2:]] + VIEWS[1:]
        del sys.argv[i:i + 2]
    args = [a for a in sys.argv[1:] if a != '--sheet']
    if len(args) < 2:
        sys.exit(__doc__)
    sys.argv = [sys.argv[0]] + args + (['--sheet'] if '--sheet' in sys.argv else [])
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    if shutil.which('ffmpeg') is None:
        sys.exit('ffmpeg not found on PATH')
    for clip in [a for a in sys.argv[2:] if a != '--sheet']:
        frames = round((clip_seconds(clip) + HOLD) * FPS) + 1
        with tempfile.TemporaryDirectory() as tmp:
            dirs = []
            for name, yaw, pitch, cut in VIEWS:
                d = Path(tmp) / name
                record_view(clip, yaw, pitch, cut, frames, d)
                dirs.append(d)
            target = out / f'{clip}.mp4'
            cmd = ['ffmpeg', '-y', '-loglevel', 'error']
            for d in dirs:
                cmd += ['-framerate', str(FPS), '-i', str(d / '%04d.png')]
            cmd += ['-filter_complex', 'hstack=inputs=%d' % len(dirs), '-pix_fmt', 'yuv420p', '-c:v', 'libx264',
                    '-crf', '20', str(target)]
            subprocess.run(cmd, check=True)
        if '--sheet' in sys.argv:
            sheet(target, out / f'{clip}_sheet.png')
        print('wrote', target)


if __name__ == '__main__':
    main()
