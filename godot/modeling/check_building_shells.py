"""Check closed, consistently wound building shells and empty interior ray paths.

Run: python godot/modeling/check_building_shells.py
This supplements check_model.py, which does not check face winding or cavities.
"""
import json
from collections import defaultdict, deque
from pathlib import Path

from check_model import read_glb, accessor, check
from building_seal import sub, cross, dot, roof_room_names


def components(triangles, tolerance):
    edges = defaultdict(list)
    for i, t in enumerate(triangles):
        keys = [tuple(round(v/tolerance) for v in p) for p in t]
        for a, b in zip(keys, keys[1:]+keys[:1]):
            assert a != b, 'Collapsed edge'
            edges[tuple(sorted((a, b)))].append((i, a < b))
    adjacent = defaultdict(list)
    for edge in edges.values():
        assert len(edge) == 2, 'Open or non-manifold boundary'
        (a, da), (b, db) = edge
        assert da != db, 'Inconsistent face winding'
        adjacent[a].append(b)
        adjacent[b].append(a)
    seen, groups = set(), []
    for start in range(len(triangles)):
        if start in seen:
            continue
        queue, group = deque([start]), []
        seen.add(start)
        while queue:
            a = queue.popleft()
            group.append(triangles[a])
            for b in adjacent[a]:
                if b not in seen:
                    seen.add(b)
                    queue.append(b)
        groups.append(group)
    return groups


def ray_hits(origin, direction, triangles):
    hits = []
    for a, b, c in triangles:
        e1, e2 = sub(b, a), sub(c, a)
        h = cross(direction, e2)
        det = dot(e1, h)
        if abs(det) < 1e-10:
            continue
        s = sub(origin, a)
        u = dot(s, h)/det
        if u < 0 or u > 1:
            continue
        q = cross(s, e1)
        v = dot(direction, q)/det
        if v < 0 or u+v > 1:
            continue
        distance = dot(e2, q)/det
        if distance > 1e-7:
            hits.append((distance, dot(cross(e1, e2), direction)))
    return sorted(hits)


def audit(path, config):
    fails, warns, _ = check(str(path))
    assert not fails, fails
    g, b = read_glb(path)
    roof_rooms = roof_room_names(g)
    def mesh_vertices(mesh):
        return [v for p in mesh['primitives'] for v in accessor(g, b, p['attributes']['POSITION'])]
    meshes = {m.get('name', ''): m for m in g['meshes']}
    for room in roof_rooms:
        wall_front = max(v[2] for v in mesh_vertices(meshes[room]))
        doors = [m for name, m in meshes.items() if name.startswith(room+'_front_pane_')]
        for door in doors:
            panel_front = max(v[2] for v in mesh_vertices(door))
            assert abs(wall_front-panel_front-config['roof_door_setback']) < 1e-4, 'Roof door is not closed at the frame'
    bodies = 0
    for mesh in g['meshes']:
        name = mesh.get('name', '')
        body = name in roof_rooms or name in config['body_names'] or (name.startswith('house_') and name.endswith('_masonry'))
        if not body:
            continue
        triangles = []
        for p in mesh['primitives']:
            vertices = accessor(g, b, p['attributes']['POSITION'])
            ix = [a[0] for a in accessor(g, b, p['indices'])]
            triangles.extend([tuple(vertices[j] for j in ix[i:i+3]) for i in range(0, len(ix), 3)])
        groups = components(triangles, config['weld_tolerance'])
        volumes = [sum(dot(t[0], cross(t[1], t[2])) for t in group)/6 for group in groups]
        assert len(groups) == 2 and sum(v < 0 for v in volumes) == 1, (name, volumes)
        assert sum(volumes) > 0, 'Inverted outer shell'
        inner = groups[next(i for i, v in enumerate(volumes) if v < 0)]
        vertices = [p for t in inner for p in t]
        origin = tuple((min(v[k] for v in vertices)+max(v[k] for v in vertices))/2 for k in range(3))
        # An empty cavity exits through its inner face, then through the outer
        # face. A filled block would have only the latter crossing.
        for direction in [(1, .137, .231), (-1, .137, .231), (.173, 1, .231), (.173, -1, .231), (.173, .137, 1), (.173, .137, -1)]:
            hits = ray_hits(origin, direction, triangles)
            assert len(hits) >= 2, (name, 'Unsealed ray', direction, hits)
            assert hits[0][1] < 0 and hits[1][1] > 0, (name, 'Interior is not empty', hits[:2])
            assert hits[1][0]-hits[0][0] > 1e-5, 'Zero wall thickness'
        bodies += 1
    if path.stem not in ('building_parking_garage', 'building_under_construction'):
        assert bodies, 'No hollow body found'
    return {'model': path.stem, 'hollow_bodies': bodies, 'warnings': warns}


if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    config = json.loads((root/'building-seal.json').read_text())
    reports = [audit(p, config) for p in sorted((root.parent/'models').glob('building*.glb'))]
    print(json.dumps(reports, indent=2))
    print('BUILDING_SHELLS_OK', len(reports), 'models;', sum(r['hollow_bodies'] for r in reports), 'hollow bodies')
