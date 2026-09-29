"""Minimal glTF binary writer: named nodes, one mesh each, one primitive per material (named by slot)."""
import json
import struct

import numpy as np


def write(path, parts):
    """parts: [(node_name, [(material_name, vertices (N,3), normals (N,3), triangles (M,3)), ...])].
    Surfaces of one node form one mesh: the ink lines treat edges between them as inner edges."""
    blob = bytearray()
    views, access, meshes, nodes, mats = [], [], [], [], {}

    def pack(arr, component, typ, target, bounds=False):
        arr = np.ascontiguousarray(arr)
        off = len(blob)
        raw = arr.tobytes()
        blob.extend(raw)
        while len(blob) % 4:
            blob.append(0)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw), 'target': target})
        item = {'bufferView': len(views) - 1, 'componentType': component, 'count': len(arr), 'type': typ}
        if bounds:
            item.update(min=arr.min(0).tolist(), max=arr.max(0).tolist())
        access.append(item)
        return len(access) - 1

    for name, surfaces in parts:
        prims = []
        for mat, v, n, t in surfaces:
            if mat not in mats:
                mats[mat] = len(mats)
            pos = pack(v.astype('<f4'), 5126, 'VEC3', 34962, True)
            nor = pack(n.astype('<f4'), 5126, 'VEC3', 34962)
            idx = pack(t.astype('<u4').reshape(-1), 5125, 'SCALAR', 34963)
            prims.append({'attributes': {'POSITION': pos, 'NORMAL': nor}, 'indices': idx, 'material': mats[mat]})
        meshes.append({'name': name, 'primitives': prims})
        nodes.append({'name': name, 'mesh': len(meshes) - 1})
    doc = {'asset': {'version': '2.0', 'generator': 'real_place'},
           'buffers': [{'byteLength': len(blob)}], 'bufferViews': views, 'accessors': access,
           'materials': [{'name': m, 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 1}} for m in mats],
           'meshes': meshes, 'nodes': nodes, 'scenes': [{'nodes': list(range(len(nodes)))}], 'scene': 0}
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    body = struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(blob), b'BIN\0') + blob
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, len(body) + 12) + body)
