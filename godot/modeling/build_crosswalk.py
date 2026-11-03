"""Self-contained deterministic GLB + embedded alpha PNG, Python standard library only.
Run: python godot/modeling/build_crosswalk.py. No external assets or sidecar textures.
"""
from pathlib import Path
import json
import struct
import zlib

OUTPUT = Path(__file__).resolve().parents[1] / 'models' / 'crosswalk.glb'
WIDTH, LENGTH, LIFT = 4.5, 6.0, 0.003
STRIPE_COUNT, STRIPE_W = 5, 0.50
TEXTURE_W, TEXTURE_H = 900, 32
ALPHA_CUTOFF = 0.5
STRIPE_PITCH = WIDTH / STRIPE_COUNT


def png():
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    row = bytearray([0])
    for i in range(TEXTURE_W):
        x = (i + 0.5) / TEXTURE_W * WIDTH
        visible = abs((x % STRIPE_PITCH) - STRIPE_PITCH / 2) <= STRIPE_W / 2
        row.extend((255, 255, 255, 255 if visible else 0))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', TEXTURE_W, TEXTURE_H, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(row) * TEXTURE_H, 9)) + chunk(b'IEND', b''))


def build():
    binary, views, accessors = bytearray(), [], []
    def block(data, target=None):
        binary.extend(b'\x00' * (-len(binary) % 4))
        view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)}
        if target:
            view['target'] = target
        views.append(view)
        binary.extend(data)
        return len(views) - 1
    def array(values, fmt, count, shape, bounds=None, target=34962):
        v = block(struct.pack('<' + fmt * len(values), *values), target)
        a = {'bufferView': v, 'componentType': 5126 if fmt == 'f' else 5123, 'count': count, 'type': shape}
        if bounds:
            a['min'], a['max'] = bounds
        accessors.append(a)
        return len(accessors) - 1
    x, z = WIDTH / 2, LENGTH / 2
    p = array([-x, LIFT, -z, -x, LIFT, z, x, LIFT, z, x, LIFT, -z], 'f', 4, 'VEC3',
              ([-x, LIFT, -z], [x, LIFT, z]))
    n = array([0, 1, 0] * 4, 'f', 4, 'VEC3')
    uv = array([0, 0, 0, 1, 1, 1, 1, 0], 'f', 4, 'VEC2')
    idx = array([0, 1, 2, 0, 2, 3], 'H', 6, 'SCALAR', target=34963)
    image_view = block(png())
    doc = {
        'asset': {'version': '2.0', 'generator': 'build_crosswalk.py'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'crosswalk', 'mesh': 0}],
        'meshes': [{'name': 'alpha_decal', 'primitives': [{'attributes': {'POSITION': p, 'NORMAL': n, 'TEXCOORD_0': uv}, 'indices': idx, 'material': 0}]}],
        'materials': [{'name': 'paint', 'alphaMode': 'MASK', 'alphaCutoff': ALPHA_CUTOFF,
                       'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1}}],
        'textures': [{'sampler': 0, 'source': 0}],
        'samplers': [{'magFilter': 9728, 'minFilter': 9728, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': image_view, 'mimeType': 'image/png'}],
        'bufferViews': views, 'accessors': accessors, 'buffers': [{'byteLength': len(binary)}],
    }
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    binary.extend(b'\x00' * (-len(binary) % 4))
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(data) + 8 + len(binary))
    glb += struct.pack('<II', len(data), 0x4E4F534A) + data
    glb += struct.pack('<II', len(binary), 0x004E4942) + binary
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(glb)
    print('MODEL_WRITTEN', OUTPUT)


if __name__ == '__main__':
    build()
