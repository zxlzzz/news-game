"""Actual support tests plus explicitly unconfirmed AABB intersection candidates."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def cells(bounds, grid=10.0):
    a, b = bounds['min'], bounds['max']
    for x in range(math.floor(a[0] / grid), math.floor(b[0] / grid) + 1):
        for z in range(math.floor(a[2] / grid), math.floor(b[2] / grid) + 1):
            yield x, z


def bounds_of_points(points):
    return {'min': [min(p[k] for p in points) for k in range(3)],
            'max': [max(p[k] for p in points) for k in range(3)]}


def overlap(a, b, epsilon=0.02):
    extent = [min(a['max'][k], b['max'][k]) - max(a['min'][k], b['min'][k])
              for k in range(3)]
    return extent if min(extent) > epsilon else None


def height_on_triangle(x, z, tri):
    a, b, c = tri['a'], tri['b'], tri['c']
    den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
    if abs(den) < 1e-12:
        return None
    u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den
    w = 1.0 - u - v
    if min(u, v, w) < -1e-7:
        return None
    return u * a[1] + v * b[1] + w * c[1]


def analyze(raw, tolerance):
    floor_grid = defaultdict(list)
    for i, tri in enumerate(raw['floor_triangles']):
        for cell in cells(bounds_of_points([tri['a'], tri['b'], tri['c']])):
            floor_grid[cell].append(i)
    foot_records, failures = [], []
    sampled = 0
    max_gap = 0.0
    for obj in raw['instances']:
        # Roads are the independently exported floor; their joining geometry is
        # deliberately zero-thickness and they are not items resting on a floor.
        if 'road_module' in obj['groups']:
            continue
        foot_failures, supports = [], Counter()
        local_max = 0.0
        for original in obj['lowest_vertices']:
            p = list(original)
            p[1] -= obj['native_planar_marking_lift']
            sampled += 1
            options = []
            for i in floor_grid[(math.floor(p[0] / 10), math.floor(p[2] / 10))]:
                tri = raw['floor_triangles'][i]
                if tri['owner'] == obj['owner']:
                    continue
                y = height_on_triangle(p[0], p[2], tri)
                if y is not None and abs(y - p[1]) <= 0.5:
                    options.append((y, tri['owner'], i))
            if not options:
                foot_failures.append({'point': p, 'fault': 'no_independent_paving_within_0.5m'})
                continue
            y, owner, i = max(options)
            gap = p[1] - y
            supports[owner] += 1
            local_max = max(local_max, abs(gap))
            max_gap = max(max_gap, abs(gap))
            if abs(gap) > tolerance:
                foot_failures.append({'point': p, 'floor_y': y, 'gap': gap,
                                      'floor_owner': owner, 'triangle': i,
                                      'fault': 'floating' if gap > 0 else 'buried'})
        rec = {'owner': obj['owner'], 'type': obj['type'],
               'sampled_vertices': len(obj['lowest_vertices']),
               'native_planar_marking_lift': obj['native_planar_marking_lift'],
               'support_owners': dict(supports), 'max_absolute_gap': local_max,
               'failures': foot_failures}
        foot_records.append(rec)
        if foot_failures:
            failures.append(rec)
    candidates = []
    solid = [o for o in raw['instances'] if 'road_module' not in o['groups']
             and 'marking' not in o['groups']]
    grid, seen = defaultdict(list), set()
    for i, obj in enumerate(solid):
        for cell in cells(obj['bounds']):
            grid[cell].append(i)
    for indexes in grid.values():
        for pos, i in enumerate(indexes):
            for j in indexes[pos + 1:]:
                key = min(i, j), max(i, j)
                if key in seen:
                    continue
                seen.add(key)
                a, b = solid[i], solid[j]
                whole = overlap(a['bounds'], b['bounds'])
                if whole is None:
                    continue
                parts = []
                for ca in a['components']:
                    for cb in b['components']:
                        ext = overlap(ca['bounds'], cb['bounds'])
                        if ext is not None:
                            parts.append({'a': ca['path'], 'b': cb['path'], 'overlap_extent': ext})
                candidates.append({'a': a['owner'], 'b': b['owner'], 'types': [a['type'], b['type']],
                                   'whole_aabb_overlap_extent': whole,
                                   'component_aabb_candidates': parts,
                                   'confirmed_mesh_intersection': None})
    runtime = raw['runtime']
    runtime_ok = (raw['declared_spawn_population'] is False
                  and runtime['spawn_population'] is False
                  and not runtime['forbidden_population_nodes']
                  and runtime['camera_current_present']
                  and any(c['current'] and c['params_initialized'] for c in runtime['cameras'])
                  and runtime['counts']['shader_material_surfaces'] > 0
                  and runtime['counts']['world_environments'] > 0)
    return {'support_status': 'PASS' if not failures else 'FAIL',
            'runtime_status': 'PASS' if runtime_ok else 'FAIL',
            'type_instance_count': len(raw['instances']),
            'type_counts': dict(sorted(Counter(o['type'] for o in raw['instances']).items())),
            'ground_strip_count': len(raw['ground_strips']),
            'upward_paving_triangle_count': len(raw['floor_triangles']),
            'support_tolerance_metres': tolerance,
            'sampled_lowest_vertex_count': sampled, 'grounded_instances_checked': len(foot_records),
            'maximum_absolute_support_gap': max_gap, 'support_failures': failures,
            'support_records': foot_records,
            'whole_aabb_candidate_count': len(candidates),
            'pairs_with_component_aabb_candidates': sum(bool(c['component_aabb_candidates']) for c in candidates),
            'intersection_candidates': candidates, 'runtime': runtime,
            'limitations': raw['limitations'] + [
                'No visual or style quality verdict is inferred from headless initialization.',
                'No road connection/navigation proof is included; roads are measured only as support geometry.',
                'Contacts with non-paving props, stacked items or wall-mounted items need separate interpretation.']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('export', type=Path)
    parser.add_argument('report', type=Path)
    parser.add_argument('--tolerance', type=float, default=0.005)
    args = parser.parse_args()
    raw = json.loads(args.export.read_text(encoding='utf-8'))
    result = analyze(raw, args.tolerance)
    changed = []
    for name, dep in raw['dependencies'].items():
        if digest(dep['absolute_path']) != dep['sha256']:
            changed.append(name)
    result.update({'created_utc': datetime.now(timezone.utc).isoformat(),
                   'scene': raw['scene'], 'export_absolute_path': str(args.export.resolve()),
                   'export_sha256': digest(args.export), 'dependencies': raw['dependencies'],
                   'dependencies_changed_since_export': changed,
                   'overall_checked_conditions': 'PASS' if not changed and result['support_status'] == 'PASS'
                        and result['runtime_status'] == 'PASS' else 'FAIL'})
    args.report.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({k: result[k] for k in ['overall_checked_conditions', 'type_instance_count',
          'grounded_instances_checked', 'sampled_lowest_vertex_count', 'upward_paving_triangle_count',
          'maximum_absolute_support_gap', 'whole_aabb_candidate_count',
          'pairs_with_component_aabb_candidates', 'dependencies_changed_since_export']}, indent=2))
    raise SystemExit(0 if result['overall_checked_conditions'] == 'PASS' else 1)


if __name__ == '__main__':
    main()
