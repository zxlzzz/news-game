"""Deterministic closed window with an independently hinged sash; metre/Y-up/+Z."""
import json
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUTPUT = HERE.parent / 'models/window_single.glb'


def build():
    p = json.loads((HERE / 'window_single.json').read_text())
    w, h, t, f = (p[k] for k in ('width', 'height', 'depth', 'frame'))
    clearance=p['pane_clearance']
    leaf_w,leaf_h=w-2*f-2*clearance,h-2*f-2*clearance
    binary = bytearray()
    doc = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': []}],
           'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [],
           'buffers': [{'byteLength': 0}], 'materials': [{'name': 'trim_dark'}, {'name': 'window'}, {'name': 'metal'}]}

    def node(name, parent=None, at=(0, 0, 0)):
        index = len(doc['nodes'])
        doc['nodes'].append({'name': name, 'translation': list(at)})
        (doc['scenes'][0]['nodes'] if parent is None else doc['nodes'][parent].setdefault('children', [])).append(index)
        return index

    def array(values, kind, component, width):
        while len(binary) % 4:
            binary.append(0)
        offset = len(binary)
        binary.extend(struct.pack('<' + ('f' if component == 5126 else 'H') * len(values), *values))
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(binary) - offset})
        index = len(doc['accessors'])
        accessor = {'bufferView': view, 'componentType': component, 'count': len(values)//width, 'type': kind}
        if kind == 'VEC3':
            accessor.update(min=[min(values[i::3]) for i in range(3)], max=[max(values[i::3]) for i in range(3)])
        doc['accessors'].append(accessor)
        return index

    def box(name, size, at, slot, parent=None):
        vertices, normals, indices = [], [], []
        for axis, sign in [(0, -1), (0, 1), (1, -1), (1, 1), (2, -1), (2, 1)]:
            other = [i for i in range(3) if i != axis]
            points = []
            for a,b in [(-1,-1), (1,-1), (1,1), (-1,1)]:
                v = [0,0,0];v[axis] = sign*size[axis]/2
                v[other[0]],v[other[1]] = a*size[other[0]]/2,b*size[other[1]]/2
                points.append(v)
            if (axis == 1) == (sign == 1):
                points.reverse()
            start = len(vertices)//3
            vertices.extend(v for point in points for v in point)
            n = [0,0,0];n[axis]=sign;normals.extend(n*4)
            indices.extend([start,start+1,start+2,start,start+2,start+3])
        mesh = len(doc['meshes'])
        doc['meshes'].append({'name': name, 'primitives': [{'attributes': {
            'POSITION': array(vertices, 'VEC3', 5126, 3), 'NORMAL': array(normals, 'VEC3', 5126, 3)},
            'indices': array(indices, 'SCALAR', 5123, 1), 'material': slot}]})
        doc['nodes'][node(name,parent,at)]['mesh'] = mesh

    for side in (-1,1):
        box('FrameLeft' if side < 0 else 'FrameRight', (f,h,t), (side*(w-f)/2,h/2,0), 0)
    for upper in (False,True):
        box('FrameTop' if upper else 'FrameBottom', (w-2*f,f,t), (0,h-f/2 if upper else f/2,0), 0)
    hinge=node('SashHinge', at=(-w/2+f+clearance,f+clearance,p['pane_depth']/2))
    sash_f,sash_d=p['sash_frame_width'],p['sash_depth']
    assert 0 < 2*sash_f < min(leaf_w,leaf_h)
    assert 0 < p['glass_depth'] < sash_d
    for side in (-1,1):
        box('SashFrameLeft' if side < 0 else 'SashFrameRight',
            (sash_f,leaf_h,sash_d),
            (sash_f/2 if side < 0 else leaf_w-sash_f/2,leaf_h/2,-sash_d/2),0,hinge)
    for upper in (False,True):
        box('SashFrameTop' if upper else 'SashFrameBottom',
            (leaf_w-2*sash_f,sash_f,sash_d),
            (leaf_w/2,leaf_h-sash_f/2 if upper else sash_f/2,-sash_d/2),0,hinge)
    box('Sash', (leaf_w-2*sash_f,leaf_h-2*sash_f,p['glass_depth']),
        (leaf_w/2,leaf_h/2,-sash_d/2),1,hinge)
    plate_width=p['latch_inset']+p['latch_width']/2
    box('LatchMount', (plate_width,p['latch_height'],p['latch_plate_depth']),
        (leaf_w-plate_width/2,leaf_h/2,p['latch_plate_depth']/2),2,hinge)
    box('Latch', (p['latch_width'],p['latch_height'],p['latch_depth']),
        (leaf_w-p['latch_inset'],leaf_h/2,p['latch_depth']/2),2,hinge)
    node('grip_sash',hinge,(leaf_w-p['latch_inset'],leaf_h/2,p['latch_depth']))
    node('opening_bottom',at=(0,0,0))
    doc['buffers'][0]['byteLength']=len(binary)
    from model_contacts import write
    write(OUTPUT,doc,bytes(binary))
    print('MODEL_WRITTEN',OUTPUT)


if __name__ == '__main__':
    build()
