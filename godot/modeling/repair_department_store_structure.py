"""Subtract the department store's overlapping structural window recesses.

Dimensions and cutter positions live in department-store-structure.json. The
cached shell is authoritative: only the named solids are changed. Blender's
installed exact Boolean solver constructs connected, capped recesses without
moving any facade component. Repeated runs validate the applied repair.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
CONFIG = HERE / 'department-store-structure.json'
sys.path.insert(0, str(HERE))


def triangles(primitive):
    import numpy as np
    vertices = np.array(primitive['positions']).reshape(-1, 3)
    return vertices[np.array(primitive['indices']).reshape(-1, 3)]


def groups_and_volumes(primitive, tolerance):
    from check_building_shells import components
    from building_seal import cross, dot
    groups = components([tuple(tuple(p) for p in t) for t in triangles(primitive)], tolerance)
    volumes = [sum(dot(t[0], cross(t[1], t[2])) for t in g) / 6 for g in groups]
    assert len(groups) == 2 and sum(v < 0 for v in volumes) == 1, volumes
    return groups, volumes


def verify_recesses(recipe, config):
    """No remaining structural surface or enclosed solid may fill a cutter."""
    import numpy as np
    from restore_building_windows import polygon_clip
    margin = config['weld_tolerance'] * 2
    for target in config['targets']:
        primitive = next(p for part in recipe['parts'] if part['name'] == target['part'] for p in part['primitives'])
        world = triangles(primitive)
        for recess in target['recesses']:
            normal = np.array(recess['normal'], dtype=float)
            normal /= np.linalg.norm(normal)
            up = np.array([0., 1., 0.])
            right = np.cross(up, normal)
            right /= np.linalg.norm(right)
            basis = np.array([right, up, normal])
            half = recess['width'] / 2
            for bottom in recess['bottoms']:
                origin = np.array(recess['front_origin'], dtype=float)
                origin[1] = bottom
                local = (world - origin) @ basis.T
                limits = [(-half + margin, half - margin), (margin, recess['height'] - margin),
                          (-recess['depth'] + margin, recess['outward_extension'] - margin)]
                possible = np.ones(len(local), dtype=bool)
                for axis, (low, high) in enumerate(limits):
                    possible &= (local[:, :, axis].max(1) > low) & (local[:, :, axis].min(1) < high)
                for triangle in local[possible]:
                    poly = list(triangle)
                    for axis, (low, high) in enumerate(limits):
                        poly = polygon_clip(poly, axis, low, True, margin ** 2)
                        poly = polygon_clip(poly, axis, high, False, margin ** 2)
                        if len(poly) < 3:
                            break
                    if len(poly) >= 3:
                        area = sum(np.linalg.norm(np.cross(poly[i] - poly[0], poly[i + 1] - poly[0])) / 2
                                   for i in range(1, len(poly) - 1))
                        assert area < margin ** 2, ('Structural surface remains in recess', target['part'], bottom, area)
                # A box wholly enclosed in a solid has no surface to clip.
                point = origin + up * (recess['height'] / 2) + normal * ((recess['outward_extension'] - recess['depth']) / 2)
                a, b, c = (world[:, i] - point for i in range(3))
                la, lb, lc = (np.linalg.norm(v, axis=1) for v in (a, b, c))
                numerator = np.einsum('ij,ij->i', a, np.cross(b, c))
                denominator = la * lb * lc + np.einsum('ij,ij->i', a, b) * lc + np.einsum('ij,ij->i', b, c) * la + np.einsum('ij,ij->i', c, a) * lb
                winding = np.arctan2(numerator, denominator).sum() / (2 * np.pi)
                assert abs(winding) < 0.1, ('Solid fills recess', target['part'], bottom)


def validate(before, after, config):
    import numpy as np
    names = {target['part'] for target in config['targets']}
    old = {p['name']: p for p in before['parts']}
    new = {p['name']: p for p in after['parts']}
    assert old.keys() == new.keys()
    assert [p for p in before['parts'] if p['name'] not in names] == [p for p in after['parts'] if p['name'] not in names]
    report = {}
    for name in names:
        assert len(old[name]['primitives']) == len(new[name]['primitives']) == 1
        a, b = old[name]['primitives'][0], new[name]['primitives'][0]
        assert a['slot'] == b['slot']
        g0, v0 = groups_and_volumes(a, config['weld_tolerance'])
        g, v = groups_and_volumes(b, config['weld_tolerance'])
        inner0 = g0[next(i for i, n in enumerate(v0) if n < 0)]
        inner = g[next(i for i, n in enumerate(v) if n < 0)]
        assert Counter(inner0) == Counter(inner), 'Interior boundary changed: ' + name
        assert max(v) < max(v0), 'No structural material was removed: ' + name
        t = triangles(b)
        assert np.isfinite(t).all() and np.isfinite(b['normals']).all()
        assert np.min(np.linalg.norm(np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]), axis=1)) > 0
        report[name] = {'outer_volume_before': max(v0), 'outer_volume_after': max(v),
                        'removed_volume': max(v0) - max(v), 'inner_triangles_unchanged': len(inner),
                        'triangles': len(t)}
    verify_recesses(after, config)
    return report


def worker(source, destination):
    import bpy
    import mathutils
    config = json.loads(CONFIG.read_text())
    recipe = json.loads(Path(source).read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)

    def make_mesh(name, positions, faces):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(positions, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj

    def cutter(spec, bottom):
        origin = mathutils.Vector(spec['front_origin'])
        origin.y = bottom
        normal = mathutils.Vector(spec['normal']).normalized()
        up = mathutils.Vector((0, 1, 0))
        right = up.cross(normal).normalized()
        front, back = spec['outward_extension'], -spec['depth']
        half = spec['width'] / 2
        vertices = [origin + right * u + up * y + normal * d
                    for d in (back, front) for y in (0, spec['height']) for u in (-half, half)]
        faces = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4),
                 (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        return make_mesh('WindowRecess', vertices, faces)

    for target in config['targets']:
        part = next(p for p in recipe['parts'] if p['name'] == target['part'])
        assert len(part['primitives']) == 1
        primitive = part['primitives'][0]
        groups, volumes = groups_and_volumes(primitive, config['weld_tolerance'])
        outer = groups[next(i for i, v in enumerate(volumes) if v > 0)]
        inner = groups[next(i for i, v in enumerate(volumes) if v < 0)]
        positions, ids, faces = [], {}, []
        for triangle in outer:
            face = []
            for position in triangle:
                key = tuple(round(v, config['weld_decimals']) for v in position)
                if key not in ids:
                    ids[key] = len(positions)
                    positions.append(position)
                face.append(ids[key])
            faces.append(face)
        body = make_mesh(target['part'], positions, faces)
        bpy.context.view_layer.objects.active = body
        body.select_set(True)
        for spec in target['recesses']:
            for bottom in spec['bottoms']:
                cut = cutter(spec, bottom)
                modifier = body.modifiers.new('ConnectedWindowRecess', 'BOOLEAN')
                modifier.operation = 'DIFFERENCE'
                modifier.solver = 'EXACT'
                modifier.object = cut
                bpy.ops.object.modifier_apply(modifier=modifier.name)
                bpy.data.objects.remove(cut, do_unlink=True)
        body.data.calc_loop_triangles()
        output_positions, normals, indices = [], [], []
        for tri in body.data.loop_triangles:
            points = [body.data.vertices[i].co.copy() for i in tri.vertices]
            normal = (points[1] - points[0]).cross(points[2] - points[0]).normalized()
            for point in points:
                indices.append(len(output_positions) // 3)
                output_positions.extend(point)
                normals.extend(normal)
        # The cutters stay outside the existing air cavity. Keep its actual
        # source triangles verbatim, rather than asking a Boolean to retessellate
        # or round these unrelated inward-facing surfaces.
        for tri in inner:
            a, b, c = [mathutils.Vector(p) for p in tri]
            normal = (b - a).cross(c - a).normalized()
            for point in tri:
                indices.append(len(output_positions) // 3)
                output_positions.extend(point)
                normals.extend(normal)
        primitive['positions'] = output_positions
        primitive['normals'] = normals
        primitive['indices'] = indices
        bpy.data.objects.remove(body, do_unlink=True)
    Path(destination).write_text(json.dumps(recipe, separators=(',', ':')))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker', nargs=2)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None)
    if args.worker:
        worker(*args.worker)
        return
    config = json.loads(CONFIG.read_text())
    path = HERE / 'shells' / (config['model'] + '.json')
    recipe = json.loads(path.read_text())
    if config['repair_id'] in recipe.get('structural_repairs', []):
        for target in config['targets']:
            part = next(p for p in recipe['parts'] if p['name'] == target['part'])
            groups_and_volumes(part['primitives'][0], config['weld_tolerance'])
        verify_recesses(recipe, config)
        print('DEPARTMENT_STORE_STRUCTURE_VALIDATED')
        return
    assert not args.check, 'Structural recesses have not been applied'
    temporary = HERE.parents[1] / '.tmp' / 'window_repair' / 'structure'
    temporary.mkdir(parents=True, exist_ok=True)
    source = temporary / (config['model'] + '.before.json')
    output = temporary / (config['model'] + '.candidate.json')
    source.write_text(path.read_text())
    subprocess.run([config['blender'], '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(Path(__file__).resolve()),
                    '--', '--worker', str(source), str(output)], check=True)
    candidate = json.loads(output.read_text())
    report = validate(recipe, candidate, config)
    candidate.setdefault('structural_repairs', []).append(config['repair_id'])
    path.write_text(json.dumps(candidate, separators=(',', ':')))
    (temporary / 'structural-repair-report.json').write_text(json.dumps(report, indent=2))
    print('DEPARTMENT_STORE_STRUCTURE_REPAIRED', json.dumps(report))


if __name__ == '__main__':
    main()
