"""Original hinged door. Standard-library-only, deterministic glTF 2.0 builder.

Dimensions are named in door_single.json; +Z is outside, Y is up. The model's
Hinge node is the actual rotation axis. No material colours/style are baked in.
"""
import json
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG = json.loads((HERE / 'door_single.json').read_text())
OUTPUT = HERE.parent / 'models' / 'door_single.glb'


def build():
    p = CONFIG
    g = dict(asset={'version': '2.0', 'generator': 'News Game door builder'}, scene=0,
             scenes=[{'nodes': [0]}], nodes=[{'name': 'DoorSingle', 'children': []}],
             meshes=[], materials=[{'name': n, 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 1}} for n in ['door', 'wood', 'metal_dark']],
             buffers=[{'byteLength': 0}], bufferViews=[], accessors=[])
    data = bytearray()

    def node(name, parent=0, position=None):
        i = len(g['nodes'])
        n = {'name': name, 'children': []}
        if position is not None:
            n['translation'] = position
        g['nodes'].append(n)
        g['nodes'][parent]['children'].append(i)
        return i

    def array(values, kind):
        flat = [v for row in values for v in row]
        start = len(data)
        data.extend(struct.pack('<' + 'f' * len(flat), *flat))
        v = len(g['bufferViews'])
        g['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(data)-start, 'target': 34962})
        a = {'bufferView': v, 'componentType': 5126, 'count': len(values), 'type': kind}
        a['min'] = [min(row[k] for row in values) for k in range(3)]
        a['max'] = [max(row[k] for row in values) for k in range(3)]
        g['accessors'].append(a)
        return len(g['accessors'])-1

    def box(name, size, center, slot, parent=0):
        vertices, normals = [], []
        # Tangents u,v with u cross v = outward normal.
        for axis, sign, u, v in [(0, 1, 1, 2), (0, -1, 2, 1), (1, 1, 2, 0), (1, -1, 0, 2), (2, 1, 0, 1), (2, -1, 1, 0)]:
            corners = []
            for a, b in [(-1,-1), (1,-1), (1,1), (-1,1)]:
                q = list(center)
                q[axis] += sign*size[axis]/2
                q[u] += a*size[u]/2
                q[v] += b*size[v]/2
                corners.append(q)
            normal = [0,0,0]
            normal[axis] = sign
            for k in [0,1,2,0,2,3]:
                vertices.append(corners[k]); normals.append(normal)
        mesh = {'name': name, 'primitives': [{'attributes': {'POSITION': array(vertices, 'VEC3'), 'NORMAL': array(normals, 'VEC3')}, 'material': slot, 'mode': 4}]}
        i = node(name, parent)
        g['nodes'][i]['mesh'] = len(g['meshes'])
        g['meshes'].append(mesh)

    w, h, f, d = (p[k] for k in ['opening_width', 'opening_height', 'frame_width', 'frame_depth'])
    o, t = p['leaf_overlap'], p['leaf_thickness']
    for side, name in [(-1, 'FrameLeft'), (1, 'FrameRight')]:
        box(name, [f,h+f,d], [side*(w+f)/2,(h+f)/2,-d/2], 1)
    box('FrameTop', [w,f,d], [0,h+f/2,-d/2], 1)
    hinge = node('Hinge', position=[-w/2-o,0,t/2])
    lw, lh = w+2*o, h+o
    box('Leaf', [lw,lh,t], [lw/2,lh/2,0], 0, hinge)
    inset, relief = p['panel_inset'], p['panel_relief']
    for side, name in [(1,'Front'),(-1,'Back')]:
        box('Panel'+name, [lw-2*inset,lh-2*inset,relief], [lw/2,lh/2,side*(t+relief)/2], 1, hinge)
        hx, hy = lw-p['handle_edge_offset'], p['handle_height']
        hz = side*(t/2+p['handle_projection'])
        bar = p['handle_bar']
        box('HandleMount'+name, [bar,bar,p['handle_projection']], [hx,hy,side*(t+p['handle_projection'])/2], 2, hinge)
        box('Handle'+name, [p['handle_length'],bar,bar], [hx-p['handle_length']/2,hy,hz], 2, hinge)
        node('grip_'+name.lower(), hinge, [hx-p['handle_length']/2,hy,hz])
    node('opening_bottom', position=[0,0,0])
    node('opening_top', position=[0,h,0])
    g['buffers'][0]['byteLength'] = len(data)
    header = json.dumps(g, sort_keys=True, separators=(',',':')).encode()
    header += b' ' * (-len(header)%4)
    OUTPUT.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(header)+len(data)) + struct.pack('<I4s',len(header),b'JSON')+header + struct.pack('<I4s',len(data),b'BIN\0')+data)
    print(OUTPUT)


if __name__ == '__main__':
    build()
