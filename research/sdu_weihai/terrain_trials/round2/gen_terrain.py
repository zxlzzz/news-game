"""乙: small-scale ground by design rules on top of the FABDEM relief (trial, not the scene).

Usage: python gen_terrain.py            (writes raw/terrain_rules.bin/.json, raw/drop_class.bin/.json, raw/drop_m.bin)

Same raster as godot/scenes/sdu_weihai/terrain.json (built the same way as build_ground.main).
The numbers are in RULES below, each with where it comes from (report: round2/报告.md, 乙).

What it does, on the DEM F plus a smooth correction C (see the end):
  pieces   flat: pitches, building pads, the hand-traced platforms (ground.json), OSM plaza areas,
           lakes (water level + stone edge as in build_ground); a building's floor stands
           floor_above_ground_m above its ground level. Roads: level across; along, the DEM
           smoothed along the line and kept within the grade limit; walkways steeper than the
           walkway limit become steps (up to the stair slope).
  open     ground that is none of these follows F + C. Next to a piece it starts at the piece's
           level and ramps to F + C: a grass bank at the gentle slope where there is room, steeper
           (up to the soil-bank limit) where the gap is narrower, and where even that does not fit
           the rest of the drop stands as a step half way across the gap. Drops above the bank
           limit put the part above it into a wall at the piece's edge.
  classes  every drop of at least one step height: grass bank, steps (both sides walkable), wall.
  mass     the rules move drops about; they must not make any on the ~60 m scale: C is updated
           until the 60 m box mean of the result matches that of F, on open ground only, which is
           kept within the DEM's own range over the same box. No smoothing at the end.
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
import shapely
from scipy import ndimage as ndi
from shapely.geometry import Polygon
from shapely.ops import unary_union

HERE = Path(__file__).parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / 'godot/real_place'))
import build_ground as bg  # noqa: E402  (read-only use of its data helpers)
import osm  # noqa: E402
from geo import Site  # noqa: E402

SCENE = ROOT / 'godot/scenes/sdu_weihai'
OUT = HERE / 'raw'
T0 = time.time()

RULES = {
    'road_grade_max': 0.08,        # GB 50352-2019 5.3.2-1 基地内机动车道纵坡不应大于8%
    'special_segment_m': 100,      # GB 50352-2019 5.3.2-1 个别特殊路段…坡长不应大于100 m; 5.3.2-5 山地可适当放宽
    'walk_grade_max': 0.08,        # GB 50352-2019 5.3.2-3 步行道纵坡不应大于8%，大于极限坡度时设置为台阶步道
    'stair_slope': 0.5,            # GB 50352-2019 6.7.1-1 踏步宽不宜小于0.3 m、高不宜大于0.15 m -> 0.15/0.30
    'step_height_m': 0.15,         # same clause: one step; smaller drops are not counted as drops
    'bank_gentle': 0.20,           # GB 51192-2016 5.1.5 绿地适宜坡度宜为5%~20% (upper end)
    'bank_max': 0.67,              # CJJ 83-2016 8.0.5 土质护坡的坡比值不应大于0.67
    'bank_max_drop_m': 3.0,        # CJJ 83-2016 8.0.5 高差1.5~3.0 m宜护坡；大于或等于3.0 m宜挡土墙结合放坡
    'floor_above_ground_m': 0.15,  # GB 50037-2013 3.1.5 底层地面标高宜高出室外地面150 mm
    'mass_box_m': 60,              # task: equal to FABDEM when averaged over ~60 m
    'mass_iterations': 12,
}
CLASS = {'none': 0, 'grass_bank': 1, 'steps': 2, 'wall': 3}
WALKABLE = {'road', 'plaza', 'platform'}


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


def setup():
    """Site, raster and flat pieces exactly as build_ground.main sets them up."""
    site = Site(SCENE)
    P = json.loads((SCENE / 'ground.json').read_text(encoding='utf-8'))
    ways = osm.load_ways(ROOT / site.cfg['osm'], site)
    k, v = P['area']['osm_tag']
    campus = [w for w in ways if w['tags'].get(k) == v and w['closed']]
    area = Polygon(campus[0]['pts']).buffer(P['area']['buffer_m'], join_style='round')
    rc = P['roads']
    roads = bg.road_network(ways, rc, area.buffer(60))
    area = bg.only_polys(unary_union([area] + [line.intersection(area).buffer(w / 2, cap_style='flat') for line, w in roads]))
    res = P['raster_m']
    bx0, bz0, bx1, bz1 = area.bounds
    x0, z0 = np.floor(bx0 / res) * res - 20, np.floor(bz0 / res) * res - 20
    R = bg.Raster(x0, z0, res, int(np.ceil((bx1 - x0 + 20) / res)), int(np.ceil((bz1 - z0 + 20) / res)))
    tj = json.loads((SCENE / 'terrain.json').read_text())
    if (R.x0, R.z0, R.w, R.h) != (tj['x0'], tj['z0'], tj['width'], tj['height']):
        raise SystemExit(f'raster differs from terrain.json: {(R.x0, R.z0, R.w, R.h)}')
    F = bg.load_dem(site, ROOT / site.cfg['dem'], R)
    polys = {w['id']: Polygon(w['pts']) for w in ways if w['closed']}
    pieces = []   # (kind, geom, extra); later entries win where they overlap, as in build_ground
    pitches = [(w['id'], polys[w['id']]) for w in ways if w['closed'] and w['tags'].get('leisure') == 'pitch' and polys[w['id']].intersects(area)]
    for pid, g in sorted(pitches, key=lambda t: -t[1].area):
        outer = [oid for oid, og in pitches if oid != pid and og.area > g.area and og.contains(g.representative_point())]
        pieces.append(('pitch', g, {'id': pid, 'outer': outer[0] if outer else None}))
    for w in ways:
        t = w['tags']
        if w['closed'] and t.get('area') == 'yes' and t.get('highway') in ('pedestrian', 'footway') and polys[w['id']].intersects(area):
            pieces.append(('plaza', polys[w['id']], {'id': w['id']}))
    for w in ways:
        if w['closed'] and 'building' in w['tags'] and polys[w['id']].intersects(area):
            pieces.append(('building', polys[w['id']], {'id': w['id']}))
    for pl in P['platforms']:
        pieces.append(('platform', bg.region_geom(pl), {'name': pl['name']}))
    lc = P['lakes']
    for w in ways:
        if w['closed'] and w['tags'].get('natural') == 'water' and polys[w['id']].intersects(area):
            pieces.append(('lake', polys[w['id']].buffer(0.5), {'id': w['id'], 'bank_m': lc['bank_m'],
                                                              'level_m': lc['by_osm_id'].get(w['id'], {}).get('level_m')}))
    return site, P, R, F, area, roads, pieces


def rasterize(R, area, roads, pieces, P):
    """Label map: -1 open ground; 0.. piece index; road cells get their own ids after the pieces."""
    lab = np.full((R.h, R.w), -1, np.int32)
    for i, (kind, g, _) in enumerate(pieces):
        g = g.intersection(area)
        if g.is_empty:
            continue
        win, X, Z = R.window(g.bounds, 1)
        m = shapely.contains_xy(g, X, Z)
        lab[win][m] = i
    rc = P['roads']
    walk_width = max(rc['width_m'][k] for k in rc['connector']['kinds'])
    samples, info = [], []
    road_mask = np.zeros((R.h, R.w), bool)
    for line, width in sorted(roads, key=lambda t: t[1]):
        n = max(2, int(line.length / (R.res * .5)))
        pts = np.array([line.interpolate(t, normalized=True).coords[0] for t in np.linspace(0, 1, n)])
        rid = len(pieces) + len(info)
        # road_network gives walkways (connector kinds) the connector width; network kinds are wider
        walk = width <= walk_width
        info.append({'line': line, 'width': width, 'pts': pts, 'ds': line.length / (n - 1), 'walk': bool(walk)})
        samples.append((rid, pts))
        g = line.buffer(width / 2, cap_style='flat' if width >= rc['flat_end_min_width_m'] else 'round').intersection(area)
        if g.is_empty:
            continue
        win, X, Z = R.window(g.bounds, 1)
        road_mask[win] |= shapely.contains_xy(g, X, Z)
    seed = np.full((R.h, R.w), -1, np.int64)   # flat index into all samples
    offs = np.cumsum([0] + [len(p) for _, p in samples])
    for k, (rid, pts) in enumerate(samples):
        r = ((pts[:, 1] - R.z0) / R.res).astype(int)
        c = ((pts[:, 0] - R.x0) / R.res).astype(int)
        ok = (r >= 0) & (r < R.h) & (c >= 0) & (c < R.w)
        seed[r[ok], c[ok]] = offs[k] + np.nonzero(ok)[0]
    _, (ir, ic) = ndi.distance_transform_edt(seed < 0, return_indices=True)
    near = seed[ir, ic]
    sample_road = np.repeat(np.arange(len(samples)), [len(p) for _, p in samples])
    lab[road_mask] = len(pieces) + sample_road[near[road_mask]]
    return lab, info, near, offs


def allowed_grade(p, ds, g):
    """The grade limit along a profile: g, or the profile's own mean grade over the special-segment
    length where that is steeper (a hill road the DEM says climbs faster than g over that length
    cannot be held to g without cuts and fills of many metres; those stretches are reported)."""
    n = max(1, int(round(RULES['special_segment_m'] / ds)))
    if len(p) <= n:
        return np.full(len(p), g)
    mean_grade = np.abs(p[n:] - p[:-n]) / (n * ds)
    ahead = np.concatenate([mean_grade, np.full(n, mean_grade[-1])])
    behind = np.concatenate([np.full(n, mean_grade[0]), mean_grade])
    return np.maximum(g, np.maximum(ahead, behind))


def grade_limit(p, ds, g):
    """A profile near p whose slope stays within g (a number or one per sample): the mean of the
    highest such profile not above p (all cut) and the lowest not below p (all fill). Both keep the
    limit, so their mean does; it equals p wherever p keeps the limit, and splits cut and fill where
    it does not."""
    s = (np.broadcast_to(g, p.shape) * ds).tolist()
    hi = p.tolist()
    lo = p.tolist()
    n = len(hi)
    for i in range(1, n):
        hi[i] = min(hi[i], hi[i - 1] + s[i])
        lo[i] = max(lo[i], lo[i - 1] - s[i])
    for i in range(n - 2, -1, -1):
        hi[i] = min(hi[i], hi[i + 1] + s[i + 1])
        lo[i] = max(lo[i], lo[i + 1] - s[i + 1])
    return 0.5 * (np.array(hi) + np.array(lo))


def rules(Fc, R, lab, pieces, info, near, offs, P, in_area, lo=None, hi=None):
    """One pass of the rules on target surface Fc -> heights H, ground level G of pieces, flags."""
    npieces = len(pieces)
    H = Fc.copy()
    G = np.full_like(Fc, np.nan)         # the level open ground meets at a piece (building: its ground, not floor)
    kind_of = np.full(lab.shape, '', object)
    stairs = np.zeros(lab.shape, bool)
    # flat pieces
    ids = np.arange(npieces)
    med = np.array(ndi.median(Fc, lab, index=ids)) if npieces else np.array([])
    level = {}
    for i, (kind, g, ex) in enumerate(pieces):
        if kind == 'lake':
            m = lab == i
            if not m.any():
                continue
            lv = ex['level_m'] if ex['level_m'] is not None else float(np.percentile(Fc[m], 25))
            level[i] = lv + ex['bank_m']
        elif kind == 'pitch' and ex['outer']:
            oi = [j for j, (k2, _, e2) in enumerate(pieces) if k2 == 'pitch' and e2['id'] == ex['outer']][0]
            level[i] = med[oi]
        else:
            level[i] = med[i]
    lvl = np.full(npieces, np.nan)
    for i, v in level.items():
        lvl[i] = v
    pm = (lab >= 0) & (lab < npieces)
    G[pm] = lvl[lab[pm]]
    H[pm] = G[pm]
    bmask = pm & np.isin(lab, [i for i, p in enumerate(pieces) if p[0] == 'building'])
    H[bmask] += RULES['floor_above_ground_m']
    kinds = np.array([p[0] for p in pieces] + ['road'] * len(info), object)
    # roads: profile along the centre line from Fc, smoothed as in build_ground, then grade-limited
    prof = np.zeros(offs[-1])
    for k, r in enumerate(info):
        pts = r['pts']
        p = R.sample(Fc, pts[:, 0], pts[:, 1])
        p = ndi.gaussian_filter1d(p, P['roads']['profile_sigma_m'] / r['ds'], mode='nearest')
        g = RULES['stair_slope'] if r['walk'] else RULES['road_grade_max']
        r['limit'] = allowed_grade(p, r['ds'], g)
        r['over'] = r['limit'] > g + 1e-9      # stretches held to the DEM's own (steeper) grade
        prof[offs[k]:offs[k + 1]] = grade_limit(p, r['ds'], r['limit'])
    # where roads meet or run side by side each has its own profile: reconcile them by taking,
    # at every sample, the mean road surface around it, and keeping each road within its limit
    rm = lab >= npieces
    allpts = np.concatenate([r['pts'] for r in info])
    for _ in range(3):
        Hr = np.where(rm, prof[near], 0.0)
        wsum = ndi.uniform_filter(rm.astype(float), 5)
        S = ndi.uniform_filter(Hr, 5) / np.maximum(wsum, 1e-6)
        ps = R.sample(S, allpts[:, 0], allpts[:, 1], order=0)
        # samples with no road surface round them (the line runs on outside the site) keep their value
        has = R.sample(wsum, allpts[:, 0], allpts[:, 1], order=0) > 1e-3
        ps = np.where(has, ps, prof)
        for k, r in enumerate(info):
            prof[offs[k]:offs[k + 1]] = grade_limit(ps[offs[k]:offs[k + 1]], r['ds'], r['limit'])
    for k, r in enumerate(info):
        gr = np.abs(np.gradient(prof[offs[k]:offs[k + 1]], r['ds']))
        r['steep'] = gr > RULES['walk_grade_max'] + 1e-6 if r['walk'] else np.zeros(len(gr), bool)
        r['grade'] = gr
    steep_all = np.concatenate([r['steep'] for r in info])
    H[rm] = prof[near[rm]]
    G[rm] = H[rm]
    stairs[rm] = steep_all[near[rm]]
    piece = lab >= 0
    # open ground: owner = nearest piece cell; half gap = distance to it + distance to the owner boundary
    d1, (ir, ic) = ndi.distance_transform_edt(~piece, return_indices=True)
    own = lab[ir, ic]
    L = G[ir, ic]
    edge = np.zeros(lab.shape, bool)
    edge[:, :-1] |= own[:, :-1] != own[:, 1:]
    edge[:, 1:] |= own[:, :-1] != own[:, 1:]
    edge[:-1, :] |= own[:-1, :] != own[1:, :]
    edge[1:, :] |= own[:-1, :] != own[1:, :]
    edge &= ~piece
    db = ndi.distance_transform_edt(~edge)
    h = d1 + db
    delta = Fc - L
    a = np.abs(delta)
    wall_part = np.maximum(0, a - RULES['bank_max_drop_m'])
    L2 = L + np.sign(delta) * wall_part
    a2 = a - wall_part
    k = np.clip(a2 / np.maximum(h, 1e-6), RULES['bank_gentle'], RULES['bank_max'])
    rise = np.minimum(a2, k * np.maximum(d1 - 0.5, 0))
    Hopen = L2 + np.sign(delta) * rise
    op = ~piece & in_area
    if lo is not None:
        # open ground may carry moved earth, but not above the highest or below the lowest DEM
        # point within the box: that would be a drop the DEM does not have
        Hopen = np.clip(Hopen, lo, hi)
    H[op] = Hopen[op]
    # bank cells: still on the ramp (not yet at Fc + C)
    bank = op & (a2 >= RULES['step_height_m']) & (d1 > 0) & (k * np.maximum(d1 - 1.5, 0) < a2)
    return H, {'lab': lab, 'own': own, 'kinds': kinds, 'bank': bank & (d1 > 0), 'stairs': stairs, 'bmask': bmask,
               'wall_part': wall_part, 'd1': d1, 'k': k}


def classify(H, fl, in_area):
    """Every drop of at least one step: grass bank cells, and jumps between neighbouring cells."""
    lab, own, kinds = fl['lab'], fl['own'], fl['kinds']
    who = np.where(lab >= 0, lab, own)          # the piece a cell is, or belongs to
    walk = np.zeros(lab.shape, bool)
    walk[lab >= 0] = np.isin(kinds[lab[lab >= 0]], list(WALKABLE))
    cls = np.zeros(lab.shape, np.uint8)
    drop = np.zeros(lab.shape, np.float32)
    cls[fl['bank']] = CLASS['grass_bank']
    step = RULES['step_height_m']
    for ax in (0, 1):
        a = [slice(None), slice(None)]
        b = [slice(None), slice(None)]
        a[ax], b[ax] = slice(0, -1), slice(1, None)
        a, b = tuple(a), tuple(b)
        dh = H[b] - H[a]
        # a building's own floor edge (floor above ground) is the building, not a ground drop
        plinth = (fl['bmask'][a] ^ fl['bmask'][b]) & (np.abs(np.abs(dh) - RULES['floor_above_ground_m']) < 1e-3)
        # between cells of different pieces (or their open ground), or at a piece edge's wall part
        at_edge = (lab[a] >= 0) != (lab[b] >= 0)
        jump = (np.abs(dh) >= step - 1e-6) & ~plinth & in_area[a] & in_area[b] & \
            ((who[a] != who[b]) | at_edge & (fl['wall_part'][a] + fl['wall_part'][b] > 0))
        st = jump & walk[a] & walk[b]
        for s in (a, b):
            cls[s][jump & ~st] = CLASS['wall']
            cls[s][st] = CLASS['steps']
            drop[s] = np.maximum(drop[s], np.where(jump, np.abs(dh), 0))
    cls[fl['stairs'] & in_area] = CLASS['steps']
    return cls, drop


def box(A, m, R):
    return ndi.uniform_filter(A, size=int(m / R.res), mode='nearest')


def main():
    site, P, R, F, area, roads, pieces = setup()
    log('raster', R.w, 'x', R.h, 'pieces', len(pieces), 'roads', len(roads))
    X, Z = np.meshgrid(R.x0 + (np.arange(R.w) + .5) * R.res, R.z0 + (np.arange(R.h) + .5) * R.res)
    in_area = shapely.contains_xy(area, X, Z)
    lab, info, near, offs = rasterize(R, area, roads, pieces, P)
    lab[~in_area & (lab < len(pieces))] = -1
    log('rasterized', int((lab >= 0).sum()), 'piece cells')
    C = np.zeros_like(F)
    target = box(F, RULES['mass_box_m'], R)
    core = ndi.binary_erosion(in_area, iterations=RULES['mass_box_m'] // 2)
    # C moves only open ground: a flat piece wider than the box on a slope cannot match the box mean
    # inside it, and pushing on it makes the passes diverge (tried: see report); damped by half.
    free = (lab < 0) & in_area
    hist, best = [], None
    lo = ndi.minimum_filter(F, size=RULES['mass_box_m'] + 1)
    hi = ndi.maximum_filter(F, size=RULES['mass_box_m'] + 1)
    for it in range(RULES['mass_iterations']):
        H, fl = rules(F + C, R, lab, pieces, info, near, offs, P, in_area, lo, hi)
        H = np.where(in_area, H, F)
        diff = target - box(H, RULES['mass_box_m'], R)
        hist.append((float(np.abs(diff[core]).mean()), float(np.abs(diff[core]).max())))
        log('mass pass', it, 'mean |diff|', round(hist[-1][0], 3), 'max', round(hist[-1][1], 3))
        if best is None or hist[-1][0] < best[0]:
            best = (hist[-1][0], H, fl, C.copy())
        C += 0.5 * np.where(free, diff, 0)
    _, H, fl, C = best
    cls, drop = classify(H, fl, in_area)
    OUT.mkdir(exist_ok=True)
    H.astype('<f4').tofile(OUT / 'terrain_rules.bin')
    (OUT / 'terrain_rules.json').write_text(json.dumps({'x0': R.x0, 'z0': R.z0, 'cell': R.res, 'width': R.w, 'height': R.h,
                                                        'note': 'float32 heights at cell centres, rows along +Z'}, indent=1), encoding='utf-8')
    cls.tofile(OUT / 'drop_class.bin')
    drop.astype('<f4').tofile(OUT / 'drop_m.bin')
    (OUT / 'drop_class.json').write_text(json.dumps({'x0': R.x0, 'z0': R.z0, 'cell': R.res, 'width': R.w, 'height': R.h,
                                                     'classes': CLASS, 'drop_m': 'drop_m.bin float32: height of the jump at a step or wall cell',
                                                     'note': 'uint8 class at cell centres, rows along +Z'}, indent=1), encoding='utf-8')
    over = []
    for r in info:
        m = r['over']
        if m.any():
            idx = np.nonzero(m)[0]
            over.append({'length_m': round(float(m.sum() * r['ds']), 1), 'max_grade': round(float(r['grade'][m].max()), 3),
                         'walkway': r['walk'], 'from_xz': np.round(r['pts'][idx[0]], 1).tolist(), 'to_xz': np.round(r['pts'][idx[-1]], 1).tolist()})
    steps_walk_m = float(sum(r['steep'].sum() * r['ds'] for r in info))
    (OUT / 'gen_summary.json').write_text(json.dumps({'roads_over_limit': over, 'walkway_steps_length_m': round(steps_walk_m, 1),
                                                      'mass_history': hist, 'rules': RULES}, ensure_ascii=False, indent=1), encoding='utf-8')
    np.save(OUT / 'gen_extra.npy', {'in_area': in_area, 'lab': lab, 'kinds': fl['kinds'], 'C': C, 'F': F, 'mass_history': hist,
                                    'piece_kinds': [p[0] for p in pieces]}, allow_pickle=True)
    log('classes', {k: int((cls == v).sum()) for k, v in CLASS.items()}, 'GEN_OK')


if __name__ == '__main__':
    main()
