"""Put one generated Kimodo take into the motion library and export it for Godot (docs/动作重做方案.md).

python scripts/motion_install.py <take folder> <clip> [--object <type> --post <marker>] [--note "..."] [--smooth <frames>]
  <take folder>: what scripts/kimodo_motion_batch.py wrote (motion.npz + meta.json).
  Copies them to assets/animations/npz/<clip>/, records source_frame "fixed" (takes are generated in the stance
  frame: the post's marker, or the standing spot, at the origin facing +Z) and, with --object/--post, the object
  type and post marker the take was made at (the bake reads contact markers there). --smooth: a held still pose
  (seated, slouching) whose pinned frames twitch: the export blurs its joint paths over that many frames
  (meta "smooth_frames", scripts/export-npc-motion.py); not for clips with quick moves. Then runs
  scripts/export-npc-motion.py --only <clip>. Bake afterwards: godot/tools/bake_motion.gd -- <clip>.
The previous take of the clip is not kept here; git history (or D:/news-game-archive) has older ones.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKELETON = r'C:/kimodo-trial/kimodo/kimodo/skeleton/definitions.py'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('take', type=Path)
    ap.add_argument('clip')
    ap.add_argument('--object')
    ap.add_argument('--post')
    ap.add_argument('--note', default='')
    ap.add_argument('--smooth', type=float)
    a = ap.parse_args()
    meta = json.loads((a.take / 'meta.json').read_text(encoding='utf-8'))
    meta['name'] = a.clip
    meta['source_frame'] = 'fixed'
    scene = {}
    if a.object or a.post:
        if not (a.object and a.post):
            sys.exit('--object and --post go together')
        scene.update(object=a.object, post=a.post)
    if a.note:
        scene['note'] = a.note
    if scene:
        meta['scene'] = scene
    else:
        meta.pop('scene', None)
    if a.smooth:
        meta['smooth_frames'] = a.smooth
    else:
        meta.pop('smooth_frames', None)
    folder = ROOT / 'assets/animations/npz' / a.clip
    folder.mkdir(parents=True, exist_ok=True)
    shutil.copy(a.take / 'motion.npz', folder / 'motion.npz')
    (folder / 'meta.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    run = subprocess.run([sys.executable, str(ROOT / 'scripts/export-npc-motion.py'), '--skeleton-definition', SKELETON,
                          '--out', str(ROOT / 'godot/npc/motion'), '--only', a.clip], capture_output=True, text=True)
    if run.returncode != 0:
        sys.exit(run.stdout + run.stderr)
    print(f'installed {a.clip} from {a.take}')


if __name__ == '__main__':
    main()
