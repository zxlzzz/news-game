"""Summarize existing final checks; never launches or changes the simulation."""
from pathlib import Path
import hashlib
import json
import math

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def main():
    batch = read(HERE / 'interruptions_final.json')
    assert batch['inputs_before'] == batch['inputs_after']
    for path, digest in batch['inputs_after'].items():
        assert hashlib.sha256((ROOT / 'godot' / path.removeprefix('res://')).read_bytes()).hexdigest() == digest
    cases = batch['cases']
    result = {'inputs': batch['inputs_after'], 'interruptions': {
        'cases': len(cases), 'failures': batch['failures'],
        'mesh_penetration_max_m': max(c['mesh_penetration_m'] for c in cases),
        'leg_length_error_max_m': max(c['leg_length_error_m'] for c in cases),
        'skin_sole_error_max_m': max(c['sole_contact_error']['metres'] for c in cases),
        'recovery_seconds_range': [min(c['recovery_seconds'] for c in cases), max(c['recovery_seconds'] for c in cases)]}}
    for field, metric in [('worst_joint', 'speed'), ('worst_rotation', 'radians_per_frame')]:
        top = sorted(cases, key=lambda c: c[field][metric], reverse=True)[:12]
        result['interruptions']['top_' + field] = [
            {key: c[key] for key in ['breed', 'action', 'clip', 'stage', 'fraction', 'fps', 'urgent_zero_speed', field]}
            for c in top]
        if field == 'worst_rotation':
            for c in result['interruptions']['top_' + field]:
                c[field]['degrees_per_frame'] = math.degrees(c[field][metric])
    result['independent_raw_glb'] = {}
    for folder in ['final_low_pose', 'final_scratch']:
        validation = read(HERE / folder / 'validation.json')
        assert validation['completed'] and validation['exit_code'] == 0 and not validation['failures']
        assert all(batch['inputs_after'][path] == digest for path, digest in validation['inputs'].items())
        verification = read(HERE / folder / 'verification.json')
        summaries = [s for breed in verification.values() for s in breed['scenarios'].values()]
        foot_values = [f for s in summaries for f in s['feet'].values()]
        runtime = read(HERE / folder / 'runtime.json')
        recovery_states = [s for b in runtime['breeds'].values() for c in b['scenarios'] for s in c['states'] if s['phase'] == 'return']
        result['independent_raw_glb'][folder] = {
            'inputs': validation['inputs'], 'scenarios': validation['scenarios'], 'frames': validation['frames'], 'failures': validation['failures'],
            'mesh_floor_min_m': min(s['mesh_floor_min_m'] for s in summaries),
            'leg_length_change_max_m': max(s['worst_leg_length_change_m'] for s in summaries),
            'planted_skin_sole_error_max_m': max(f['planted_sole_target_max_error_m'] or 0 for f in foot_values),
            'free_skin_sole_error_max_m': max(f['free_skin_sole_max_error_m'] or 0 for f in foot_values),
            'free_rigid_anchor_error_max_m': max(f['free_anchor_max_error_m'] or 0 for f in foot_values),
            'inertia_projection': {'recovery_frames': len(recovery_states),
                'projected_frames': sum(s['inertia_weight'] < 1 for s in recovery_states),
                'minimum_inertia_weight': min((s['inertia_weight'] for s in recovery_states), default=1),
                'maximum_feasibility_evaluations': max((s['projection_evaluations'] for s in recovery_states), default=0)},
            'matrix_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((HERE / folder).glob('*.f32'))}}
    result['production_fullmesh_checks'] = {}
    for name, marker in [('check_animals_final.log', 'ANIMALS_OK'), ('check_locomotion_final.log', 'LOCOMOTION_OK')]:
        contents = (HERE / name).read_text(encoding='utf-8', errors='replace')
        assert marker in contents
        result['production_fullmesh_checks'][name] = {'marker': marker,
            'sha256': hashlib.sha256((HERE / name).read_bytes()).hexdigest()}
    (HERE / 'runtime_final_summary.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('FINAL_SUMMARY', len(cases), 'interruptions;', sum(v['scenarios'] for v in result['independent_raw_glb'].values()),
          'independent trajectories;', sum(v['frames'] for v in result['independent_raw_glb'].values()), 'frames')
    print('top speeds', [(c['breed'], c['action'], c['worst_joint']) for c in result['interruptions']['top_worst_joint'][:6]])
    print('top turns', [(c['breed'], c['action'], c['worst_rotation']) for c in result['interruptions']['top_worst_rotation'][:6]])


if __name__ == '__main__':
    main()
