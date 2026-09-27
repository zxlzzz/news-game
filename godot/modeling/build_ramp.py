"""Standalone deterministic builder. Python 3 + Shapely 2.1+. Units: metres, Y up."""
NAME = 'ramp'
KIND = 'ramp'
STEP_COUNT = 0
STEP_RISE = 0.15
STEP_DEPTH = 0.30
WALK_WIDTH = 1.5
RAMP_RISE = 0.60
RAMP_RUN = 7.20
RAIL_HEIGHT = 1.0
MID_RAIL_HEIGHT = 0.50
RAIL_RADIUS = 0.03
RAIL_SPANS = 6
ROUND_SEGMENTS = 24

from pathlib import Path
import json
import math
import struct
from collections import defaultdict


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def unit(a):
    n = math.sqrt(sum(v*v for v in a))
    return tuple(v/n for v in a)


class Model:
    def __init__(self):
        self.parts = defaultdict(lambda: defaultdict(list))

    def tri(self, mesh, slot, a, b, c):
        n = cross(sub(b, a), sub(c, a))
        if sum(v*v for v in n) < 1e-18:
            return
        self.parts[mesh][slot].append((a, b, c))

    def quad(self, mesh, slot, a, b, c, d):
        self.tri(mesh, slot, a, b, c)
        self.tri(mesh, slot, a, c, d)

    def tube(self, name, a, b, radius, segments):
        axis = unit(sub(b, a))
        u = unit(cross(axis, (1, 0, 0) if abs(axis[0]) < .9 else (0, 1, 0)))
        v = cross(axis, u)
        rings = [[tuple(p[k] + radius*(u[k]*math.cos(i*2*math.pi/segments) + v[k]*math.sin(i*2*math.pi/segments))
                        for k in range(3)) for i in range(segments)] for p in (a, b)]
        for i in range(segments):
            j = (i+1) % segments
            self.quad(name, 'metal_dark', rings[0][i], rings[0][j], rings[1][j], rings[1][i])
            self.tri(name, 'metal_dark', a, rings[0][j], rings[0][i])
            self.tri(name, 'metal_dark', b, rings[1][i], rings[1][j])

    def export(self, path):
        binary = bytearray()
        views, accessors, meshes, nodes = [], [], [], []
        slots = sorted({s for group in self.parts.values() for s in group})
        def data(values, kind, component, target, bounds=False):
            flat = [v for row in values for v in row] if kind == 'VEC3' else values
            fmt = 'f' if component == 5126 else 'I'
            binary.extend(b'\0' * (-len(binary) % 4))
            start = len(binary)
            binary.extend(struct.pack('<'+fmt*len(flat), *flat))
            views.append(dict(buffer=0, byteOffset=start, byteLength=len(binary)-start, target=target))
            a = dict(bufferView=len(views)-1, componentType=component, count=len(values), type=kind)
            if bounds:
                a.update(min=[min(v[k] for v in values) for k in range(3)], max=[max(v[k] for v in values) for k in range(3)])
            accessors.append(a)
            return len(accessors)-1
        for mesh, groups in sorted(self.parts.items()):
            primitives = []
            for slot, tris in sorted(groups.items()):
                vertices = [p for tri in tris for p in tri]
                normals = [unit(cross(sub(t[1], t[0]), sub(t[2], t[0]))) for t in tris for _ in t]
                p = data(vertices, 'VEC3', 5126, 34962, True)
                n = data(normals, 'VEC3', 5126, 34962)
                i = data(list(range(len(vertices))), 'SCALAR', 5125, 34963)
                primitives.append(dict(attributes=dict(POSITION=p, NORMAL=n), indices=i, material=slots.index(slot), mode=4))
            meshes.append(dict(name=mesh, primitives=primitives))
            nodes.append(dict(name=mesh, mesh=len(meshes)-1))
        doc = dict(asset=dict(version='2.0', generator='news-game deterministic road builder'), scene=0,
                   scenes=[dict(nodes=list(range(len(nodes))))], nodes=nodes, meshes=meshes,
                   materials=[dict(name=s, pbrMetallicRoughness=dict(baseColorFactor=[1,1,1,1], metallicFactor=0, roughnessFactor=1)) for s in slots],
                   buffers=[dict(byteLength=len(binary))], bufferViews=views, accessors=accessors)
        header = json.dumps(doc, separators=(',', ':'), sort_keys=True).encode()
        header += b' ' * (-len(header) % 4)
        blob = struct.pack('<4sII', b'glTF', 2, 28+len(header)+len(binary))
        blob += struct.pack('<I4s', len(header), b'JSON') + header
        blob += struct.pack('<I4s', len(binary), b'BIN\0') + binary
        Path(path).write_bytes(blob)


def horizontal(model, name, slot, polygon, height):
    # GEOS constrained Delaunay keeps every polygon boundary vertex/edge.
    import shapely
    for t in shapely.constrained_delaunay_triangles(polygon).geoms:
        pts = [(x, height(x, z), z) for x, z in list(t.exterior.coords)[:3]]
        if cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))[1] < 0:
            pts.reverse()
        model.tri(name, slot, *pts)


def rails(model, width, samples):
    for side in (-1, 1):
        x = side * width/2
        for i, (z, floor) in enumerate(samples):
            model.tube(f'post_{side}_{i}', (x, floor, z), (x, floor+RAIL_HEIGHT-RAIL_RADIUS, z), RAIL_RADIUS, ROUND_SEGMENTS)
        for i, ((za, ya), (zb, yb)) in enumerate(zip(samples, samples[1:])):
            for tier in (RAIL_HEIGHT-RAIL_RADIUS, MID_RAIL_HEIGHT):
                model.tube(f'rail_{side}_{i}_{tier}', (x, ya+tier, za), (x, yb+tier, zb), RAIL_RADIUS, ROUND_SEGMENTS)

def build_access():
    from shapely.geometry import Polygon
    model = Model()
    if KIND == 'steps':
        length = STEP_COUNT*STEP_DEPTH
        # CCW Y/Z cross-section; one continuous prism, no buried step boxes.
        profile = [(0, length/2), (0, -length/2), (STEP_COUNT*STEP_RISE, -length/2)]
        for i in range(STEP_COUNT, 0, -1):
            profile.extend([(i*STEP_RISE, length/2-(i-1)*STEP_DEPTH), ((i-1)*STEP_RISE, length/2-(i-1)*STEP_DEPTH)])
        samples = [(length/2-i*STEP_DEPTH, (i+1)*STEP_RISE) for i in range(STEP_COUNT)]
        samples.append((-length/2, STEP_COUNT*STEP_RISE))
        body_width = WALK_WIDTH
        rail_width = WALK_WIDTH-2*RAIL_RADIUS
    else:
        length = RAMP_RUN
        profile = [(0, length/2), (0, -length/2), (RAMP_RISE, -length/2)]
        samples = [(length/2-length*i/RAIL_SPANS, RAMP_RISE*i/RAIL_SPANS) for i in range(RAIL_SPANS+1)]
        rail_width = WALK_WIDTH+2*RAIL_RADIUS
        body_width = WALK_WIDTH+4*RAIL_RADIUS
    if profile[-1] == profile[0]:
        profile.pop()
    # Side faces are triangulated in Y/Z, including the staircase outline.
    import shapely
    for sign in (-1, 1):
        for tri in shapely.constrained_delaunay_triangles(Polygon(profile)).geoms:
            points = [(sign*body_width/2, y, z) for y, z in list(tri.exterior.coords)[:3]]
            if cross(sub(points[1], points[0]), sub(points[2], points[0]))[0]*sign < 0:
                points.reverse()
            model.tri('body', 'concrete', *points)
    # Outline is clockwise in the Y/Z plane in this construction.
    for (ya, za), (yb, zb) in zip(profile, profile[1:]+profile[:1]):
        a, b = (-body_width/2, ya, za), (body_width/2, ya, za)
        c, d = (body_width/2, yb, zb), (-body_width/2, yb, zb)
        model.quad('body', 'concrete', a, d, c, b)
    rails(model, rail_width, samples)
    return model


if __name__ == '__main__':
    build_access().export(Path(__file__).resolve().parents[1] / 'models' / (NAME+'.glb'))
