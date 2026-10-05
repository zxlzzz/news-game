"""Rebuild final actual-image previews and verify encoded GIF durations.

No game/source assets are changed. The timing helper quantizes cumulative capture
time to GIF centiseconds; this verifier reads encoded durations back from files.
"""
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
HELPER = REPO / 'godot/tools/motion_sheet_gif.py'
PLAN = [
    ('after', 'gifs', ['walk_backpack_straps', 'elder_assisted_walk', 'vending_collect', 'hang_laundry']),
    ('focus', 'gifs', ['distribute_flyer', 'fruit_weigh', 'chess_move', 'take_back_piece', 'photo_overhead']),
    ('phone_early', 'gifs', None),
    ('phone_full', 'gifs', None),
    ('cups', 'gifs', None),
    ('cup_boundaries', 'gifs', None),
    ('mop_after', 'gifs', None),
    ('u2_after_full', 'u2_gifs', ['assist_elder_walk', 'atm_take_cash', 'fountain_drink']),
    ('basketball_continuous', 'u2_gifs', None),
    ('basketball_seam', 'u2_gifs', None),
]


def read_gif(path):
    if not path.exists():
        return None
    with Image.open(path) as im:
        loop = 'loop' in im.info
        total = 0
        for i in range(im.n_frames):
            im.seek(i)
            total += im.info.get('duration', 0)
        return {'frames': im.n_frames, 'duration_ms': total,
                'size': list(im.size), 'loop_extension_present': loop}


records = []
for capture, output, ids in PLAN:
    manifest = json.loads((HERE / capture / 'manifest.json').read_text(encoding='utf-8'))
    chosen = [r for r in manifest if ids is None or r['id'] in ids]
    previous = {r['label']: read_gif(HERE / output / (r['label'] + '.gif')) for r in chosen}
    args = [sys.executable, str(HELPER), str(HERE / capture), str(HERE / output)]
    if ids:
        args += ['--ids'] + ids
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)
    for rec in chosen:
        path = HERE / output / (rec['label'] + '.gif')
        encoded = read_gif(path)
        # Last image is shown for one capture interval, matching the helper.
        expected_ms = 1000 * (rec['times'][rec['samples'] - 1] - rec['times'][0]
                             + rec['duration'] / rec['samples'])
        error_ms = encoded['duration_ms'] - expected_ms
        assert abs(error_ms) <= 5.00001, (path, error_ms)
        assert not encoded['loop_extension_present'], path
        records.append({'file': str(path.relative_to(HERE)).replace('\\', '/'),
                        'capture': capture + '/manifest.json',
                        'sampled_duration_ms': expected_ms,
                        'before': previous[rec['label']], 'after': encoded,
                        'rounding_error_ms': error_ms})

(HERE / 'gif_timing.json').write_text(json.dumps({
    'method': 'Actual screenshot cells; cumulative time quantized to 10 ms, verified by decoding GIF frame durations.',
    'records': records}, indent=2) + '\n', encoding='utf-8')
print('GIF_TIMING_OK', len(records), 'final previews; maximum total rounding error',
      max(abs(r['rounding_error_ms']) for r in records), 'ms')
