"""甲: fit the site plan's local grid (x east, y north) to scene metres (X east, Z south).
First guess from the road names (drawing 山大路 x~85572 = OSM 山大路 x~26; drawing 文化路 y~62720 =
OSM 文化西路 z~750); then trimmed ICP of the drawing's closed outlines (layer 地形) onto OSM
building outlines: rotation + shift, scale fitted too and reported. Writes raw/tender/align.json."""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree
from shapely.geometry import Polygon

HERE = Path(__file__).parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / 'godot/real_place'))
import osm  # noqa: E402
from geo import Site  # noqa: E402


def densify(pts, step=1.0):
    out = []
    for a, b in zip(pts[:-1], pts[1:]):
        n = max(1, int(np.hypot(*(b - a)) / step))
        out.append(a + (b - a) * np.linspace(0, 1, n, endpoint=False)[:, None])
    return np.concatenate(out) if out else pts


def fit_similarity(A, B):
    """B ~ s R A + t (Umeyama)."""
    ma, mb = A.mean(0), B.mean(0)
    a, b = A - ma, B - mb
    U, S, Vt = np.linalg.svd(b.T @ a / len(A))
    D = np.diag([1, np.sign(np.linalg.det(U @ Vt))])
    R = U @ D @ Vt
    s = (S * np.diag(D)).sum() / (a ** 2).sum() * len(A)
    return s, R, mb - s * R @ ma


def main():
    site = Site(ROOT / 'godot/scenes/sdu_weihai')
    W = osm.load_ways(ROOT / site.cfg['osm'], site)
    osm_pts = np.concatenate([densify(np.array(w['pts'])) for w in W if 'building' in w['tags'] and w['closed']])
    tree = cKDTree(osm_pts)
    d = json.loads((HERE / 'raw/tender/site_plan.json').read_text(encoding='utf-8'))
    src = []
    for l in d['lines']['地形'] + d['lines'].get('-建筑-现状', []):
        p = np.array(l['pts'])
        if len(p) >= 4 and (l['closed'] or np.hypot(*(p[0] - p[-1])) < .5):
            a = Polygon(p).area
            if 80 < a < 8000:
                src.append(densify(np.vstack([p, p[:1]])))
    S = np.concatenate(src)
    # drawing (x, y north) -> (x, z south): flip y
    P = np.column_stack([S[:, 0], -S[:, 1]])
    s, R, t = 1.0, np.eye(2), np.array([26 - 85572, 750 + 62720])
    for it, trim in enumerate([30, 30, 20, 15, 10, 8, 6, 5, 4, 4, 3, 3, 3, 3]):
        Q = (s * (R @ P.T)).T + t
        dist, idx = tree.query(Q)
        m = dist < trim
        s, R, t = fit_similarity(P[m], osm_pts[idx[m]])
        if it < 6:
            s = 1.0
            ma = P[m].mean(0)
            t = osm_pts[idx[m]].mean(0) - R @ ma
    Q = (s * (R @ P.T)).T + t
    dist, _ = tree.query(Q)
    ang = np.degrees(np.arctan2(R[1, 0], R[0, 0]))
    res = {'scale': s, 'rotation_deg': ang, 'R': R.tolist(), 't': t.tolist(), 'flip_y': True,
           'note': 'scene [x, z] = scale * R @ [x_d, -y_d] + t',
           'points_used': int((dist < 3).sum()), 'points_total': len(dist),
           'median_dist_m_of_used': float(np.median(dist[dist < 3])), 'share_within_2m': float((dist < 2).mean())}
    (HERE / 'raw/tender/align.json').write_text(json.dumps(res, indent=1), encoding='utf-8')
    print(json.dumps(res, indent=1))


def to_scene(xy, A=None):
    A = A or json.loads((HERE / 'raw/tender/align.json').read_text(encoding='utf-8'))
    xy = np.atleast_2d(np.asarray(xy, float))
    P = np.column_stack([xy[:, 0], -xy[:, 1]])
    return (A['scale'] * (np.array(A['R']) @ P.T)).T + np.array(A['t'])


if __name__ == '__main__':
    main()
