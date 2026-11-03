"""Deterministic final construction pass for building GLBs (standard library only).

Repair inconsistent recess winding, overlap opaque panels with their jambs, and add
an inward-facing inner boundary. The latter defines a hollow wall shell, not a
solid obstruction inside the building. The exterior footprint is unchanged.
"""
import ast
import json
import math
import struct
from collections import defaultdict, deque
from pathlib import Path

from check_model import read_glb, accessor


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def normal(t):
    n = cross(sub(t[1], t[0]), sub(t[2], t[0]))
    length = math.sqrt(dot(n, n))
    if length <= 1e-12:
        raise ValueError('Degenerate building triangle')
    return tuple(v/length for v in n)


def orient(triangles, tolerance):
    """Orient a welded closed boundary consistently, then outward by volume."""
    edges = defaultdict(list)
    for i, t in enumerate(triangles):
        keys = [tuple(round(v/tolerance) for v in p) for p in t]
        for a, b in zip(keys, keys[1:]+keys[:1]):
            if a == b:
                raise ValueError('Degenerate welded edge')
            edges[tuple(sorted((a, b)))].append((i, a < b))
    if any(len(e) != 2 for e in edges.values()):
        raise ValueError('Building boundary is not a closed two-manifold')
    graph = defaultdict(list)
    for (a, da), (b, db) in edges.values():
        graph[a].append((b, da == db))
        graph[b].append((a, da == db))
    flips = {}
    for start in range(len(triangles)):
        if start in flips:
            continue
        flips[start] = False
        queue = deque([start])
        component = []
        while queue:
            a = queue.popleft()
            component.append(a)
            for b, opposite in graph[a]:
                value = flips[a] ^ opposite
                if b in flips:
                    if flips[b] != value:
                        raise ValueError('Non-orientable building boundary')
                else:
                    flips[b] = value
                    queue.append(b)
        volume = sum(dot(triangles[i][0], cross(triangles[i][1], triangles[i][2])) * (-1 if flips[i] else 1) for i in component)
        if volume < 0:
            for i in component:
                flips[i] = not flips[i]
    return [t[::-1] if flips[i] else t for i, t in enumerate(triangles)], sum(flips.values())


def hull(points):
    points = sorted(set(points))
    def turn(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    lower, upper = [], []
    for dest, seq in [(lower, points), (upper, reversed(points))]:
        for p in seq:
            while len(dest) >= 2 and turn(dest[-2], dest[-1], p) <= 1e-9:
                dest.pop()
            dest.append(p)
    return lower[:-1]+upper[:-1]


def inner_boundary(triangles, recess, front_recess, config):
    vertices = [p for t in triangles for p in t]
    outline = hull([(p[0], p[2]) for p in vertices])
    inner = outline[:]
    for a, b in zip(outline, outline[1:]+outline[:1]):
        dx, dz = b[0]-a[0], b[1]-a[1]
        length = math.hypot(dx, dz)
        # CCW polygon: left normal points into the footprint.
        n = (-dz/length, dx/length)
        thickness = (front_recess if n[1] < -0.9 else recess)+config['backing_thickness']
        limit = dot(a, n)+thickness
        clipped = []
        for p, q in zip(inner, inner[1:]+inner[:1]):
            dp, dq = dot(p, n)-limit, dot(q, n)-limit
            if dp >= -1e-9:
                clipped.append(p)
            if (dp < 0) != (dq < 0):
                t = dp/(dp-dq)
                clipped.append(tuple(p[k]+t*(q[k]-p[k]) for k in range(2)))
        inner = hull([(round(x, 9), round(z, 9)) for x, z in clipped])
        if len(inner) < 3:
            raise ValueError('No interior space remains after wall inset')
    low = min(p[1] for p in vertices)+config['floor_roof_thickness']
    high = max(p[1] for p in vertices)-config['floor_roof_thickness']
    if low >= high:
        raise ValueError('No vertical interior space remains')
    lo = [(x, low, z) for x, z in inner]
    hi = [(x, high, z) for x, z in inner]
    result = []
    for i in range(len(inner)):
        j = (i+1) % len(inner)
        result.extend([(lo[i], lo[j], hi[j]), (lo[i], hi[j], hi[i])])
    for i in range(1, len(inner)-1):
        result.extend([(lo[0], lo[i+1], lo[i]), (hi[0], hi[i], hi[i+1])])
    # These faces all point into the air cavity (negative signed volume).
    assert sum(dot(t[0], cross(t[1], t[2])) for t in result) < 0
    return result


def parameters(builder):
    result = {}
    for n in ast.parse(Path(builder).read_text(encoding='utf-8-sig')).body:
        if isinstance(n, ast.Assign) and len(n.targets) == 1:
            try:
                value = ast.literal_eval(n.value)
                target = n.targets[0]
                if isinstance(target, ast.Name):
                    result[target.id] = value
                elif isinstance(target, ast.Tuple):
                    for name, item in zip(target.elts, value):
                        if isinstance(name, ast.Name):
                            result[name.id] = item
            except (ValueError, TypeError):
                pass
    return result


def roof_room_names(gltf):
    """Find windowed roof rooms from their door panels, including rowhouse prefixes."""
    result = set()
    for mesh in gltf['meshes']:
        name = mesh.get('name', '')
        slots = {gltf['materials'][p['material']]['name'] for p in mesh['primitives']}
        parent, separator, _ = name.rpartition('_front_pane_')
        if separator and slots == {'door'} and parent.endswith(('roof_equipment_room', 'roof_stair_room')):
            result.add(parent)
    return result


def seal_building(path, builder):
    path = Path(path)
    config = json.loads(Path(__file__).with_name('building-seal.json').read_text())
    params = parameters(builder)
    p, d = params.get('P', {}), params.get('D', {})
    recess = p.get('recess', d.get('recess', params.get('RECESS', config['default_recess'])))
    front = max([recess]+[n[-1] for n in p.get('niches', [])]+[p.get('porch', {}).get('depth', 0)])
    if p.get('balcony') == 'recessed':
        front = max(front, p['balcony_depth'])
    g, original = read_glb(path)
    if g.get('asset', {}).get('extras', {}).get('sealed_hollow_building'):
        raise ValueError('Already sealed; rerun the original builder before this pass')
    binary = bytearray(original)
    report = {'model': path.stem, 'reversed_triangles': 0, 'panels': 0, 'cavities': []}
    source_normals = {}
    roof_rooms = roof_room_names(g)

    def array(values, kind, component, target):
        binary.extend(b'\0' * (-len(binary) % 4))
        start = len(binary)
        flat = [c for v in values for c in v] if kind == 'VEC3' else values
        binary.extend(struct.pack('<'+('f' if component == 5126 else 'I')*len(flat), *flat))
        g['bufferViews'].append(dict(buffer=0, byteOffset=start, byteLength=len(binary)-start, target=target))
        a = dict(bufferView=len(g['bufferViews'])-1, componentType=component, count=len(values), type=kind)
        if kind == 'VEC3':
            a.update(min=[min(v[k] for v in values) for k in range(3)], max=[max(v[k] for v in values) for k in range(3)])
        g['accessors'].append(a)
        return len(g['accessors'])-1

    def primitive(triangles, material):
        v = [p for t in triangles for p in t]
        normals = []
        for t in triangles:
            n = cross(sub(t[1], t[0]), sub(t[2], t[0]))
            if dot(n, n) <= 1e-24:
                # Legacy Blender booleans contain collinear topology triangles.
                # Retain their existing normals/edges; do not invent a surface.
                n = source_normals[t]
            else:
                n = normal(t)
            normals.extend([n]*3)
        return dict(attributes=dict(POSITION=array(v, 'VEC3', 5126, 34962), NORMAL=array(normals, 'VEC3', 5126, 34962)),
                    indices=array(list(range(len(v))), 'SCALAR', 5125, 34963), material=material, mode=4)

    for mesh in g['meshes']:
        name = mesh.get('name', '')
        roof_room = name in roof_rooms
        body = roof_room or name in config['body_names'] or (name.startswith('house_') and name.endswith('_masonry'))
        # Other windowed block components need their reveal winding repaired too.
        reveal = body or name in ('roof_equipment_room', 'roof_stair_room') or name.startswith('enclosed_balcony_')
        slots = {g['materials'][pr['material']]['name'] for pr in mesh['primitives']}
        panel = slots == {'window'} and any(s in name for s in ('opaque_', 'glass', 'pane', 'infill', 'glazing'))
        roof_door = slots == {'door'} and name.rpartition('_front_pane_')[0] in roof_rooms
        panel = panel or roof_door
        if not (reveal or panel):
            continue
        triangles, materials = [], []
        for pr in mesh['primitives']:
            vertices = accessor(g, original, pr['attributes']['POSITION'])
            ns = accessor(g, original, pr['attributes']['NORMAL'])
            indices = [v[0] for v in accessor(g, original, pr['indices'])]
            ts = [tuple(tuple(vertices[j]) for j in indices[i:i+3]) for i in range(0, len(indices), 3)]
            for i, t in enumerate(ts):
                n = tuple(ns[indices[i*3]])
                source_normals[t] = n
                source_normals[t[::-1]] = tuple(-c for c in n)
            triangles.extend(ts)
            materials.extend([pr['material']]*len(ts))
        triangles, count = orient(triangles, config['weld_tolerance'])
        report['reversed_triangles'] += count
        if panel:
            vertices = [v for t in triangles for v in t]
            # Face normals recover the panel's own basis even on angled turrets.
            candidates = [normal(t) for t in triangles]
            axis = min(candidates, key=lambda n: max(dot(v,n) for v in vertices)-min(dot(v,n) for v in vertices))
            u = next(n for n in candidates if abs(dot(n, axis)) < 1e-4)
            v = cross(axis, u)
            axes = (u, v)
            bounds = [(min(dot(pt,n) for pt in vertices), max(dot(pt,n) for pt in vertices)) for n in axes]
            def expand(pt):
                out = list(pt)
                for n, (lo, hi) in zip(axes, bounds):
                    delta = (dot(pt,n)-(lo+hi)/2)*2*config['panel_overlap']/(hi-lo)
                    out = [out[k]+delta*n[k] for k in range(3)]
                return tuple(out)
            triangles = [tuple(expand(pt) for pt in t) for t in triangles]
            if roof_door:
                # Close at the entrance frame, instead of leaving a deep open
                # vestibule in front of the roof door. All detected doors are
                # on the block's +Z face by the builder's _front_pane contract.
                thickness = max(pt[2] for pt in vertices)-min(pt[2] for pt in vertices)
                shift = recess-thickness-config['roof_door_setback']
                triangles = [tuple((pt[0], pt[1], pt[2]+shift) for pt in t) for t in triangles]
            report['panels'] += 1
        grouped = defaultdict(list)
        for t, mat in zip(triangles, materials):
            grouped[mat].append(t)
        if body:
            cavity = inner_boundary(triangles, recess, recess if roof_room else front, config)
            grouped[materials[0]].extend(cavity)
            report['cavities'].append(name)
        mesh['primitives'] = [primitive(ts, mat) for mat, ts in sorted(grouped.items())]
    g['asset'].setdefault('extras', {})['sealed_hollow_building'] = True
    g['buffers'][0]['byteLength'] = len(binary)
    header = json.dumps(g, separators=(',', ':'), sort_keys=True).encode()
    header += b' ' * (-len(header) % 4)
    blob = struct.pack('<4sII', b'glTF', 2, 28+len(header)+len(binary))
    blob += struct.pack('<I4s', len(header), b'JSON')+header
    blob += struct.pack('<I4s', len(binary), b'BIN\0')+binary
    temporary = path.with_suffix('.glb.tmp')
    temporary.write_bytes(blob)
    temporary.replace(path)
    print('BUILDING_SEALED', json.dumps(report))
    return report
