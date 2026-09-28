"""Record the animal actions of the empty ground (scenes/empty_ground, movers.json "animals") to GIFs and
contact sheets, plus a still of each breed sitting.

python godot/tools/record_animals.py <out dir> [species:action ...]     (default: every animal entry)
Frame counts and steps come from the review block of npc/animal-behaviour.json; the entries are the
scenarios walk, trot, behaviour and every action npc/animal-models.json gives the species. Needs Pillow; Godot path
from the GODOT environment variable or the default install on D:.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

GODOT = os.environ.get('GODOT', 'D:/Godot/Godot_v4.7.2-stable_win64_console.exe')
PROJECT = Path(__file__).resolve().parents[1]
REVIEW = json.loads((PROJECT / 'npc/animal-behaviour.json').read_text(encoding='utf-8'))['review']
ANIMALS = json.loads((PROJECT / 'scenes/empty_ground/movers.json').read_text(encoding='utf-8'))['animals']
MODELS = json.loads((PROJECT / 'npc/animal-models.json').read_text(encoding='utf-8'))
SCENARIOS = ['walk', 'trot', 'behaviour']


def run(extra, done):
    cmd = [GODOT, '--path', str(PROJECT), '--resolution', '960x640', 'res://scenes/empty_ground/level.tscn', '--'] + extra
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace',
                            stdin=subprocess.DEVNULL, timeout=600)
    if result.returncode or done not in result.stdout:
        sys.exit(result.stdout[-2000:] + result.stderr[-2000:])


def record(out, entry):
    every = int(REVIEW['capture_every'])
    frames = int(REVIEW['frames'])
    if entry.endswith(':behaviour'):
        every = 15
        frames = round(REVIEW['behaviour_duration'] / REVIEW['dt'] / every)
    with tempfile.TemporaryDirectory() as tmp:
        run(['--entry', entry, '--capture', tmp, '--frames', str(frames), '--every', str(every)], 'EMPTY_GROUND_CAPTURED')
        images = [Image.open(p).convert('RGB').resize((480, 320), Image.Resampling.LANCZOS) for p in sorted(Path(tmp).glob('*.png'))]
    name = entry.replace(':', '_')
    pal = [im.quantize(colors=32) for im in images]
    pal[0].save(out / (name + '.gif'), save_all=True, append_images=pal[1:], duration=round(1000 * REVIEW['dt'] * every), loop=0)
    sheet = Image.new('RGB', (1440, 640))
    for i in range(6):
        sheet.paste(images[round(i * (len(images) - 1) / 5)], ((i % 3) * 480, (i // 3) * 320))
    sheet.save(out / (name + '.png'))
    print(name, 'recorded', flush=True)


def main():
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    entries = sys.argv[2:] or [f'{sp}:{a}' for sp in ANIMALS for a in SCENARIOS + MODELS['species'][sp]]
    for entry in entries:
        record(out, entry)
    if not sys.argv[2:]:
        for breed, b in MODELS['breeds'].items():
            run(['--entry', b['species'] + ':sit', '--breed', breed, '--time', '6', '--shot', str(out / f'{breed}.png')], 'SHOT')


if __name__ == '__main__':
    main()
