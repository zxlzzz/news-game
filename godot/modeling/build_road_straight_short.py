"""Standalone deterministic builder. Python 3 + Shapely 2.1+. Units: metres, Y up.
No underside or end caps: merge adjacent modules before applying the ink style.
"""
NAME = 'road_straight_short'
KIND = 'straight'
LENGTH = 2.0
MOTOR_WIDTH = 9.0
BIKE_WIDTH = 2.0
SIDEWALK_WIDTH = 3.5
TOTAL_WIDTH = MOTOR_WIDTH + 2*BIKE_WIDTH + 2*SIDEWALK_WIDTH
ROAD_HEIGHT = 0.0
SIDEWALK_HEIGHT = 0.15
CORNER_RADIUS = 3.5
CURB_RAMP_RUN = 1.8
CURB_FLARE_LENGTH = 1.0
ARC_SEGMENTS = 24
ALLEY_WIDTH = 4.0
DRIVE_CLEAR_WIDTH = 4.0
DRIVE_RAMP_RUN = 1.8
PORTS = [(0, -1), (0, 1)]
PORT_SNAP = 0.01
PORT_TOL = 1e-6
PRECISION = 1e-8

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

def build_road():
    import shapely
    from shapely.geometry import Polygon, Point, LineString, box
    from shapely.ops import unary_union, polygonize
    model = Model()
    surfaces = []
    def flat(poly, slot, height):
        surfaces.append((poly, slot, lambda x, z, h=height: h))
    def quarter(cx, cz):
        sx, sz = -math.copysign(1, cx), -math.copysign(1, cz)
        points = [(cx, cz)] + [(cx+sx*CORNER_RADIUS*math.cos(i*math.pi/2/ARC_SEGMENTS), cz+sz*CORNER_RADIUS*math.sin(i*math.pi/2/ARC_SEGMENTS)) for i in range(ARC_SEGMENTS+1)]
        return Polygon(points)
    def corner_top(cx, cz):
        sx, sz = -math.copysign(1, cx), -math.copysign(1, cz)
        def at(r, i):
            a = i*math.pi/2/ARC_SEGMENTS
            return (cx+sx*r*math.cos(a), cz+sz*r*math.sin(a))
        inner = CORNER_RADIUS-CURB_RAMP_RUN
        flat(Polygon([(cx, cz)]+[at(inner, i) for i in range(ARC_SEGMENTS+1)]), 'sidewalk', SIDEWALK_HEIGHT)
        # A broad diagonal cut, flared back up to full height at both port ends.
        def edge_h(i):
            a = i*math.pi/2/ARC_SEGMENTS
            margin = min(a, math.pi/2-a)*CORNER_RADIUS
            return SIDEWALK_HEIGHT*max(0, 1-margin/CURB_FLARE_LENGTH)
        for i in range(ARC_SEGMENTS):
            coords = [at(inner, i), at(CORNER_RADIUS, i), at(CORNER_RADIUS, i+1), at(inner, i+1)]
            heights = [SIDEWALK_HEIGHT, edge_h(i), edge_h(i+1), SIDEWALK_HEIGHT]
            for indices in ((0, 1, 2), (0, 2, 3)):
                p = [coords[j] for j in indices]
                h = [heights[j] for j in indices]
                # Linear height on each triangular ramp face.
                den = (p[1][1]-p[2][1])*(p[0][0]-p[2][0])+(p[2][0]-p[1][0])*(p[0][1]-p[2][1])
                def height(x, z, p=p, h=h, den=den):
                    u = ((p[1][1]-p[2][1])*(x-p[2][0])+(p[2][0]-p[1][0])*(z-p[2][1]))/den
                    v = ((p[2][1]-p[0][1])*(x-p[2][0])+(p[0][0]-p[2][0])*(z-p[2][1]))/den
                    return u*h[0]+v*h[1]+(1-u-v)*h[2]
                surfaces.append((Polygon(p), 'sidewalk', height))

    half = TOTAL_WIDTH/2
    curb = MOTOR_WIDTH/2+BIKE_WIDTH
    if KIND in ('straight', 'cross', 't', 'corner', 'end'):
        footprint = box(-LENGTH/2, -half, LENGTH/2, half)
        corners = []
        if KIND == 'straight':
            sidewalk = unary_union([box(-LENGTH/2, curb, LENGTH/2, half), box(-LENGTH/2, -half, LENGTH/2, -curb)])
        elif KIND == 'cross':
            corners = [(x, z) for x in (-half, half) for z in (-half, half)]
            sidewalk = unary_union([quarter(*c) for c in corners])
        elif KIND == 't':
            corners = [(-half, half), (half, half)]
            sidewalk = unary_union([box(-half, -half, half, -curb)]+[quarter(*c) for c in corners])
        elif KIND == 'corner':
            corners = [(-half, half)]
            cx, cz = curb-CORNER_RADIUS, -curb+CORNER_RADIUS
            arc = [(cx+CORNER_RADIUS*math.cos(-math.pi/2+i*math.pi/2/ARC_SEGMENTS), cz+CORNER_RADIUS*math.sin(-math.pi/2+i*math.pi/2/ARC_SEGMENTS)) for i in range(ARC_SEGMENTS+1)]
            drive = Polygon([(-half, -curb)]+arc+[(curb, half), (-half, half)]).difference(quarter(-half, half))
            sidewalk = footprint.difference(drive)
        else:
            sidewalk = unary_union([box(-LENGTH/2, curb, LENGTH/2, half), box(-LENGTH/2, -half, LENGTH/2, -curb), box(LENGTH/2-SIDEWALK_WIDTH, -half, LENGTH/2, half)])
        corner_union = unary_union([quarter(*c) for c in corners])
        flat(sidewalk.difference(corner_union), 'sidewalk', SIDEWALK_HEIGHT)
        for c in corners:
            corner_top(*c)
        drivable = footprint.difference(sidewalk)
        bike = sidewalk.buffer(BIKE_WIDTH, quad_segs=ARC_SEGMENTS).intersection(drivable)
        # Offset polylines drift slightly at curve ends. Enforce the exact
        # straight-road port dimensions before deriving the central road.
        from shapely.ops import transform
        def snap_port(xs, zs):
            out = []
            for x,z in zip(xs,zs):
                if any(axis == 0 and abs(x-coord)<PORT_TOL for axis,coord in PORTS) and abs(abs(z)-MOTOR_WIDTH/2)<PORT_SNAP:
                    z = math.copysign(MOTOR_WIDTH/2,z)
                if any(axis == 2 and abs(z-coord)<PORT_TOL for axis,coord in PORTS) and abs(abs(x)-MOTOR_WIDTH/2)<PORT_SNAP:
                    x = math.copysign(MOTOR_WIDTH/2,x)
                out.append((x,z))
            return tuple(zip(*out))
        bike = transform(snap_port, bike)
        flat(bike, 'bike_lane', ROAD_HEIGHT)
        flat(drivable.difference(bike), 'road', ROAD_HEIGHT)
    elif KIND == 'alley':
        footprint = box(-LENGTH/2, -ALLEY_WIDTH/2, LENGTH/2, ALLEY_WIDTH/2)
        flat(footprint, 'concrete', SIDEWALK_HEIGHT)
    else:
        footprint = box(-LENGTH/2, -SIDEWALK_WIDTH/2, LENGTH/2, SIDEWALK_WIDTH/2)
        # Ramp faces are explicitly planar, including the triangular side flares.
        front, back = -SIDEWALK_WIDTH/2, SIDEWALK_WIDTH/2
        crest = front+DRIVE_RAMP_RUN
        inside = DRIVE_CLEAR_WIDTH/2
        points = [(-inside, front), (inside, front), (inside, crest), (-inside, crest)]
        surfaces.append((Polygon(points), 'sidewalk', lambda x,z: SIDEWALK_HEIGHT*(z-front)/DRIVE_RAMP_RUN))
        flat(box(-LENGTH/2, crest, LENGTH/2, back), 'sidewalk', SIDEWALK_HEIGHT)
        for sign in (-1, 1):
            outer, inner = sign*LENGTH/2, sign*inside
            coords = [(outer, front), (inner, front), (inner, crest), (outer, crest)]
            for ids in ((0,1,2), (0,2,3)):
                p = [coords[i] for i in ids]
                hs = [SIDEWALK_HEIGHT, 0, SIDEWALK_HEIGHT, SIDEWALK_HEIGHT]
                h = [hs[i] for i in ids]
                den = (p[1][1]-p[2][1])*(p[0][0]-p[2][0])+(p[2][0]-p[1][0])*(p[0][1]-p[2][1])
                def height(x,z,p=p,h=h,den=den):
                    u = ((p[1][1]-p[2][1])*(x-p[2][0])+(p[2][0]-p[1][0])*(z-p[2][1]))/den
                    v = ((p[2][1]-p[0][1])*(x-p[2][0])+(p[0][0]-p[2][0])*(z-p[2][1]))/den
                    return u*h[0]+v*h[1]+(1-u-v)*h[2]
                surfaces.append((Polygon(p), 'sidewalk', height))

    # Node the whole surface partition BEFORE triangulation so material/ramp
    # boundaries share identical vertices (no T-junctions or false open edges).
    surfaces = [(shapely.set_precision(p, PRECISION), s, h) for p,s,h in surfaces if not p.is_empty]
    lines = [p.boundary for p,_,_ in surfaces]
    # Identical top-edge segmentation at every port, including curved ramp
    # corners. A later weld alone must suffice; no seam retriangulation needed.
    if KIND in ('straight','cross','t','corner','end'):
        port_break = half-(CORNER_RADIUS-CURB_RAMP_RUN)
        for axis in {axis for axis,_ in PORTS}:
            for value in (-port_break, port_break):
                line = LineString([(-LENGTH, value),(LENGTH,value)]) if axis == 0 else LineString([(value,-TOTAL_WIDTH),(value,TOTAL_WIDTH)])
                lines.append(line.intersection(footprint))
    network = unary_union(lines)
    edges = defaultdict(list)
    for tile in polygonize(network):
        rp = tile.representative_point()
        matches = [(slot, height) for poly,slot,height in surfaces if poly.covers(rp)]
        if len(matches) != 1:
            raise ValueError(f'Uncovered/overlapping top surface: {rp}, {len(matches)}')
        slot, height = matches[0]
        for tri in shapely.constrained_delaunay_triangles(tile).geoms:
            points = [(float(x), max(0.0, height(x,z)), float(z)) for x,z in list(tri.exterior.coords)[:3]]
            if cross(sub(points[1], points[0]), sub(points[2], points[0]))[1] < 0:
                points.reverse()
            model.tri('surface', slot, *points)
            for a,b in zip(points, points[1:]+points[:1]):
                key = tuple(sorted(((round(a[0],7),round(a[2],7)), (round(b[0],7),round(b[2],7)))))
                edges[key].append((a,b))
    def is_port(a,b):
        return any(all(abs(p[axis]-coordinate) < PORT_TOL for p in (a,b)) for axis,coordinate in PORTS)
    for key, sides in edges.items():
        if len(sides) == 2:
            a,b = sides[0]
            c,d = sides[1]
            if abs(a[1]-d[1])+abs(b[1]-c[1]) < PORT_TOL:
                continue
            if a[1]+b[1] < c[1]+d[1]:
                a,b,c,d = c,d,a,b
            model.quad('surface','trim',b,a,d,c)
        elif len(sides) == 1:
            a,b = sides[0]
            if not is_port(a,b):
                # No bottom. Outer vertical faces terminate at the road datum.
                model.quad('surface', 'concrete' if KIND == 'alley' else 'trim', b,a,(a[0],0,a[2]),(b[0],0,b[2]))
        else:
            raise ValueError(f'Nonmanifold partition edge: {key}')
    return model


if __name__ == '__main__':
    build_road().export(Path(__file__).resolve().parents[1] / 'models' / (NAME+'.glb'))
