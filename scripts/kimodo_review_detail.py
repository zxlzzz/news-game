"""Read-only follow-camera/contact sheets for exported Kimodo NPZ candidates.

Run in Kimodo's Python environment. Images are review output, not motion edits.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from kimodo.skeleton.definitions import SOMASkeleton77


def review(folder, hands=False, sample_frames=None):
    names = [n for n, _ in SOMASkeleton77.bone_order_names_with_parents]
    idx = {n: i for i, n in enumerate(names)}
    edges = [(idx[n], idx[p]) for n, p in SOMASkeleton77.bone_order_names_with_parents if p]
    with np.load(folder / 'motion.npz', allow_pickle=False) as data:
        p = data['posed_joints']
    meta = json.loads((folder / 'meta.json').read_text())
    frames = np.array(sample_frames) if sample_frames else np.linspace(0, len(p)-1, 7).round().astype(int)
    if len(frames) != 7 or (frames < 0).any() or (frames >= len(p)).any():
        raise ValueError('Provide exactly seven valid frame indices')
    width, height = 1540, 1000 if hands else 650
    im = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(im)
    draw.text((8, 4), folder.name + ' | camera follows hips; world height unchanged', fill='black')
    for col, f in enumerate(frames):
        center = p[f, idx['Hips']] * [1, 0, 1]
        q = p[f] - center
        for row, axis in enumerate([0, 2]):
            points = np.stack([110 + col*220 + q[:, axis]*105, 290 + row*300 - q[:, 1]*105], axis=1)
            for a, b in edges:
                color = '#bc3030' if names[a].startswith('Right') else '#285fb0' if names[a].startswith('Left') else '#222222'
                draw.line([tuple(points[a]), tuple(points[b])], fill=color, width=2)
            draw.text((col*220+8, row*300+30), f'frame {f} / {f/meta["fps"]:.2f}s ' + ('front' if row == 0 else 'side'), fill='black')
        if hands:
            # Full hands at a larger scale from above. Thumb is intentionally visible.
            center = (p[f, idx['LeftHand']] + p[f, idx['RightHand']]) / 2
            q = p[f] - center
            points = np.stack([110 + col*220 + q[:, 0]*450, 820 - q[:, 2]*450], axis=1)
            for a, b in edges:
                if 'Hand' not in names[a]:
                    continue
                color = '#bc3030' if names[a].startswith('Right') else '#285fb0'
                draw.line([tuple(points[a]), tuple(points[b])], fill=color, width=3)
            draw.text((col*220+8, 635), 'hands: top view, 450px/m', fill='black')
    output = folder.parent / (folder.name + '_detail.png')
    im.save(output)
    print(json.dumps(dict(name=folder.name, image=str(output),
        root_delta_m=(p[-1,0]-p[0,0]).round(4).tolist(),
        wrist_gap_m=np.linalg.norm(p[frames,idx['LeftHand']]-p[frames,idx['RightHand']],axis=1).round(4).tolist())))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path, nargs='+')
    parser.add_argument('--hands', action='store_true')
    parser.add_argument('--frames', type=int, nargs=7, help='Seven explicit frame indices for a local continuity check')
    args = parser.parse_args()
    for folder in args.folder:
        review(folder, args.hands, args.frames)
