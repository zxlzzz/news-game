"""Internal Kimodo worker: one JSON request per stdin line, then human/agent review.

Run inside the existing Kimodo environment after freeing the demo's GPU memory:
  python -u kimodo_motion_batch.py --output /tmp/kimodo_review
Request: {"name":"wipe_sweat","text":"A person ...","duration":3,"seed":42}
End-effector keys ("effectors": [{"joints": ["RightHand"], "keyframes": [{"frame", "source", "source_frame",
"targets": {"RightHand": [x, y, z]}} or "offset": [x, y, z]]}]) bend the source pose's limb to the target,
rotations included; a position change without matching rotations is undone by Kimodo's correction.
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


# Limb chains of SOMA30 for end-effector keys: (upper joint, middle joint, end joint).
CHAINS = {'RightHand': ('RightArm', 'RightForeArm', 'RightHand'), 'LeftHand': ('LeftArm', 'LeftForeArm', 'LeftHand'),
          'RightFoot': ('RightLeg', 'RightShin', 'RightFoot'), 'LeftFoot': ('LeftLeg', 'LeftShin', 'LeftFoot')}


def rotation_between(a, b):
    """Smallest rotation matrix taking direction a to direction b."""
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    s, c = float(np.linalg.norm(v)), float(np.dot(a, b))
    if s < 1e-9:
        if c > 0:
            return np.eye(3)
        axis = np.cross(a, [1.0, 0.0, 0.0])
        if np.linalg.norm(axis) < 1e-6:
            axis = np.cross(a, [0.0, 1.0, 0.0])
        v, s, c = axis / np.linalg.norm(axis), 0.0, -1.0
        k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
        return np.eye(3) + 2 * k @ k
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]) / s
    angle = np.arctan2(s, c)
    return np.eye(3) + np.sin(angle) * k + (1 - np.cos(angle)) * k @ k


def pose_to_targets(pos, rot, names, parents, targets):
    """A key pose whose positions AND global rotations put each named end joint at its target.
    Kimodo's correction rebuilds a key from its rotations, so moving only the end joint's position does
    nothing (the hand goes back where the rotations put it). Hands and feet: two-bone IK of the limb,
    the knee/elbow keeping its bend side; the subtree below each bone turns with it. Hips: the whole pose moves."""
    pos, rot = pos.copy(), rot.copy()
    index = {n: i for i, n in enumerate(names)}
    children = {i: [j for j, q in enumerate(parents) if q == i] for i in range(len(names))}

    def subtree(i):
        out = [i]
        for j in children[i]:
            out += subtree(j)
        return out

    middles = {chain[1] for chain in CHAINS.values()}
    for joint, target in targets.items():
        target = np.asarray(target, dtype=float)
        if joint in middles:
            continue  # an elbow/knee given with its hand/foot (scripts/figure_targets.py)
        if joint == 'Hips':
            pos += target - pos[index['Hips']]
            continue
        a, b, c = (index[n] for n in CHAINS[joint])
        S, E, W = pos[a].astype(float), pos[b].astype(float), pos[c].astype(float)
        l1, l2 = np.linalg.norm(E - S), np.linalg.norm(W - E)
        if CHAINS[joint][1] in targets:
            E2 = np.asarray(targets[CHAINS[joint][1]], dtype=float)
            W2 = target
        else:
            reach = target - S
            if np.linalg.norm(reach) > l1 + l2:
                print(f'WARNING {joint} target {np.linalg.norm(reach) - l1 - l2:.3f} m beyond the arm/leg', flush=True)
            d = float(np.clip(np.linalg.norm(reach), abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6))
            axis = reach / np.linalg.norm(reach)
            pole = (E - S) - axis * np.dot(E - S, axis)
            if np.linalg.norm(pole) < 1e-8:
                pole = np.cross(axis, [0.0, 1.0, 0.0])
            x = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
            E2 = S + axis * x + pole / np.linalg.norm(pole) * np.sqrt(max(0.0, l1 * l1 - x * x))
            W2 = S + axis * d
        R1 = rotation_between(E - S, E2 - S)
        R2 = rotation_between(R1 @ (W - E), W2 - E2)
        rot[a] = R1 @ rot[a]
        for j in subtree(b):
            p1 = S + R1 @ (pos[j] - S)
            pos[j] = E2 + R2 @ (p1 - E2)
            rot[j] = R2 @ R1 @ rot[j]
    return pos, rot


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
    from kimodo.constraints import (FullBodyConstraintSet, EndEffectorConstraintSet, Root2DConstraintSet,
                                    LeftHandConstraintSet, RightHandConstraintSet,
                                    LeftFootConstraintSet, RightFootConstraintSet)
    import torch
    effector_classes = dict(LeftHand=LeftHandConstraintSet, RightHand=RightHandConstraintSet,
                            LeftFoot=LeftFootConstraintSet, RightFoot=RightFootConstraintSet)
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
                # Kimodo is trained on 2-10 s; shorter takes are only for short, fully keyed gestures.
                if not 1 <= duration <= 10:
                    raise ValueError('Duration must be between 1 and 10 seconds')
                seed_everything(cfg['seed'])
                frames = round(duration * model.fps)
                constraints = []
                constraint_targets = []
                if cfg.get('root_path'):
                    path = cfg['root_path']
                    path_frames = [key['frame'] for key in path]
                    positions_xz = [key['position_xz'] for key in path]
                    if len(set(path_frames)) != len(path_frames) or not all(0 <= f < frames for f in path_frames):
                        raise ValueError('Root path frames must be unique and inside the clip')
                    heading = [key['heading'] for key in path] if all('heading' in key for key in path) else None
                    constraints.append(Root2DConstraintSet(model.skeleton,
                        torch.tensor(path_frames), torch.tensor(positions_xz, device=model.device),
                        global_root_heading=None if heading is None else torch.tensor(heading, device=model.device)))
                    constraint_targets.append(dict(type='root2d', frames=path_frames, positions_xz=positions_xz, heading=heading))
                if cfg.get('keyframes'):
                    subset = model.skeleton.get_skel_slice(model.skeleton.somaskel77)
                    target_positions, target_rotations, target_frames = [], [], []
                    for keyframe in cfg['keyframes']:
                        with np.load(keyframe['source'], allow_pickle=False) as reference:
                            source_frame = keyframe.get('source_frame', 0)
                            positions = reference['posed_joints'][source_frame, subset].copy()
                            rotations = reference['global_rot_mats'][source_frame, subset].copy()
                        positions += np.asarray(keyframe.get('translation', [0, 0, 0]), dtype=positions.dtype)
                        if keyframe.get('targets'):
                            # e.g. {"Hips": lower, "LeftFoot": where it was, "RightFoot": ...}: a seated pose sunk onto a
                            # lower seat with the feet kept on the floor (pose_to_targets, applied in order).
                            names30 = list(model.skeleton.bone_order_names)
                            parents30 = [int(q) for q in model.skeleton.joint_parents.cpu().numpy()]
                            positions, rotations = pose_to_targets(positions, rotations, names30, parents30,
                                {j: np.asarray(t, dtype=float) for j, t in keyframe['targets'].items()})
                            positions, rotations = positions.astype(np.float32), rotations.astype(np.float32)
                        frame = keyframe['frame']
                        frame = frames + frame if frame < 0 else frame
                        if not 0 <= frame < frames:
                            raise ValueError('Constraint frame outside output clip')
                        target_frames.append(frame)
                        target_positions.append(positions)
                        target_rotations.append(rotations)
                    if len(set(target_frames)) != len(target_frames):
                        raise ValueError('Duplicate full-body keyframes')
                    ordered = sorted(target_frames)
                    if len(ordered) / frames > 0.2:
                        raise ValueError('Full-body constraints exceed 20% of generated frames')
                    if any(b - a < 5 for a, b in zip(ordered, ordered[1:])):
                        raise ValueError('Full-body constraints must be at least 5 frames apart')
                    if any(sum(start <= frame <= start + model.fps for frame in ordered) > 3 for start in ordered):
                        raise ValueError('At most 3 semantic full-body keys are allowed in any continuous second')
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
                # End-effector keys. Every key of one frame becomes ONE pose (the first key's source frame, bent to
                # all targets of that frame): each constraint set also fixes the root and heading of its frames, so
                # two keys of one frame taken from different poses contradict each other and one is dropped.
                names30 = list(model.skeleton.bone_order_names)
                parents30 = [int(q) for q in model.skeleton.joint_parents.cpu().numpy()]
                subset = model.skeleton.get_skel_slice(model.skeleton.somaskel77)
                slots = {}
                for effector in cfg.get('effectors', []):
                    if effector.get('guide_joints'):
                        raise ValueError('Elbow guides are not supported by final motion correction')
                    for joint in effector['joints']:
                        if joint not in effector_classes and joint != 'Hips':
                            raise ValueError(f'Unsupported end-effector {joint}')
                    for key in effector['keyframes']:
                        frame = frames + key['frame'] if key['frame'] < 0 else key['frame']
                        if not 0 <= frame < frames:
                            raise ValueError('Effector key outside the output clip')
                        slot = slots.setdefault(frame, {'source': key['source'], 'source_frame': key.get('source_frame', 0),
                                                        'targets': {}, 'offsets': {}, 'joints': []})
                        for j, t in key.get('targets', {}).items():
                            slot['targets'][j] = np.asarray(t, dtype=float)
                        if 'offset' in key:
                            for joint in effector['joints']:
                                slot['offsets'][joint] = np.asarray(key['offset'], dtype=float)
                        slot['joints'] += [j for j in effector['joints'] if j not in slot['joints']]
                per_joint = {}
                for frame in sorted(slots):
                    slot = slots[frame]
                    with np.load(slot['source'], allow_pickle=False) as reference:
                        pos = reference['posed_joints'][slot['source_frame'], subset].copy()
                        rot = reference['global_rot_mats'][slot['source_frame'], subset].copy()
                    targets = dict(slot['targets'])
                    for joint, offset in slot['offsets'].items():
                        targets[joint] = pos[names30.index(joint)] + offset
                    pos, rot = pose_to_targets(pos, rot, names30, parents30, targets)
                    for joint in slot['joints']:
                        entry = per_joint.setdefault(joint, ([], [], []))
                        entry[0].append(frame)
                        entry[1].append(pos.astype(np.float32))
                        entry[2].append(rot.astype(np.float32))
                for joint, (indices, positions, rotations) in per_joint.items():
                    # Kimodo's correction masks dispatch on left-hand/right-foot/etc.; the generic
                    # "end-effector" class conditions diffusion but is ignored by correction.
                    arguments = (model.skeleton, torch.tensor(indices),
                        torch.tensor(np.stack(positions), device=model.device),
                        torch.tensor(np.stack(rotations), device=model.device), None)
                    if joint in effector_classes:
                        constraints.append(effector_classes[joint](*arguments))
                    else:
                        constraints.append(EndEffectorConstraintSet(*arguments, joint_names=[joint]))
                    constraint_targets.append(dict(type='end-effector', frames=indices, joints=[joint],
                        correction_masks=[effector_classes[joint].name] if joint in effector_classes else [],
                        skeleton='SOMA30', positions=np.stack(positions).tolist(), rotations=np.stack(rotations).tolist()))
                # Scene guidance (the fork's kimodo/scene_guidance.py): keep the stick figure out of object boxes.
                model.scene_guidance = None
                if cfg.get('scene'):
                    from kimodo.scene_guidance import SceneGuidance
                    scene = dict(cfg['scene'])
                    for key in ('boxes', 'item_boxes'):
                        if isinstance(scene.get(key), str):
                            scene[key] = json.loads(pathlib.Path(scene[key]).read_text())['boxes']
                    if scene.get('item_boxes'):
                        scene['item'] = {'boxes': scene.pop('item_boxes'), 'hand': scene.pop('item_hand', 'both')}
                    scene['rest_names'] = names
                    model.scene_guidance = SceneGuidance(scene, model)
                output = model([cfg['text']], [frames],
                               num_denoising_steps=100, num_samples=1, multi_prompt=True,
                               constraint_lst=constraints,
                               num_transition_frames=5, post_processing=cfg.get('post_processing', True), return_numpy=True,
                               cfg_type='separated', cfg_weight=[2., 2.], progress_bar=lambda values: values)
                output = {k: v[0] if hasattr(v, 'shape') and v.ndim > 0 and v.shape[0] == 1 else v for k, v in output.items()}
                folder.mkdir(exist_ok=True)
                save_kimodo_npz(str(folder / 'motion.npz'), output)
                cfg.update(model='Kimodo-SOMA-RP-v1.1', text_encoder='matbee/kimodo-llm2vec-nf4',
                           fps=float(model.fps), diffusion_steps=100, post_processing=cfg.get('post_processing', True),
                           cfg={'enabled': True, 'text_weight': 2., 'constraint_weight': 2.}, num_samples=1)
                if cfg.get('endpoints'):
                    error = np.linalg.norm(output['posed_joints'][[0,-1]] - endpoint_pose['posed_joints'][0], axis=-1)
                    cfg.update(endpoint_target='stand_idle/motion.npz frame 0', constraint_frames=[0,frames-1],
                               endpoint_mean_error_m=error.mean(axis=1).tolist())
                if constraint_targets:
                    cfg['constraint_targets'] = constraint_targets
                    errors = []
                    for target in constraint_targets:
                        if target['type'] == 'root2d':
                            continue
                        selected = [model.skeleton.bone_index[n] for n in target['joints']] if target['type']=='end-effector' else list(range(len(subset)))
                        error = np.linalg.norm(output['posed_joints'][target['frames']][:,subset][:,selected]
                                               - np.asarray(target['positions'])[:,selected], axis=-1)
                        errors.append(dict(type=target['type'], frames=target['frames'], mean_error_m=error.mean(axis=1).tolist()))
                    cfg['keyframe_errors'] = errors
                if model.scene_guidance is not None:
                    log = model.scene_guidance.log
                    cfg['scene_guidance'] = dict(steps=len(log), first_penetration=log[0][1] if log else None,
                                                 last=[round(v, 6) for v in log[-1][1:]] if log else None)
                    model.scene_guidance = None
                (folder / 'meta.json').write_text(json.dumps(cfg, indent=2))
            metrics = inspect_motion(folder, names, parents)
            print('DONE ' + name + ' ' + json.dumps(metrics), flush=True)
        except EOFError:
            break
        except Exception:
            traceback.print_exc()


if __name__ == '__main__':
    main()
