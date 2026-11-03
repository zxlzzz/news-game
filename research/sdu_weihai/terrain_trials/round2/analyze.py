"""Checks and pictures for round 2: the rule terrain (raw/terrain_rules.bin, gen_terrain.py) against
FABDEM, the scene's terrain.bin and the drawing points (raw/points_all.json, points.py).

Usage: python analyze.py     writes fig/*.png, points.csv, stats.json
"""
import csv
import json
import sys
from pathlib import Path

import matplotlib
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.colors import ListedColormap  # noqa: E402

HERE = Path(__file__).parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'godot/real_place'))
import build_ground as bg  # noqa: E402
from gen_terrain import CLASS, RULES  # noqa: E402

FIG = HERE / 'fig'
Image.MAX_IMAGE_PIXELS = None
plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei']
plt.rcParams['axes.unicode_minus'] = False
BOX = RULES['mass_box_m']
PROFILES = [  # name, (x0, z0), (x1, z1)
    ('中轴 南北 x=22', (22, -520), (22, 780)),
    ('东西 z=237（穿过对照区A）', (-450, 237), (450, 237)),
    ('东西 z=420（穿过中轴南八角广场）', (-450, 420), (550, 420)),
]
AREA_A = (20, 212, 20, 262)
CLS_COL = {'grass_bank': (0.35, 0.68, 0.30), 'steps': (0.15, 0.35, 0.90), 'wall': (0.85, 0.12, 0.12)}


def grid(path, j, dtype='<f4'):
    return np.fromfile(path, dtype).reshape(j['height'], j['width'])


def hillshade(H, alt=40):
    """Lit from the north-west (scene -X, -Z), alt degrees up; 1 m cells."""
    gz, gx = np.gradient(H)
    e = np.radians(alt)
    lx, ly, lz = -np.cos(e) * np.sin(np.pi / 4), np.sin(e), -np.cos(e) * np.cos(np.pi / 4)
    return np.clip((-gx * lx + ly - gz * lz) / np.sqrt(gx ** 2 + gz ** 2 + 1), 0, 1)


def imagery(x0, z0, x1, z1, px_per_m=1.0):
    meta = json.loads((ROOT / 'research/sdu_weihai/imagery/site.json').read_text(encoding='utf-8'))
    im = Image.open(ROOT / 'research/sdu_weihai/imagery/site.jpg')
    mpp, (ox, oz) = meta['metres_per_px'], meta['origin_xz']
    c = im.crop(tuple(round(v) for v in ((x0 - ox) / mpp, (z0 - oz) / mpp, (x1 - ox) / mpp, (z1 - oz) / mpp)))
    return np.asarray(c.convert('L').resize((int((x1 - x0) * px_per_m), int((z1 - z0) * px_per_m)), Image.BILINEAR))


def main():
    FIG.mkdir(exist_ok=True)
    Image.MAX_IMAGE_PIXELS = None
    j = json.loads((HERE / 'raw/terrain_rules.json').read_text())
    tj = json.loads((ROOT / 'godot/scenes/sdu_weihai/terrain.json').read_text())
    assert (j['x0'], j['z0'], j['width'], j['height']) == (tj['x0'], tj['z0'], tj['width'], tj['height'])
    new = grid(HERE / 'raw/terrain_rules.bin', j)
    old = grid(ROOT / 'godot/scenes/sdu_weihai/terrain.bin', j)
    cls = grid(HERE / 'raw/drop_class.bin', j, 'u1')
    drop = grid(HERE / 'raw/drop_m.bin', j)
    ex = np.load(HERE / 'raw/gen_extra.npy', allow_pickle=True).item()
    F, ia, lab, kinds = ex['F'], ex['in_area'], ex['lab'], ex['kinds']
    R = bg.Raster(j['x0'], j['z0'], j['cell'], j['width'], j['height'])
    x0, z0, W, Hh = j['x0'], j['z0'], j['width'], j['height']
    ext = (x0, x0 + W, z0 + Hh, z0)
    stats = {}

    # ------------------------------------------------ 60 m check
    core = ndi.binary_erosion(ia, iterations=BOX // 2)
    tF = ndi.uniform_filter(F, BOX, mode='nearest')
    X, Z = np.meshgrid(x0 + np.arange(W) + .5, z0 + np.arange(Hh) + .5)
    piece = lab >= 0
    for name, T in (('old', old), ('new', new)):
        d = ndi.uniform_filter(T, BOX, mode='nearest') - tF
        i = np.unravel_index(np.argmax(np.where(core, np.abs(d), -1)), d.shape)
        l = lab[i]
        what = kinds[l] if l >= 0 else 'open ground'
        stats[f'box{BOX}_{name}'] = {'mean_diff_m': float(d[core].mean()), 'mean_abs_m': float(np.abs(d[core]).mean()),
                                     'p95_abs_m': float(np.percentile(np.abs(d[core]), 95)), 'max_abs_m': float(np.abs(d[i])),
                                     'max_at_xz': [float(X[i]), float(Z[i])], 'max_on': str(what),
                                     'max_abs_open_ground_m': float(np.abs(d[core & ~piece]).max()),
                                     'cells': int(core.sum())}
    fig, ax = plt.subplots(1, 2, figsize=(14, 9))
    for a, (name, T) in zip(ax, (('旧地形 terrain.bin', old), ('新地形（按规则）', new))):
        d = ndi.uniform_filter(T, BOX, mode='nearest') - tF
        m = a.imshow(np.where(core, d, np.nan), cmap='RdBu_r', vmin=-2, vmax=2, extent=ext)
        a.set_title(f'{name}：{BOX} m 平均 − FABDEM {BOX} m 平均（m）')
        a.set_xlabel('X（东，m）')
        a.set_ylabel('Z（南，m）')
    fig.colorbar(m, ax=ax, shrink=.6)
    fig.savefig(FIG / 'mass_check.png', dpi=110, bbox_inches='tight')
    plt.close(fig)

    # ------------------------------------------------ hillshade, slope
    fig, ax = plt.subplots(1, 2, figsize=(16, 11))
    for a, (name, T) in zip(ax, (('旧地形 terrain.bin', old), ('新地形（按规则）', new))):
        hs = hillshade(T)
        hs = np.where(ia, hs, 0.5 + 0.5 * hs)
        a.imshow(hs, cmap='gray', vmin=0, vmax=1, extent=ext, interpolation='bilinear')
        a.set_title(name)
        a.set_xlabel('X（东，m）')
    ax[0].set_ylabel('Z（南，m）')
    fig.suptitle('山影图（光从西北来，高 40°；可走范围外变淡）')
    fig.savefig(FIG / 'hillshade.png', dpi=110, bbox_inches='tight')
    plt.close(fig)
    # zoom: axis and area A
    sl = (slice(int(80 - z0), int(480 - z0)), slice(int(-200 - x0), int(250 - x0)))
    zext = (-200, 250, 480, 80)
    fig, ax = plt.subplots(1, 2, figsize=(16, 7.5))
    for a, (name, T) in zip(ax, (('旧地形', old), ('新地形', new))):
        a.imshow(hillshade(T)[sl], cmap='gray', vmin=0, vmax=1, extent=zext)
        a.plot([AREA_A[0], AREA_A[2]], [AREA_A[1], AREA_A[3]], 'r-', lw=2)
        a.set_title(f'{name}：中轴北段放大（红线=对照区A）')
    fig.savefig(FIG / 'hillshade_axis.png', dpi=110, bbox_inches='tight')
    plt.close(fig)

    bounds = [0, .05, .08, RULES['bank_gentle'], RULES['bank_max'], 1e9]
    cmap = ListedColormap(['#f2f2f2', '#b9d7ea', '#5b9bd5', '#f4a261', '#c1121f'])
    fig, ax = plt.subplots(1, 2, figsize=(16, 11))
    for a, (name, T) in zip(ax, (('旧地形 terrain.bin', old), ('新地形（按规则）', new))):
        gz, gx = np.gradient(T)
        s = np.hypot(gx, gz)
        k = np.digitize(s, bounds[1:-1])
        a.imshow(np.where(ia, k, np.nan), cmap=cmap, vmin=-.5, vmax=4.5, extent=ext, interpolation='nearest')
        a.set_title(name)
    labels = ['<5%', '5–8%', '8–20%', '20–67%', '>67%（陡坎/墙）']
    from matplotlib.patches import Patch
    fig.legend([Patch(color=c) for c in cmap.colors], labels, loc='lower center', ncol=5)
    fig.suptitle('坡度图（分档：5%、8% 见 CJJ 83 4.0.3；20% 见 GB 51192 5.1.5；67% 见 CJJ 83 8.0.5）')
    fig.savefig(FIG / 'slope.png', dpi=110, bbox_inches='tight')
    plt.close(fig)

    # ------------------------------------------------ points (甲) and comparison
    P = json.loads((HERE / 'raw/points_all.json').read_text(encoding='utf-8'))['points']
    pts = [p for p in P if p['in_campus']]
    xz = np.array([(p['x'], p['z']) for p in pts])
    h = np.array([p['h'] for p in pts])
    vals = {n: R.sample(T, xz[:, 0], xz[:, 1]) for n, T in (('FABDEM', F), ('old', old), ('new', new))}
    survey = np.array([p['kind'] == '测量高程点' and not p['in_2019_lot'] for p in pts])
    design = np.array([p['kind'] != '测量高程点' and p['in_2019_lot'] for p in pts])
    design_out = np.array([p['kind'] != '测量高程点' and not p['in_2019_lot'] for p in pts])
    groups = {'survey_outside_2019_lot': survey, 'design_inside_2019_lot': design, 'design_outside_2019_lot': design_out}
    cmp = {}
    for g, m in groups.items():
        cmp[g] = {'n': int(m.sum())}
        if m.sum() == 0:
            continue
        for n, v in vals.items():
            r = h[m] - v[m]
            shift = float(np.median(r))
            res = r - shift
            # small-scale part only: each value less the mean of the group's values within 60 m of it
            tree_idx = [np.nonzero(np.hypot(*(xz[m] - q).T) < BOX / 2)[0] for q in xz[m]]
            hs = np.array([h[m][i] - h[m][ii].mean() for i, ii in enumerate(tree_idx)])
            vs = np.array([v[m][i] - v[m][ii].mean() for i, ii in enumerate(tree_idx)])
            cmp[g][n] = {'shift_m': shift, 'mean_abs_after_shift_m': float(np.abs(res).mean()),
                         'rms_after_shift_m': float(np.sqrt((res ** 2).mean())), 'p90_abs_m': float(np.percentile(np.abs(res), 90)),
                         'max_abs_m': float(np.abs(res).max()),
                         'small_scale_rms_m': float(np.sqrt(((hs - vs) ** 2).mean())),
                         'small_scale_point_spread_m': float(hs.std()), 'small_scale_terrain_spread_m': float(vs.std())}
    stats['points'] = cmp
    shifts = {n: cmp['survey_outside_2019_lot'][n]['shift_m'] for n in vals}
    with open(HERE / 'points.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['类别', '来源文件', '文件里的位置', '原文数字', '高程(1985黄海,m)', '场景X', '场景Z', '位置怎么定的', '在校园范围', '在2019楼址内',
                    'FABDEM', '旧地形', '新地形', f'差:点-FABDEM-({shifts["FABDEM"]:+.2f})', f'差:点-旧-({shifts["old"]:+.2f})', f'差:点-新-({shifts["new"]:+.2f})'])
        allxz = np.array([(p['x'], p['z']) for p in P])
        av = {n: R.sample(T, allxz[:, 0], allxz[:, 1]) for n, T in (('FABDEM', F), ('old', old), ('new', new))}
        for i, p in enumerate(P):
            inside = X.min() <= p['x'] <= X.max() and Z.min() <= p['z'] <= Z.max()
            row = [p['kind'], p['file'], p['where_in_file'], p['raw'], p['h'], p['x'], p['z'], p['how'], p['in_campus'], p['in_2019_lot']]
            if inside:
                row += [round(float(av[n][i]), 2) for n in ('FABDEM', 'old', 'new')]
                row += [round(float(p['h'] - av[n][i] - shifts[n]), 2) for n in ('FABDEM', 'old', 'new')]
            else:
                row += [''] * 6
            w.writerow(row)

    # map of the points on the imagery
    bx = (-420, 180, 660, 820)
    img = imagery(*bx, px_per_m=1)
    fig, ax = plt.subplots(figsize=(15, 9))
    ax.imshow(img, cmap='gray', extent=(bx[0], bx[2], bx[3], bx[1]))
    allp = np.array([(p['x'], p['z']) for p in P])
    kind = np.array([p['kind'] for p in P])
    m = kind == '测量高程点'
    sc = ax.scatter(allp[m, 0], allp[m, 1], c=[p['h'] for p, k in zip(P, m) if k], s=5, cmap='viridis', vmin=2, vmax=10, label='测量高程点（地形图）')
    ax.scatter(allp[kind == '设计检查井井盖', 0], allp[kind == '设计检查井井盖', 1], marker='s', s=18, facecolors='none', edgecolors='r', label='设计检查井井盖')
    mm = np.isin(kind, ['设计室外标高', '设计场地标高'])
    ax.scatter(allp[mm, 0], allp[mm, 1], marker='^', s=26, facecolors='none', edgecolors='orange', label='设计室外/场地标高')
    mm = np.isin(kind, ['设计室内标高', '设计室内±0.000'])
    ax.scatter(allp[mm, 0], allp[mm, 1], marker='D', s=26, facecolors='none', edgecolors='magenta', label='设计室内标高 / ±0.000')
    lot = np.array(json.loads((HERE / 'raw/points_all.json').read_text(encoding='utf-8'))['lot_2019'])
    ax.plot(lot[:, 0], lot[:, 1], 'c-', lw=1.5, label='2019 科研楼楼址（土地证范围）')
    ax.plot([AREA_A[0], AREA_A[2]], [AREA_A[1], AREA_A[3]], 'r-', lw=3, label='对照区A')
    ax.set_xlim(bx[0], bx[2])
    ax.set_ylim(bx[3], bx[1])
    fig.colorbar(sc, ax=ax, shrink=.6, label='测量高程（1985黄海，m）')
    ax.legend(loc='lower left', fontsize=8)
    ax.set_title('甲：两张公开施工图里的高程点，落在场景坐标上（X 东，Z 南，m）')
    fig.savefig(FIG / 'points_map.png', dpi=110, bbox_inches='tight')
    plt.close(fig)

    # ------------------------------------------------ profiles
    fig, axs = plt.subplots(3, 1, figsize=(16, 15))
    for a, (name, p0, p1) in zip(axs, PROFILES):
        L = np.hypot(p1[0] - p0[0], p1[1] - p0[1])
        t = np.linspace(0, 1, int(L))
        px, pz = p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1])
        s = t * L + (p0[1] if p0[0] == p1[0] else p0[0])
        for T, lbl, st in ((F, 'FABDEM（双三次插值）', dict(color='0.55', lw=1.5, ls='--')), (old, '旧地形 terrain.bin', dict(color='tab:blue', lw=1)),
                           (new, '新地形（按规则）', dict(color='k', lw=1.3))):
            a.plot(s, R.sample(T, px, pz), label=lbl, **st)
        c = R.sample(cls.astype(float), px, pz, order=0).astype(int)
        yb = a.get_ylim()
        for nm, v in CLASS.items():
            if nm in CLS_COL:
                mk = c == v
                a.scatter(s[mk], R.sample(new, px[mk], pz[mk]), s=8, color=CLS_COL[nm], zorder=5,
                          label={'grass_bank': '草坡', 'steps': '台阶', 'wall': '挡土墙'}[nm])
        # survey points within 4 m of the line, shifted into FABDEM's datum
        dx, dz = p1[0] - p0[0], p1[1] - p0[1]
        u = ((allp[:, 0] - p0[0]) * dx + (allp[:, 1] - p0[1]) * dz) / L ** 2
        dist = np.abs((allp[:, 0] - p0[0]) * dz - (allp[:, 1] - p0[1]) * dx) / L
        mk = (dist < 4) & (u >= 0) & (u <= 1) & np.array([p['in_campus'] for p in P])
        if mk.any():
            a.scatter(u[mk] * L + (p0[1] if p0[0] == p1[0] else p0[0]), np.array([p['h'] for p in P])[mk] - shifts['FABDEM'], s=22,
                      marker='x', color='m', zorder=6, label=f'甲的点（离线 4 m 内，整体平移 {-shifts["FABDEM"]:+.2f} m）')
        inarea = R.sample(ia.astype(float), px, pz, order=0) > .5
        a.fill_between(s, *a.get_ylim(), where=~inarea, color='0.92', zorder=0, label='可走范围外')
        a.set_title(name)
        a.set_xlabel('Z（南，m）' if p0[0] == p1[0] else 'X（东，m）')
        a.set_ylabel('高程（m）')
        a.legend(fontsize=8, ncol=4)
        a.grid(alpha=.3)
    fig.savefig(FIG / 'profiles.png', dpi=110, bbox_inches='tight')
    plt.close(fig)

    # ------------------------------------------------ class map over imagery
    bx = (x0, z0, x0 + W, z0 + Hh)
    img = imagery(*bx, px_per_m=1)
    rgba = np.zeros((Hh, W, 4))
    for nm, v in CLASS.items():
        if nm in CLS_COL:
            rgba[cls == v] = (*CLS_COL[nm], 1)
    for sub, (a0, b0, a1, b1), fn in ((False, bx, 'drop_class_map.png'), (True, (-200, 80, 250, 480), 'drop_class_axis.png')):
        fig, ax = plt.subplots(figsize=(12, 14) if not sub else (13, 11.5))
        ax.imshow(img, cmap='gray', extent=ext, alpha=.8)
        ax.imshow(rgba, extent=ext, interpolation='nearest')
        cont = ax.contour(X[::2, ::2], Z[::2, ::2], ia[::2, ::2].astype(float), [.5], colors='y', linewidths=.8)
        ax.set_xlim(a0, a1)
        ax.set_ylim(b1, b0)
        if sub:
            ax.plot([AREA_A[0], AREA_A[2]], [AREA_A[1], AREA_A[3]], 'm-', lw=2)
        from matplotlib.patches import Patch
        ax.legend([Patch(color=CLS_COL[k]) for k in ('grass_bank', 'steps', 'wall')] + [Patch(color='y')],
                  ['草坡', '台阶', '挡土墙', '可走范围边界'], loc='lower left')
        ax.set_title('落差分类（落差至少一级台阶 0.15 m）' + ('：中轴北段放大，紫线=对照区A' if sub else ''))
        fig.savefig(FIG / fn, dpi=110 if not sub else 120, bbox_inches='tight')
        plt.close(fig)
    stats['classes_cells_in_area'] = {k: int(((cls == v) & ia).sum()) for k, v in CLASS.items()}
    for nm in ('steps', 'wall'):
        v = drop[(cls == CLASS[nm]) & ia]
        stats[f'{nm}_drop_m'] = {'p10': float(np.percentile(v, 10)), 'median': float(np.median(v)), 'p90': float(np.percentile(v, 90)), 'max': float(v.max())} if len(v) else {}

    # ------------------------------------------------ area A
    zs = np.arange(150, 330)
    for nm, T in (('FABDEM', F), ('old', old), ('new', new)):
        stats.setdefault('area_A', {})[nm] = [round(float(v), 2) for v in R.sample(T, np.full(len(zs), 20.0), zs.astype(float))]
    stats['area_A']['z'] = zs.tolist()
    stats['area_A']['class'] = R.sample(cls.astype(float), np.full(len(zs), 20.0), zs.astype(float), order=0).astype(int).tolist()
    stats['area_A']['drop'] = [round(float(v), 2) for v in R.sample(drop, np.full(len(zs), 20.0), zs.astype(float), order=0)]
    stats['area_A']['label'] = [str(kinds[l]) if l >= 0 else 'open' for l in lab[(zs - int(z0)).astype(int), int(20 - x0)]]
    (HERE / 'stats.json').write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({k: v for k, v in stats.items() if k != 'area_A'}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
