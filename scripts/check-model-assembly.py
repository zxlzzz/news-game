"""Inspect GLB part placement; separated bounding boxes are review candidates.

Bounds cannot establish surface contact for curved parts. Use visual inspection
and triangle clearance checks before accepting or changing a candidate.
"""
import argparse
import fnmatch
import importlib.util
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('model_check', ROOT/'godot/modeling/check_model.py')
model_check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model_check)
CONTACT_TOLERANCE = 0.005


def parts(path):
    doc, binary = model_check.read_glb(path)
    result = []

    def walk(index, parent):
        node = doc['nodes'][index]
        world = parent @ np.array(model_check.node_matrix(node)).reshape(4, 4, order='F')
        if 'mesh' in node:
            points = []
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                v = np.array(model_check.accessor(doc, binary, primitive['attributes']['POSITION']))
                points.append(v @ world[:3, :3].T + world[:3, 3])
            points = np.concatenate(points)
            result.append({'name': node['name'], 'min': points.min(0), 'max': points.max(0)})
        for child in node.get('children', []):
            walk(child, world)

    for index in doc['scenes'][doc.get('scene', 0)]['nodes']:
        walk(index, np.eye(4))
    return result


def scan(path):
    p = parts(path)
    lo = np.array([r['min'] for r in p])
    hi = np.array([r['max'] for r in p])
    gaps = np.maximum(np.maximum(lo[:, None] - hi[None, :], lo[None, :] - hi[:, None]), 0)
    distances = np.linalg.norm(gaps, axis=2)
    connected = distances <= CONTACT_TOLERANCE + 1e-7
    remaining = set(range(len(p)))
    groups = []
    while remaining:
        group = {min(remaining)}
        frontier = group.copy()
        while frontier:
            neighbours = set(np.flatnonzero(connected[list(frontier)].any(axis=0))) & remaining
            frontier = neighbours - group
            group |= neighbours
        remaining -= group
        groups.append(sorted(group))
    groups.sort(key=lambda g: (-len(g), g))
    isolated = []
    for group in groups[1:]:
        outside = sorted(set(range(len(p))) - set(group))
        i, j = np.unravel_index(np.argmin(distances[np.ix_(group, outside)]), (len(group), len(outside)))
        isolated.append({'parts': [p[i]['name'] for i in group],
                         'gap_mm': round(float(distances[group[i], outside[j]])*1000, 2),
                         'nearest': [p[group[i]]['name'], p[outside[j]]['name']]})
    return {'name': path.stem, 'parts': len(p), 'bounds_groups': len(groups),
            'groups_min_y': [round(float(lo[g, 1].min()), 7) for g in groups], 'separated': isolated}


def check_rules(rules, scans):
    results=[]
    for name, rule in rules.items():
        p=parts(ROOT/f'godot/models/{name}.glb')
        scan_=next(s for s in scans if s['name']==name)
        failures=[]
        if scan_['bounds_groups']!=rule['groups']:
            failures.append('Unexpected separated component group')
        if rule.get('grounded_groups') and max(scan_['groups_min_y'])>.001:
            failures.append('Independent assembly is not grounded')

        def bounds(patterns):
            if isinstance(patterns,str):patterns=[patterns]
            chosen=[q for q in p if any(fnmatch.fnmatchcase(q['name'],pattern) for pattern in patterns)]
            assert chosen,(name,'Missing assembly part',patterns)
            return np.array([q['min'] for q in chosen]).min(0),np.array([q['max'] for q in chosen]).max(0)

        for condition in rule.get('conditions',[]):
            a,b=bounds(condition['a']),bounds(condition['b']);axis=condition['axis'];kind=condition['kind']
            if kind in ['face_contact','gap_at_least']:
                gap=b[0][axis]-a[1][axis]
                passed=abs(gap)<.001 if kind=='face_contact' else gap>=condition['min']-.001
            elif kind=='center_align':
                gap=(sum(b)/2-sum(a)/2)[axis]
                passed=abs(gap)<=condition.get('tolerance',.001)
            elif kind=='width_ratio':
                gap=(a[1]-a[0])[axis]/(b[1]-b[0])[axis]
                passed=abs(gap-condition['ratio'])<.001
            else:raise ValueError(kind)
            if not passed:failures.append(dict(condition=condition,measured=float(gap)))
        results.append(dict(name=name,conditions=len(rule.get('conditions',[]))+1,failures=failures))
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--names', nargs='*')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--check',action='store_true',help='Require the reviewed assembly rules')
    args = parser.parse_args()
    paths = [ROOT/f'godot/models/{n}.glb' for n in args.names] if args.names else sorted((ROOT/'godot/models').glob('*.glb'))
    result = {'tolerance_mm': CONTACT_TOLERANCE*1000,
              'interpretation': 'Separated bounds are candidates, not automatic defects; overlapping bounds do not prove attachment.',
              'models': [scan(path) for path in paths]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    if args.check:
        rules=json.loads((ROOT/'godot/modeling/model-assembly-rules.json').read_text())
        result['checks']=check_rules(rules,result['models'])
        args.output.write_text(json.dumps(result,indent=2),encoding='utf-8')
        failures=[r for r in result['checks'] if r['failures']]
        assert not failures,json.dumps(failures,indent=2)
        print('MODEL_ASSEMBLY_OK',len(rules),'models;',sum(r['conditions'] for r in result['checks']),'constraints')
    print('ASSEMBLY_SCAN', len(result['models']))


if __name__ == '__main__':
    main()
