"""Internal Kimodo worker: one JSON request per stdin line, then human/agent review.

Run inside the existing Kimodo environment after freeing the demo's GPU memory:
  python -u kimodo_motion_batch.py --output /tmp/kimodo_review
Request: {"name":"wipe_sweat","text":"A person ...","duration":3,"seed":42}
Use {"name":"wipe_sweat","inspect":true} to refresh review output, or 'quit'.
Only selected <name>/ directories are deliverables. Sheets and metrics are temporary.
This tool never approves a motion, mutates joints, or generates the next job itself.
"""
import argparse
import json
import pathlib
import traceback

import numpy as np
from PIL import Image, ImageDraw


def inspect_motion(folder, names, parents):
    meta = json.loads((folder / 'meta.json').read_text(encoding='utf-8-sig'))
    with np.load(folder / 'motion.npz', allow_pickle=False) as archive:
        data = {key: archive[key] for key in archive.files}
    p = data['posed_joints']
    fps = meta['fps']
    assert p.shape == (round(meta['duration'] * fps), 77, 3), p.shape
    assert data['foot_contacts'].shape == (len(p), 6)
    assert all(np.isfinite(v).all() for v in data.values() if np.issubdtype(v.dtype, np.number))
    index = {n: i for i, n in enumerate(names)}
    edges = [(index[n], index[parent]) for n, parent in parents if parent]
    lengths = np.stack([np.linalg.norm(p[:, a] - p[:, b], axis=1) for a, b in edges])
    times = np.linspace(0, len(p) - 1, 9).round().astype(int)
    metrics = dict(frames=len(p), finite=True,
                   bone_length_range_mm=round(float(np.ptp(lengths, axis=1).max()) * 1000, 3),
                   max_joint_step_m=round(float(np.linalg.norm(np.diff(p, axis=0), axis=2).max()), 3),
                   root_horizontal_range_m=np.ptp(p[:, 0][:, [0, 2]], axis=0).round(3).tolist())
    for hand in ['LeftHand', 'RightHand']:
        metrics[hand + '_head_distance_m'] = np.linalg.norm(p[times, index[hand]] - p[times, index['Head']], axis=1).round(3).tolist()
    metrics['hand_separation_m'] = np.linalg.norm(p[times, index['LeftHand']] - p[times, index['RightHand']], axis=1).round(3).tolist()
    eyes = p[:, index['RightEye']] - p[:, index['LeftEye']]
    head = p[:, index['HeadEnd']] - p[:, index['Head']]
    yaw = np.rad2deg(np.unwrap(np.arctan2(eyes[:, 2], eyes[:, 0])))
    pitch = np.rad2deg(np.unwrap(np.arctan2(head[:, 2], head[:, 1])))
    metrics['head_yaw_range_deg'] = round(float(np.ptp(yaw)), 2)
    metrics['head_pitch_range_deg'] = round(float(np.ptp(pitch)), 2)
    metrics['head_yaw_samples_deg'] = (yaw[times] - yaw[0]).round(1).tolist()
    metrics['head_pitch_samples_deg'] = (pitch[times] - pitch[0]).round(1).tolist()
    image = Image.new('RGB', (1440, 770), 'white')
    draw = ImageDraw.Draw(image)
    draw.text((8, 4), folder.name + ' | ' + meta['text'], fill='black')
    simple = [(a, b) for a, b in edges if not any(x in names[a] for x in ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'])]
    for col, f in enumerate(times):
        q = p[f] - p[0, index['Hips']] * np.array([1, 0, 1])
        for row, horizontal in enumerate([q[:, 0], q[:, 2]]):
            points = np.stack((80 + col * 160 + horizontal * 105, 280 + row * 280 - q[:, 1] * 105), axis=1)
            for a, b in simple:
                color = '#bd3030' if names[a].startswith('Right') else '#285fb0' if names[a].startswith('Left') else '#222222'
                draw.line([tuple(points[a]), tuple(points[b])], fill=color, width=3)
            for n in ['Head', 'LeftHand', 'RightHand']:
                x, y = points[index[n]]
                draw.ellipse((x-3, y-3, x+3, y+3), fill='black')
            draw.text((col * 160 + 6, row * 280 + 28), f'{f/fps:.2f}s ' + ('front' if row == 0 else 'side'), fill='black')
        # Face close-up makes head direction visible without trusting Euler labels.
        centered = p[f] - p[f, index['Head']]
        points = np.stack((80 + col*160 + (centered[:, 0] + .5*centered[:, 2])*300,
                           665 - centered[:, 1]*300), axis=1)
        for a, b in simple:
            if names[a] in ['Neck2', 'Head', 'HeadEnd', 'Jaw', 'LeftEye', 'RightEye']:
                draw.line([tuple(points[a]), tuple(points[b])], fill='#222222', width=2)
        for name, color in [('LeftEye', '#285fb0'), ('RightEye', '#bd3030')]:
            x,y = points[index[name]]
            draw.ellipse((x-3,y-3,x+3,y+3),fill=color)
        draw.text((col*160+6,580), 'head close-up', fill='black')
    image.save(folder.parent / (folder.name + '.png'))
    (folder.parent / (folder.name + '_inspection.json')).write_text(json.dumps(metrics, indent=2))
    return metrics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    from kimodo import load_model
    from kimodo.tools import seed_everything
    from kimodo.exports.motion_io import save_kimodo_npz
    from kimodo.skeleton.definitions import SOMASkeleton77
    # RP internally uses a reduced skeleton but exported posed_joints has 77 joints.
    parents = SOMASkeleton77.bone_order_names_with_parents
    names = [n for n, _ in parents]
    model = load_model('Kimodo-SOMA-RP-v1.1', device='cuda:0')
    print('READY', flush=True)
    while True:
        try:
            line = input()
            if line == 'quit':
                break
            cfg = json.loads(line)
            name = cfg['name']
            if not name or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789_' for c in name):
                raise ValueError('Use a simple lowercase action directory name')
            folder = args.output / name
            if not cfg.get('inspect'):
                duration = float(cfg['duration'])
                if not 2 <= duration <= 10:
                    raise ValueError('Duration must be between 2 and 10 seconds')
                seed_everything(cfg['seed'])
                output = model([cfg['text']], [round(duration * model.fps)],
                               num_denoising_steps=100, num_samples=1, multi_prompt=True,
                               num_transition_frames=5, post_processing=True, return_numpy=True,
                               cfg_type='separated', cfg_weight=[2., 2.], progress_bar=lambda values: values)
                output = {k: v[0] if hasattr(v, 'shape') and v.ndim > 0 and v.shape[0] == 1 else v for k, v in output.items()}
                folder.mkdir(exist_ok=True)
                save_kimodo_npz(str(folder / 'motion.npz'), output)
                cfg.update(model='Kimodo-SOMA-RP-v1.1', text_encoder='matbee/kimodo-llm2vec-nf4',
                           fps=float(model.fps), diffusion_steps=100, post_processing=True,
                           cfg={'enabled': True, 'text_weight': 2., 'constraint_weight': 2.}, num_samples=1)
                (folder / 'meta.json').write_text(json.dumps(cfg, indent=2))
            metrics = inspect_motion(folder, names, parents)
            print('DONE ' + name + ' ' + json.dumps(metrics), flush=True)
        except EOFError:
            break
        except Exception:
            traceback.print_exc()


if __name__ == '__main__':
    main()
