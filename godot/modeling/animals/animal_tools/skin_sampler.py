"""Independent glTF TRS/FK sampling and complete skin deformation for checks.

Runtime contact uses every unique imported vertex directly; no generated probe
data is required. These helpers evaluate the original GLB independently.
"""
import sys
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation, Slerp

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from glb import GLB


def sample(g, animation, times):
    nodes = g.d['nodes']
    t = np.tile([n.get('translation', [0, 0, 0]) for n in nodes], (len(times), 1, 1)).astype(float)
    q = np.tile([n.get('rotation', [0, 0, 0, 1]) for n in nodes], (len(times), 1, 1)).astype(float)
    scale = np.tile([n.get('scale', [1, 1, 1]) for n in nodes], (len(times), 1, 1)).astype(float)
    for channel in animation['channels']:
        sampler = animation['samplers'][channel['sampler']]
        keys = g.accessor(sampler['input']).ravel()
        values = g.accessor(sampler['output']).astype(float)
        at = np.clip(times, keys[0], keys[-1])
        target = channel['target']
        if target['path'] == 'rotation':
            q[:, target['node']] = Slerp(keys, Rotation.from_quat(values))(at).as_quat() if len(keys) > 1 else values[0]
        else:
            dest = t if target['path'] == 'translation' else scale
            dest[:, target['node']] = np.stack([np.interp(at, keys, values[:, j]) for j in range(3)], axis=-1)
    local = np.zeros((*t.shape[:-1], 4, 4))
    local[..., 3, 3] = 1
    local[..., :3, 3] = t
    local[..., :3, :3] = Rotation.from_quat(q.reshape(-1, 4)).as_matrix().reshape(*q.shape[:-1], 3, 3) * scale[..., None, :]
    world = np.zeros_like(local)
    done = set()

    def fill(i):
        if i in done:
            return
        if 'matrix' in nodes[i]:
            local[:, i] = np.array(nodes[i]['matrix']).reshape(4, 4).T
        if i in g.parents:
            fill(g.parents[i])
            world[:, i] = world[:, g.parents[i]] @ local[:, i]
        else:
            world[:, i] = local[:, i]
        done.add(i)

    for i in range(len(nodes)):
        fill(i)
    return world


def mesh_data(g):
    attrs = g.d['meshes'][0]['primitives'][0]['attributes']
    points = np.c_[g.accessor(attrs['POSITION']), np.ones(g.d['accessors'][attrs['POSITION']]['count'])]
    weights = g.accessor(attrs['WEIGHTS_0'])
    ids = g.accessor(attrs['JOINTS_0']).astype(int)
    joints = g.d['skins'][0]['joints']
    inverse = g.accessor(g.d['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    return points, weights, ids, joints, inverse


def skin(data, world):
    points, weights, ids, joints, inverse = data
    result = np.empty((len(world), len(points), 3))
    for start in range(0, len(world), 8):
        deform = world[start:start + 8, joints] @ inverse
        result[start:start + 8] = np.einsum('fnkij,nj,nk->fni', deform[:, ids], points, weights)[..., :3]
    return result
