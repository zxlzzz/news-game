"""Restore specified missing windows in authoritative cached building shells.

The original porch filter removed whole upper columns. This migration subtracts
only their front-face rectangles, adds closed recesses, and copies same-level
window instances. Other shell parts and interior surfaces stay authoritative.
Run with ordinary Python; a second run validates without changing the recipes.
"""
import argparse
from collections import Counter
import copy
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent


def polygon_clip(poly, axis, limit, keep_above, tolerance):
    """Clip a convex polygon while retaining edge intersections and winding."""
    result = []
    for p, q in zip(poly, poly[1:] + poly[:1]):
        dp, dq = p[axis] - limit, q[axis] - limit
        inside_p = dp >= -tolerance if keep_above else dp <= tolerance
        inside_q = dq >= -tolerance if keep_above else dq <= tolerance
        if inside_p:
            result.append(p)
        if inside_p != inside_q:
            point = p + dp / (dp - dq) * (q - p)
            point[axis] = limit
            result.append(point)
    cleaned = []
    for p in result:
        if not cleaned or np.linalg.norm(p - cleaned[-1]) > tolerance:
            cleaned.append(p)
    if len(cleaned) > 1 and np.linalg.norm(cleaned[0] - cleaned[-1]) <= tolerance:
        cleaned.pop()
    return cleaned


def fan(poly, tolerance):
    if len(poly) < 3:
        return []
    # The centre fan keeps every collinear boundary point, unlike an ear clip.
    center = np.mean(poly, axis=0)
    return [np.array([p, q, center]) for p, q in zip(poly, poly[1:] + poly[:1])
            if np.linalg.norm(q - p) > tolerance
            and np.linalg.norm(np.cross(q - p, center - p)) > tolerance ** 2]


def subtract_rectangle(triangle, opening, tolerance):
    left, right, bottom, top = opening
    if (triangle[:, 0].max() <= left + tolerance or triangle[:, 0].min() >= right - tolerance
            or triangle[:, 1].max() <= bottom + tolerance or triangle[:, 1].min() >= top - tolerance):
        return [triangle]
    inside = list(triangle)
    outside = []
    for axis, limit, keep_above in [(0, left, True), (0, right, False),
                                     (1, bottom, True), (1, top, False)]:
        outside.extend(fan(polygon_clip(inside, axis, limit, not keep_above, tolerance), tolerance))
        inside = polygon_clip(inside, axis, limit, keep_above, tolerance)
        if len(inside) < 3:
            break
    return outside


def primitive_triangles(primitive):
    return np.array(primitive['positions']).reshape(-1, 3)[np.array(primitive['indices']).reshape(-1, 3)]


def first_front_hit(triangles, x, y, tolerance):
    """Nearest wall face along -Z at a window centre, independent of normals."""
    p = triangles[:, :, :2]
    def cross2(a, b):
        return a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0]
    area = cross2(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
    valid = np.abs(area) > tolerance ** 2
    u = np.divide(cross2(p[:, 1] - [x, y], p[:, 2] - [x, y]), area,
                  out=np.zeros_like(area), where=valid)
    v = np.divide(cross2(p[:, 2] - [x, y], p[:, 0] - [x, y]), area,
                  out=np.zeros_like(area), where=valid)
    w = 1 - u - v
    valid &= (u >= -tolerance) & (v >= -tolerance) & (w >= -tolerance)
    z = u * triangles[:, 0, 2] + v * triangles[:, 1, 2] + w * triangles[:, 2, 2]
    return float(z[valid].max())


def oriented_triangle(points, normal):
    tri = np.array(points)
    if np.dot(np.cross(tri[1] - tri[0], tri[2] - tri[0]), normal) < 0:
        tri = tri[::-1]
    return tri


def recess_faces(front, opening, depth, tolerance):
    """Extrude each actual rim segment; cap its complete subdivided perimeter."""
    left, right, bottom, top = opening
    points = np.unique(np.round(np.concatenate(front).reshape(-1, 3), 9), axis=0)
    bounds = [
        points[(np.abs(points[:, 1] - bottom) < tolerance) & (points[:, 0] >= left - tolerance) & (points[:, 0] <= right + tolerance)],
        points[(np.abs(points[:, 0] - right) < tolerance) & (points[:, 1] >= bottom - tolerance) & (points[:, 1] <= top + tolerance)],
        points[(np.abs(points[:, 1] - top) < tolerance) & (points[:, 0] >= left - tolerance) & (points[:, 0] <= right + tolerance)],
        points[(np.abs(points[:, 0] - left) < tolerance) & (points[:, 1] >= bottom - tolerance) & (points[:, 1] <= top + tolerance)]]
    perimeter = []
    result = []
    for side, edge in enumerate(bounds):
        axis = 0 if side in (0, 2) else 1
        edge = edge[np.argsort(edge[:, axis])]
        if side in (2, 3):
            edge = edge[::-1]
        assert len(edge) >= 2, ('Missing recess rim', opening, side)
        perimeter.extend(edge[:-1])
        normal = [(0, 1, 0), (-1, 0, 0), (0, -1, 0), (1, 0, 0)][side]
        for a, b in zip(edge, edge[1:]):
            c, d = b.copy(), a.copy()
            c[2] = d[2] = -depth
            result.extend([oriented_triangle([a, b, c], normal), oriented_triangle([a, c, d], normal)])
    back = [np.array([p[0], p[1], -depth]) for p in perimeter]
    result.extend(fan(back, tolerance))
    return result


def split_shared_edges(triangles, original, tolerance):
    """Propagate clipping vertices to adjacent faces, closing all T junctions."""
    canonical = {tuple(np.round(p, 9)): p for p in original.reshape(-1, 3)}
    old = set(canonical)
    points = np.array([p for p in np.unique(np.round(np.concatenate(triangles).reshape(-1, 3), 9), axis=0)
                       if tuple(p) not in old])
    result = []
    for tri in triangles:
        boundary = []
        for p, q in zip(tri, np.roll(tri, -1, axis=0)):
            delta = q - p
            length2 = float(delta @ delta)
            if length2 <= tolerance ** 2:
                raise ValueError('Degenerate edge')
            t = (points - p) @ delta / length2
            mask = (t >= -tolerance) & (t <= 1 + tolerance)
            candidates = points[mask]
            ts = t[mask]
            mask = np.max(np.abs(candidates - p - ts[:, None] * delta), axis=1) <= tolerance
            candidates = np.concatenate(([p], candidates[mask], [q]))
            ts = np.concatenate(([0.0], ts[mask], [1.0]))
            order = np.argsort(ts)
            edge = candidates[order]
            edge = [point for i, point in enumerate(edge)
                    if i == 0 or np.linalg.norm(point - edge[i - 1]) > tolerance]
            boundary.extend(edge[:-1])
        result.extend([tri] if len(boundary) == 3 else fan(boundary, tolerance))
    return np.array([[canonical.get(tuple(np.round(p, 9)), np.round(p, 9)) for p in tri]
                     for tri in result])


def verify_closed(triangles, tolerance):
    keys = np.rint(triangles / tolerance).astype(np.int64)
    edges = Counter()
    directed = Counter()
    for tri in keys:
        for a, b in zip(tri, np.roll(tri, -1, axis=0)):
            a, b = tuple(a), tuple(b)
            if a == b:
                raise ValueError('Degenerate welded edge')
            edges[tuple(sorted((a, b)))] += 1
            directed[(a, b)] += 1
    assert all(n == 2 for n in edges.values()), Counter(edges.values())
    assert all(directed[(a, b)] == directed[(b, a)] for a, b in edges), 'Inconsistent winding'


def restore(name, spec, config, layout, check):
    tolerance = config['geometry_tolerance']
    path = HERE / 'shells' / (name + '.json')
    recipe = json.loads(path.read_text())
    part = next(p for p in recipe['parts'] if p['name'] == 'masonry')
    assert len(part['primitives']) == 1, 'Expected one masonry colour slot'
    primitive = part['primitives'][0]
    triangles = primitive_triangles(primitive)
    verify_closed(triangles, tolerance)
    front_y = np.unique(triangles[np.max(np.abs(triangles[:, :, 2]), axis=1) < tolerance, :, 1])
    def snap_y(value):
        nearest = float(front_y[np.argmin(np.abs(front_y - value))])
        assert abs(nearest - value) < config['vertex_snap_tolerance'], ('Missing existing floor boundary', name, value)
        return nearest
    templates = sorted([r for r in layout[name] if r['type'].startswith('window_')
                        and abs(r.get('yaw', 0)) < tolerance
                        and abs(r['position'][0] - spec['template_column']) < tolerance],
                       key=lambda r: r['position'][1])
    assert len(templates) == spec['levels'], ('Unexpected template levels', name)
    openings = []
    expected = []
    added = []
    for template in templates:
        bottom = snap_y(template['position'][1] + config['opening_bottom_offset'])
        top = snap_y(bottom + spec['height'])
        for x in spec['columns']:
            opening = (x - spec['width'] / 2, x + spec['width'] / 2, bottom, top)
            expected.append(opening)
            hit = first_front_hit(triangles, x, bottom + spec['height'] / 2, tolerance)
            if abs(hit) <= tolerance:
                openings.append(opening)
            elif abs(hit + config['recess_depth']) > tolerance:
                raise ValueError((name, opening, 'Unexpected wall depth', hit))
            row = copy.deepcopy(template)
            row['position'][0] = x
            matches = [r for r in layout[name] if np.max(np.abs(np.array(r['position']) - row['position'])) < tolerance
                       and abs(r.get('yaw', 0)) < tolerance]
            if matches:
                assert len(matches) == 1 and matches[0]['type'] == row['type'], ('Unexpected existing instance', name, row)
            else:
                added.append(row)
    if check:
        assert not openings and not added, (name, 'Missing cavities/instances', len(openings), len(added))
    elif openings:
        front = triangles[np.max(np.abs(triangles[:, :, 2]), axis=1) < tolerance]
        other = triangles[np.max(np.abs(triangles[:, :, 2]), axis=1) >= tolerance]
        clipped = list(front)
        for opening in openings:
            clipped = [new for tri in clipped for new in subtract_rectangle(tri, opening, tolerance)]
        added_faces = [tri for opening in openings
                       for tri in recess_faces(clipped, opening, config['recess_depth'], tolerance)]
        triangles = split_shared_edges(list(other) + clipped + added_faces, triangles, tolerance)
        verify_closed(triangles, tolerance)
        normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        normals /= np.linalg.norm(normals, axis=1)[:, None]
        primitive['positions'] = triangles.flatten().tolist()
        primitive['normals'] = np.repeat(normals[:, None], 3, axis=1).flatten().tolist()
        primitive['indices'] = list(range(len(triangles) * 3))
        path.write_text(json.dumps(recipe, separators=(',', ':')), encoding='utf-8')
    for opening in expected:
        center = ((opening[0] + opening[1]) / 2, (opening[2] + opening[3]) / 2)
        assert abs(first_front_hit(triangles, *center, tolerance) + config['recess_depth']) <= tolerance
    if added and not check:
        layout[name].extend(added)
    print(name, 'RESTORED' if openings or added else 'VALIDATED', len(expected),
          'cavities', len(openings), 'instances', len(added))
    return bool(added)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate completed restoration without modifying files')
    args = parser.parse_args()
    config = json.loads((HERE / 'building-window-restoration.json').read_text())
    layout_path = HERE / 'building-layouts.json'
    layout = json.loads(layout_path.read_text())
    changed = False
    for name, spec in config['buildings'].items():
        changed = restore(name, spec, config, layout, args.check) or changed
    if changed:
        layout_path.write_text(json.dumps(layout, separators=(',', ':')), encoding='utf-8')


if __name__ == '__main__':
    main()
