"""Original T-handled cane. Run with Python 3; no external dependencies.

Y up, metres, grip centre at the origin, tip along -Y. Deterministic GLB.
"""
from pathlib import Path
import json
import math
import struct

NAME = 'held_cane'
SEGMENTS = 32
GRIP_LENGTH = 0.13
GRIP_RADIUS = 0.03
SHAFT_RADIUS = 0.013
SHAFT_BOTTOM_Y = -0.79
SHAFT_TOP_Y = 0.0
TIP_BOTTOM_Y = -0.82
TIP_TOP_Y = -0.78
TIP_RADIUS = 0.023
PARTS = [
    ('shaft', SHAFT_RADIUS, SHAFT_TOP_Y-SHAFT_BOTTOM_Y,
     (0, (SHAFT_BOTTOM_Y+SHAFT_TOP_Y)/2, 0), 'y', 'metal_dark'),
    ('grip', GRIP_RADIUS, GRIP_LENGTH, (0, 0, 0), 'z', 'wood'),
    ('rubber_tip', TIP_RADIUS, TIP_TOP_Y-TIP_BOTTOM_Y,
     (0, (TIP_BOTTOM_Y+TIP_TOP_Y)/2, 0), 'y', 'trim_dark'),
]


def cylinder(radius, length, centre, axis):
    vertices, normals, indices = [], [], []
    def orient(v):
        # Proper rotation: local Y to world Z.
        return v if axis == 'y' else (v[0], -v[2], v[1])
    def add(v, n):
        v, n = orient(v), orient(n)
        vertices.append(tuple(v[i]+centre[i] for i in range(3)))
        normals.append(n)
        return len(vertices)-1
    for level in (-length/2, length/2):
        for i in range(SEGMENTS):
            angle = 2*math.pi*i/SEGMENTS
            x, z = math.cos(angle), math.sin(angle)
            add((radius*x, level, radius*z), (x, 0, z))
    for i in range(SEGMENTS):
        j = (i+1) % SEGMENTS
        indices.extend((i, SEGMENTS+i, j, j, SEGMENTS+i, SEGMENTS+j))
    for sign in (-1, 1):
        c = add((0, sign*length/2, 0), (0, sign, 0))
        ring = [add((radius*math.cos(2*math.pi*i/SEGMENTS), sign*length/2,
                     radius*math.sin(2*math.pi*i/SEGMENTS)), (0, sign, 0))
                for i in range(SEGMENTS)]
        for i in range(SEGMENTS):
            a, b = ring[i], ring[(i+1) % SEGMENTS]
            indices.extend((c, b, a) if sign == 1 else (c, a, b))
    return vertices, normals, indices


def build():
    binary = bytearray()
    views, accessors, meshes, nodes = [], [], [], []
    slots = sorted({part[-1] for part in PARTS})
    def data(values, kind, component, target, bounds=False):
        flat = [v for row in values for v in row] if kind == 'VEC3' else values
        fmt = 'f' if component == 5126 else 'H'
        while len(binary) % 4:
            binary.append(0)
        start = len(binary)
        binary.extend(struct.pack('<'+fmt*len(flat), *flat))
        views.append(dict(buffer=0, byteOffset=start, byteLength=len(binary)-start, target=target))
        entry = dict(bufferView=len(views)-1, componentType=component, count=len(values), type=kind)
        if bounds:
            entry.update(min=[min(v[i] for v in values) for i in range(3)],
                         max=[max(v[i] for v in values) for i in range(3)])
        accessors.append(entry)
        return len(accessors)-1
    for name, radius, length, centre, axis, material in PARTS:
        positions, normals, indices = cylinder(radius, length, centre, axis)
        position_id = data(positions, 'VEC3', 5126, 34962, True)
        normal_id = data(normals, 'VEC3', 5126, 34962)
        index_id = data(indices, 'SCALAR', 5123, 34963)
        meshes.append(dict(name=name, primitives=[dict(attributes=dict(POSITION=position_id, NORMAL=normal_id),
            indices=index_id, material=slots.index(material), mode=4)]))
        nodes.append(dict(name=name, mesh=len(meshes)-1))
    nodes.append(dict(name='tip', translation=[0, TIP_BOTTOM_Y, 0]))
    while len(binary) % 4:
        binary.append(0)
    doc = dict(asset=dict(version='2.0', generator='news-game deterministic cane builder'), scene=0,
        scenes=[dict(nodes=list(range(len(nodes))))], nodes=nodes, meshes=meshes,
        materials=[dict(name=slot, pbrMetallicRoughness=dict(baseColorFactor=[1,1,1,1],
            metallicFactor=0, roughnessFactor=1)) for slot in slots],
        buffers=[dict(byteLength=len(binary))], bufferViews=views, accessors=accessors)
    header = json.dumps(doc, separators=(',', ':'), sort_keys=True).encode('utf-8')
    header += b' ' * (-len(header) % 4)
    glb = struct.pack('<4sII', b'glTF', 2, 12+8+len(header)+8+len(binary))
    glb += struct.pack('<I4s', len(header), b'JSON') + header
    glb += struct.pack('<I4s', len(binary), b'BIN\0') + binary
    path = Path(__file__).resolve().parents[1] / 'models' / (NAME+'.glb')
    path.write_bytes(glb)
    print(path)


if __name__ == '__main__':
    build()
