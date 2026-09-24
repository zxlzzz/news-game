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
    parser.add_argument('--endpoint-pose', type=pathlib.Path, help='Optional source NPZ frame 0 for endpoint requests')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    from kimodo import load_model
    from kimodo.tools import seed_everything
    from kimodo.exports.motion_io import save_kimodo_npz
    from kimodo.skeleton.definitions import SOMASkeleton77
    from kimodo.constraints import FullBodyConstraintSet, EndEffectorConstraintSet
    import torch
    # RP internally uses a reduced skeleton but exported posed_joints has 77 joints.
    parents = SOMASkeleton77.bone_order_names_with_parents
    names = [n for n, _ in parents]
    model = load_model('Kimodo-SOMA-RP-v1.1', device='cuda:0')
    endpoint_pose = dict(np.load(args.endpoint_pose)) if args.endpoint_pose else None
    print('READY', flush=True)
    while True:
        try:
            line = input().strip()
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
                frames = round(duration * model.fps)
                constraints = []
                constraint_targets = []
                if cfg.get('keyframes'):
                    subset = model.skeleton.get_skel_slice(model.skeleton.somaskel77)
                    target_positions, target_rotations, target_frames = [], [], []
                    for keyframe in cfg['keyframes']:
                        with np.load(keyframe['source'], allow_pickle=False) as reference:
                            source_frame = keyframe.get('source_frame', 0)
                            positions = reference['posed_joints'][source_frame, subset].copy()
                            rotations = reference['global_rot_mats'][source_frame, subset].copy()
                        positions += np.asarray(keyframe.get('translation', [0, 0, 0]), dtype=positions.dtype)
                        frame = keyframe['frame']
                        frame = frames + frame if frame < 0 else frame
                        if not 0 <= frame < frames:
                            raise ValueError('Constraint frame outside output clip')
                        target_frames.append(frame)
                        target_positions.append(positions)
                        target_rotations.append(rotations)
                    if len(set(target_frames)) != len(target_frames):
                        raise ValueError('Duplicate full-body keyframes')
                    constraints.append(FullBodyConstraintSet(model.skeleton,
                        torch.tensor(target_frames),
                        torch.tensor(np.stack(target_positions), device=model.device),
                        torch.tensor(np.stack(target_rotations), device=model.device)))
                    constraint_targets.append(dict(type='fullbody', frames=target_frames,
                        skeleton='SOMA30', positions=np.stack(target_positions).tolist(),
                        rotations=np.stack(target_rotations).tolist()))
                if cfg.get('endpoints'):
                    if constraints:
                        raise ValueError('Use either keyframes or legacy endpoints, not both')
                    if endpoint_pose is None:
                        raise ValueError('Endpoint request requires --endpoint-pose')
                    subset = model.skeleton.get_skel_slice(model.skeleton.somaskel77)
                    constraints = [FullBodyConstraintSet(model.skeleton, torch.tensor([0, frames-1]),
                        torch.tensor(endpoint_pose['posed_joints'][[0,0]], device=model.device)[:,subset],
                        torch.tensor(endpoint_pose['global_rot_mats'][[0,0]], device=model.device)[:,subset])]
                for effector in cfg.get('effectors', []):
                    subset = model.skeleton.get_skel_slice(model.skeleton.somaskel77)
                    positions, rotations, indices = [], [], []
                    for key in effector['keyframes']:
                        with np.load(key['source'], allow_pickle=False) as reference:
                            sf = key.get('source_frame', 0)
                            pos = reference['posed_joints'][sf, subset].copy()
                            rot = reference['global_rot_mats'][sf, subset].copy()
                        for joint in effector['joints']:
                            pos[model.skeleton.bone_index[joint]] += np.asarray(key.get('offset', [0,0,0]), dtype=pos.dtype)
                        positions.append(pos); rotations.append(rot); indices.append(key['frame'])
                    constraints.append(EndEffectorConstraintSet(model.skeleton,
                        torch.tensor(indices), torch.tensor(np.stack(positions), device=model.device),
                        torch.tensor(np.stack(rotations), device=model.device), None, joint_names=effector['joints']))
                    constraint_targets.append(dict(type='end-effector', frames=indices, joints=effector['joints'],
                        skeleton='SOMA30', positions=np.stack(positions).tolist(), rotations=np.stack(rotations).tolist()))
                output = model([cfg['text']], [frames],
                               num_denoising_steps=100, num_samples=1, multi_prompt=True,
                               constraint_lst=constraints,
                               num_transition_frames=5, post_processing=True, return_numpy=True,
                               cfg_type='separated', cfg_weight=[2., 2.], progress_bar=lambda values: values)
                output = {k: v[0] if hasattr(v, 'shape') and v.ndim > 0 and v.shape[0] == 1 else v for k, v in output.items()}
                folder.mkdir(exist_ok=True)
                save_kimodo_npz(str(folder / 'motion.npz'), output)
                cfg.update(model='Kimodo-SOMA-RP-v1.1', text_encoder='matbee/kimodo-llm2vec-nf4',
                           fps=float(model.fps), diffusion_steps=100, post_processing=True,
                           cfg={'enabled': True, 'text_weight': 2., 'constraint_weight': 2.}, num_samples=1)
                if cfg.get('endpoints'):
                    error = np.linalg.norm(output['posed_joints'][[0,-1]] - endpoint_pose['posed_joints'][0], axis=-1)
                    cfg.update(endpoint_target='stand_idle/motion.npz frame 0', constraint_frames=[0,frames-1],
                               endpoint_mean_error_m=error.mean(axis=1).tolist())
                if constraint_targets:
                    cfg['constraint_targets'] = constraint_targets
                    errors = []
                    for target in constraint_targets:
                        selected = [model.skeleton.bone_index[n] for n in target['joints']] if target['type']=='end-effector' else list(range(len(subset)))
                        error = np.linalg.norm(output['posed_joints'][target['frames']][:,subset][:,selected]
                                               - np.asarray(target['positions'])[:,selected], axis=-1)
                        errors.append(dict(type=target['type'], frames=target['frames'], mean_error_m=error.mean(axis=1).tolist()))
                    cfg['keyframe_errors'] = errors
                (folder / 'meta.json').write_text(json.dumps(cfg, indent=2))
            metrics = inspect_motion(folder, names, parents)
            print('DONE ' + name + ' ' + json.dumps(metrics), flush=True)
        except EOFError:
            break
        except Exception:
            traceback.print_exc()


if __name__ == '__main__':
    main()
