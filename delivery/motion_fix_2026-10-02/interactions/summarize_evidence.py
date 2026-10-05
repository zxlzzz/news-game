"""Summarize current, actual contact evidence and full77 repaired source consistency.

Run check_motion_prop_fixes.gd first. A numerical match is not visual acceptance.
"""
import json
from pathlib import Path

import numpy as np
from source_probe import fk, metrics
from recover_sources import IDS, load, unit

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]


def main():
    data = json.loads((HERE/'prop_contact_evidence.json').read_text())
    summary = {}
    for name, rows in data.items():
        active = {}
        for row in rows:
            for person in row['people']:
                for hand, track in person['hands'].items():
                    if track['weight'] >= .999:
                        key = person['clip']+'.'+hand
                        if key not in active or track['error_m'] > active[key]['max_contact_residual_m']:
                            active[key] = {'max_contact_residual_m': track['error_m'], 'phase': row['phase']}
        tests = {'chess_move': [('held_chess_piece', .32), ('held_chess_piece', .65)],
                 'take_back_piece': [('held_chess_piece', .32), ('held_chess_piece', .65)],
                 'fruit_weigh': [('held_fruit', .60)], 'distribute_flyer': [('held_flyer', .55)],
                 'hang_laundry': [('held_laundry_shirt', .62)]}
        seams = {}
        for prop, boundary in tests.get(name, []):
            near = [row for row in rows if abs(row['phase']-boundary)<.000003]
            positions = [[p['origin'] for p in row['props'] if p['type']==prop][0] for row in near]
            seams[str(boundary)] = {'range_m': float(np.linalg.norm(np.max(positions, axis=0)-np.min(positions, axis=0))),
                                    'positions': positions, 'phases': [row['phase'] for row in near]}
        if name=='photo_overhead':
            active['actual_marker_gap_m'] = {
                hand: max(float(np.linalg.norm(np.asarray(row['people'][0][hand])-row['people'][0]['item_markers'][marker])) for row in rows)
                for hand, marker in [('handLeft', 'grip_left'), ('handRight', 'grip_right')]}
        if name=='distribute_flyer':
            row = min(rows, key=lambda r: abs(r['phase']-.55))
            paper = np.asarray([p['origin'] for p in row['props'] if p['type']=='held_flyer'][0])
            active['handoff_grip_offsets_from_paper_center_m'] = {
                p['clip']: (np.asarray(p['handLeft' if p['clip']==name else 'handRight'])-paper).tolist() for p in row['people']}
        summary[name] = {'active_contacts': active, 'ownership_seams': seams}
    (HERE/'prop_contact_summary.json').write_text(json.dumps(summary, indent=2))

    skel = json.loads((HERE/'source_probe.json').read_text())['skeleton']
    names, parents, neutral = skel['names'], skel['parents'], np.asarray(skel['neutral'])
    source = {}
    for name in IDS:
        old = load(HERE/'before'/name/'motion.npz')
        new = load(REPO/'assets/animations/npz'/name/'motion.npz')
        meta = json.loads((REPO/'assets/animations/npz'/name/'meta.json').read_text())
        archive = load(REPO/meta['repair']['archived_rotation_source'])
        result = {'archived_modified_input': metrics(archive, names, parents, neutral),
                  'original_generated': metrics(old, names, parents, neutral),
                  'repaired': metrics(new, names, parents, neutral),
                  'frame_count': len(new['posed_joints']),
                  'archive_contact_heading_root_preserved': {key: bool(np.array_equal(archive[key], new[key])) for key in ['foot_contacts','global_root_heading','root_positions','smooth_root_pos']}}
        if meta.get('loop'):
            q = new['posed_joints']-new['posed_joints'][:, :1]
            result['loop_hip_relative_pose_seam_m'] = float(np.linalg.norm(q[-1]-q[0], axis=1).max())
        if name=='elder_assisted_walk':
            result['native_left_elbow_neck_relative_steps_m'] = {}
            for frame in [12, 43]:
                pair = {}
                for label, z in [('before',old),('after',new)]:
                    p = z['posed_joints']; relative = p[:,names.index('LeftForeArm')]-p[:,names.index('Neck1')]
                    pair[label] = float(np.linalg.norm(relative[frame+1]-relative[frame]))
                result['native_left_elbow_neck_relative_steps_m'][str(frame)] = pair
        if name=='phone_urgent':
            positions = new['posed_joints']
            offsets = []
            for q in positions:
                head_up = unit(q[names.index('HeadEnd')]-q[names.index('Head')])
                head_left = unit(q[names.index('LeftEye')]-q[names.index('RightEye')])
                head_forward = unit(np.cross(head_left,head_up))
                palm = q[names.index('RightHand')]+.09*unit(q[names.index('RightHand')]-q[names.index('RightForeArm')])
                center = (q[names.index('Head')]+q[names.index('HeadEnd')])/2
                offsets.append(np.column_stack((head_left,head_up,head_forward)).T@(palm-center))
            result['full_segment_head_local_palm_offset_range_m'] = [np.min(offsets,axis=0).tolist(),np.max(offsets,axis=0).tolist()]
        source[name] = result
    (HERE/'source_final_evidence.json').write_text(json.dumps(source,indent=2))
    for name, result in summary.items(): print(name, result)
    for name, result in source.items(): print(name, 'full77 FK', result['repaired']['fk_position_max_error_m'])


if __name__=='__main__':
    main()
