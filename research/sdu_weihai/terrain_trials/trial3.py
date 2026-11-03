"""Trial 3: the COLMAP point cloud -> top view, alignment to the scene, profiles.

Usage:
  python trial3.py top <model_txt_dir> <out.png>
      Levels the cloud (plane fitted to the densest layer = the ground), prints its frame and
      draws a top view with a grid in cloud units, for reading point positions off.
  python trial3.py align <model_txt_dir> <pairs.json> <out_prefix>
      pairs.json: {"pairs": [{"name", "cloud": [u, v], "scene": [x, z]}...], "flat": {"name", "cloud": [[u, v]...], "scene_y": m},
                   "profiles": [{"name", "from": [x, z], "to": [x, z]}...]}
      Fits scale, rotation and shift (top view), prints each pair's residual in metres, sets the
      height by the flat area, draws the cloud over the imagery and the profiles against FABDEM
      and terrain.bin.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'godot/real_place'))


def read_points(d):
    P, C = [], []
    for line in open(Path(d) / 'points3D.txt'):
        if line.startswith('#'):
            continue
        s = line.split()
        P.append([float(v) for v in s[1:4]])
        C.append([int(v) for v in s[4:7]])
    return np.array(P), np.array(C, np.uint8)


def read_cams(d):
    """Camera centres of the registered images, and the mean image-up direction (camera -Y) in the
    cloud's frame."""
    out, ups = [], []
    lines = [l for l in open(Path(d) / 'images.txt') if not l.startswith('#')]
    for l in lines[::2]:
        s = l.split()
        q = np.array([float(v) for v in s[1:5]])
        t = np.array([float(v) for v in s[5:8]])
        w, x, y, z = q
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        out.append(-R.T @ t)
        ups.append(-R[1])
    up = np.mean(ups, 0)
    return np.array(out), up / np.linalg.norm(up)


def level(P, cams, img_up):
    """A frame (origin, e_u, e_v, e_up). The drone flies forward and climbs, so its path lies in a
    vertical plane and "up" lies in that plane. Try every direction in it (and 20 deg either side):
    up is the one where the most points share one height layer (the ground) with every camera above
    that layer."""
    c = cams - cams.mean(0)
    _, _, Vt = np.linalg.svd(c)
    e1, e2, e3 = Vt
    dist = np.linalg.norm(P - np.median(P, 0), axis=1)
    P = P[dist < np.percentile(dist, 98)]
    tol = np.median(np.linalg.norm(P - P.mean(0), axis=1)) * 0.01
    best = None
    for tilt in np.radians(np.arange(-20, 21, 2)):
        for th in np.radians(np.arange(0, 360, 1)):
            n = np.cos(tilt) * (np.cos(th) * e1 + np.sin(th) * e2) + np.sin(tilt) * e3
            h = P @ n
            hist, edges = np.histogram(h, bins=np.arange(h.min(), h.max() + tol, tol))
            i = int(hist.argmax())
            g = (edges[i] + edges[i + 1]) / 2
            if np.percentile(cams @ n, 10) <= g:
                continue
            k = int(hist[max(0, i - 1):i + 2].sum())
            if best is None or k > best[0]:
                best = (k, n, g)
    k, n, g = best
    # refine: plane through the layer's points
    on = np.abs(P @ n - g) < 2 * tol
    Q = P[on]
    _, _, Vt = np.linalg.svd(Q - Q.mean(0))
    n2 = Vt[2] if Vt[2] @ n > 0 else -Vt[2]
    a = Q.mean(0)
    n = n2
    bn = int((np.abs((P - a) @ n) < tol).sum())
    u = np.cross(n, [0, 0, 1.0]); u /= np.linalg.norm(u)
    v = np.cross(n, u)
    return a, u, v, n, bn


def to_frame(P, fr):
    a, u, v, n, _ = fr
    Q = P - a
    return np.column_stack([Q @ u, Q @ v, Q @ n])


def draw_top(Q, C, out, cams=None, grid=None, size=1400):
    lo, hi = np.percentile(Q[:, :2], [1, 99], axis=0)
    span = (hi - lo).max() * 1.1
    c = (lo + hi) / 2
    k = size / span
    img = Image.new('RGB', (size, size), (255, 255, 255))
    px = ((Q[:, 0] - c[0]) * k + size / 2).astype(int)
    py = ((Q[:, 1] - c[1]) * k + size / 2).astype(int)
    ok = (px >= 0) & (px < size) & (py >= 0) & (py < size)
    arr = np.array(img)
    order = np.argsort(Q[ok, 2])
    arr[py[ok][order], px[ok][order]] = C[ok][order]
    img = Image.fromarray(arr)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype('arial.ttf', 14)
    grid = grid or 10 ** np.floor(np.log10(span / 8))
    g = np.floor((c[0] - span / 2) / grid) * grid
    while g < c[0] + span / 2:
        x = (g - c[0]) * k + size / 2
        d.line([(x, 0), (x, size)], fill=(200, 200, 0))
        d.text((x + 2, 2), f'{g:g}', fill=(120, 120, 0), font=font)
        g += grid
    g = np.floor((c[1] - span / 2) / grid) * grid
    while g < c[1] + span / 2:
        y = (g - c[1]) * k + size / 2
        d.line([(0, y), (size, y)], fill=(0, 200, 200))
        d.text((2, y + 2), f'{g:g}', fill=(0, 120, 120), font=font)
        g += grid
    if cams is not None:
        for q in cams:
            x, y = (q[0] - c[0]) * k + size / 2, (q[1] - c[1]) * k + size / 2
            d.ellipse([x - 3, y - 3, x + 3, y + 3], outline=(255, 0, 0))
    img.save(out)


def fit_similarity(A, B):
    """B ~ s R A + t (2D), least squares (Umeyama)."""
    ma, mb = A.mean(0), B.mean(0)
    A0, B0 = A - ma, B - mb
    U, S, Vt = np.linalg.svd(B0.T @ A0)
    D = np.eye(2)
    if np.linalg.det(U @ Vt) < 0:
        D[1, 1] = -1
    R = U @ D @ Vt
    s = (S * np.diag(D)).sum() / (A0 ** 2).sum()
    t = mb - s * R @ ma
    return s, R, t


def main():
    mode, d = sys.argv[1], sys.argv[2]
    P, C = read_points(d)
    cams, img_up = read_cams(d)
    fr = level(P, cams, img_up)
    Q = to_frame(P, fr)
    Qc = to_frame(cams, fr)
    print(f'points {len(P)}, cameras {len(cams)}, ground-plane inliers {fr[4]}')
    print(f'cameras above the plane: {np.percentile(Qc[:, 2], [0, 50, 100]).round(2)} (cloud units)')
    if mode == 'top':
        draw_top(Q, C, sys.argv[3], Qc)
        return
    cfg = json.loads(Path(sys.argv[3]).read_text(encoding='utf-8'))
    out = sys.argv[4]
    A = np.array([p['cloud'] for p in cfg['pairs']], float)
    B = np.array([p['scene'] for p in cfg['pairs']], float)
    s, R, t = fit_similarity(A, B)
    res = np.linalg.norm((s * (R @ A.T)).T + t - B, axis=1)
    ang = np.degrees(np.arctan2(R[1, 0], R[0, 0]))
    print(f'scale {s:.4f} m per cloud unit, rotation {ang:.1f} deg, shift {t.round(2)}')
    rows = []
    for p, r in zip(cfg['pairs'], res):
        print(f"  {p['name']}: residual {r:.2f} m")
        rows.append((p['name'], r))
    print(f'  RMS {np.sqrt((res ** 2).mean()):.2f} m')
    xz = (s * (R @ Q[:, :2].T)).T + t
    y = Q[:, 2] * s
    # the height datum: the flat area's cloud points, set to the scene height given for it
    fl = cfg['flat']
    from shapely.geometry import Polygon
    import shapely
    poly = Polygon(fl['cloud'])
    inside = shapely.contains_xy(poly, Q[:, 0], Q[:, 1])
    y0 = np.median(y[inside])
    y = y - y0 + fl['scene_y']
    print(f"height datum: {inside.sum()} points on {fl['name']}, spread (IQR) {np.subtract(*np.percentile(y[inside], [75, 25])):.2f} m")
    np.save(out + '_points.npy', np.column_stack([xz[:, 0], y, xz[:, 1]]))
    json.dump({'scale': s, 'rotation_deg': ang, 'shift': t.tolist(), 'y0': float(y0),
               'residuals_m': {n: round(float(r), 2) for n, r in rows}}, open(out + '_align.json', 'w'), indent=1)
    overlay(xz, C, cfg, out + '_overlay.png')
    profiles(xz, y, cfg, out)


def overlay(xz, C, cfg, out):
    from crop import crop
    lo, hi = np.percentile(xz, [2, 98], axis=0)
    x0, z0 = lo - 30
    x1, z1 = hi + 30
    img, mpp = crop(x0, z0, x1, z1, zoom=2)
    img = img.convert('RGB')
    k = img.width / (x1 - x0)
    d = ImageDraw.Draw(img)
    px = ((xz[:, 0] - x0) * k).astype(int)
    py = ((xz[:, 1] - z0) * k).astype(int)
    ok = (px >= 0) & (px < img.width) & (py >= 0) & (py < img.height)
    arr = np.array(img)
    arr[py[ok], px[ok]] = (255, 0, 255)
    img = Image.fromarray(arr)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype('arial.ttf', 16)
    for p in cfg['pairs']:
        x, z = p['scene']
        d.ellipse([(x - x0) * k - 6, (z - z0) * k - 6, (x - x0) * k + 6, (z - z0) * k + 6], outline=(0, 255, 0), width=3)
        d.text(((x - x0) * k + 8, (z - z0) * k - 8), p['name'], fill=(0, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    for pr in cfg.get('profiles', []):
        (xa, za), (xb, zb) = pr['from'], pr['to']
        d.line([((xa - x0) * k, (za - z0) * k), ((xb - x0) * k, (zb - z0) * k)], fill=(255, 255, 0), width=3)
        d.text(((xb - x0) * k + 6, (zb - z0) * k), pr['name'], fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    # coverage outline: grid cells with points
    step = 10
    gx = np.floor(xz[:, 0] / step).astype(int)
    gz = np.floor(xz[:, 1] / step).astype(int)
    for cx, cz in set(zip(gx.tolist(), gz.tolist())):
        X0, Z0 = cx * step, cz * step
        d.rectangle([(X0 - x0) * k, (Z0 - z0) * k, (X0 + step - x0) * k, (Z0 + step - z0) * k], outline=(0, 200, 255))
    d.text((8, img.height - 26), 'magenta: cloud points; blue squares: 10 m cells with points; green: alignment points; yellow: profiles',
           fill=(255, 255, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    img.save(out)


def profiles(xz, y, cfg, out):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from measure1 import fabdem_raw, terrain_bin
    import build_ground as bg
    from geo import Site
    site = Site(ROOT / 'godot/scenes/sdu_weihai')
    for pr in cfg.get('profiles', []):
        a, b = np.array(pr['from'], float), np.array(pr['to'], float)
        L = np.linalg.norm(b - a)
        dirn = (b - a) / L
        nrm = np.array([-dirn[1], dirn[0]])
        rel = xz - a
        along = rel @ dirn
        off = rel @ nrm
        sel = (along >= 0) & (along <= L) & (np.abs(off) < pr.get('half_width_m', 3))
        s = np.linspace(0, L, int(L) + 1)
        pts = a + np.outer(s, dirn)
        tb = [terrain_bin(x, z) for x, z in pts]
        R = bg.Raster(float(pts[:, 0].min()) - 40, float(pts[:, 1].min()) - 40, 1.0,
                      int(np.ptp(pts[:, 0])) + 81, int(np.ptp(pts[:, 1])) + 81)
        fab_bicubic = R.sample(bg.load_dem(site, ROOT / site.cfg['dem'], R), pts[:, 0], pts[:, 1])
        fab_raw = [fabdem_raw(x, z)[0] for x, z in pts]
        bins = np.arange(0, L + 2, 2)
        idx = np.digitize(along[sel], bins)
        med = [np.median(y[sel][idx == i]) if (idx == i).sum() >= 3 else np.nan for i in range(1, len(bins))]
        fig, ax = plt.subplots(figsize=(10, 4.5))
        ax.scatter(along[sel], y[sel], s=2, c='#bbbbbb', label=f'cloud points within {pr.get("half_width_m", 3)} m')
        ax.plot(bins[:-1] + 1, med, 'k-', lw=2, label='cloud, median per 2 m')
        ax.plot(s, fab_raw, color='tab:orange', drawstyle='steps-mid', label='FABDEM samples (30 m)')
        ax.plot(s, fab_bicubic, color='tab:orange', ls='--', label='FABDEM interpolated')
        ax.plot(s, tb, color='tab:blue', label='terrain.bin (stage 1)')
        ax.set_xlabel(f"metres along {pr['name']}  ({a.tolist()} -> {b.tolist()})")
        ax.set_ylabel('height m')
        ax.legend(fontsize=8)
        ax.grid(alpha=.3)
        fig.tight_layout()
        fig.savefig(f"{out}_profile_{pr['name']}.png", dpi=110)
        print(f"profile {pr['name']}: {sel.sum()} points")


if __name__ == '__main__':
    main()
