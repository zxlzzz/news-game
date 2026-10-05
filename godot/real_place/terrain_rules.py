"""Stage 1 heights by design rules on the DEM's relief (build_ground.py calls build()).

Numbers come from ground.json "rules" (each with its code clause there). What it does, on the DEM F
plus a smooth correction C (last step):
  pieces   flat: pitches (a pitch inside a larger one keeps its level), plazas, building pads,
           platforms, lakes (water level + stone edge); level = median of F + C over the piece. A
           building's floor stands floor_above_ground_m above its pad.
  roads    level across; along, F + C smoothed along the line and kept within the grade limit (a
           stretch the DEM itself climbs faster over special_segment_m keeps the DEM's grade);
           walkways steeper than walk_grade_max are steps. Where roads meet or run side by side
           their profiles are averaged so the surface has no step.
  open     ground that is none of these follows F + C. Next to a piece it starts at the piece's
           level and ramps to F + C: bank_gentle where there is room (half the gap to the next
           piece), steeper up to bank_max where there is less; what still does not fit is a step
           half way across the gap. A drop above bank_max_drop_m puts the part above it in a wall
           at the piece's edge.
  classes  every drop of at least one step height: grass bank, steps (walkable on both sides), wall.
  mass     the result must equal F when averaged over mass_box_m: C is added to open ground (never
           above the highest or below the lowest DEM point within the box) until it does. A flat
           piece wider than the box on a slope cannot match inside itself; that is left. No
           smoothing at the end: it would spread the drops out again.
"""
import numpy as np
import shapely
from scipy import ndimage as ndi

CLASS = {'none': 0, 'grass_bank': 1, 'steps': 2, 'wall': 3}
WALKABLE = {'road', 'plaza', 'platform'}


def rasterize(R, area, roads, pieces, rc):
    """Label map: -1 open ground; 0.. piece index (later pieces win); road cells after the pieces,
    one id per road. Also the road samples and, for every cell, its nearest road sample."""
    lab = np.full((R.h, R.w), -1, np.int32)
    for i, (kind, g, _) in enumerate(pieces):
        g = g.intersection(area)
        if g.is_empty:
            continue
        win, X, Z = R.window(g.bounds, 1)
        lab[win][shapely.contains_xy(g, X, Z)] = i
    walk_width = max(rc['width_m'][k] for k in rc['connector']['kinds'])
    info = []
    road_mask = np.zeros((R.h, R.w), bool)
    for line, width in sorted(roads, key=lambda t: t[1]):
        n = max(2, int(line.length / (R.res * .5)))
        pts = np.array([line.interpolate(t, normalized=True).coords[0] for t in np.linspace(0, 1, n)])
        # road_network gives walkways (connector kinds) the connector width; network kinds are wider
        info.append({'line': line, 'width': width, 'pts': pts, 'ds': line.length / (n - 1), 'walk': width <= walk_width})
        g = line.buffer(width / 2, cap_style='flat' if width >= rc['flat_end_min_width_m'] else 'round').intersection(area)
        if not g.is_empty:
            win, X, Z = R.window(g.bounds, 1)
            road_mask[win] |= shapely.contains_xy(g, X, Z)
    offs = np.cumsum([0] + [len(r['pts']) for r in info])
    seed = np.full((R.h, R.w), -1, np.int64)
    for k, r in enumerate(info):
        rr = ((r['pts'][:, 1] - R.z0) / R.res).astype(int)
        cc = ((r['pts'][:, 0] - R.x0) / R.res).astype(int)
        ok = (rr >= 0) & (rr < R.h) & (cc >= 0) & (cc < R.w)
        seed[rr[ok], cc[ok]] = offs[k] + np.nonzero(ok)[0]
    _, (ir, ic) = ndi.distance_transform_edt(seed < 0, return_indices=True)
    near = seed[ir, ic]
    sample_road = np.repeat(np.arange(len(info)), [len(r['pts']) for r in info])
    lab[road_mask] = len(pieces) + sample_road[near[road_mask]]
    return lab, info, near, offs


def allowed_grade(p, ds, g, segment_m):
    """g, or the profile's own mean grade over segment_m where that is steeper."""
    n = max(1, int(round(segment_m / ds)))
    if len(p) <= n:
        return np.full(len(p), g)
    mean_grade = np.abs(p[n:] - p[:-n]) / (n * ds)
    ahead = np.concatenate([mean_grade, np.full(n, mean_grade[-1])])
    behind = np.concatenate([np.full(n, mean_grade[0]), mean_grade])
    return np.maximum(g, np.maximum(ahead, behind))


def grade_limit(p, ds, g):
    """A profile near p whose slope stays within g (one per sample): the mean of the highest such
    profile not above p (all cut) and the lowest not below it (all fill). Equals p wherever p keeps
    the limit; splits cut and fill where it does not."""
    s = (np.broadcast_to(g, p.shape) * ds).tolist()
    hi = p.tolist()
    lo = p.tolist()
    for i in range(1, len(hi)):
        hi[i] = min(hi[i], hi[i - 1] + s[i])
        lo[i] = max(lo[i], lo[i - 1] - s[i])
    for i in range(len(hi) - 2, -1, -1):
        hi[i] = min(hi[i], hi[i + 1] + s[i + 1])
        lo[i] = max(lo[i], lo[i + 1] - s[i + 1])
    return 0.5 * (np.array(hi) + np.array(lo))


def one_pass(Fc, R, lab, pieces, info, near, offs, cfg, sigma_m, in_area, lo, hi):
    """The rules on target surface Fc -> heights, piece levels, what classify() needs."""
    npieces = len(pieces)
    H = Fc.copy()
    G = np.full_like(Fc, np.nan)       # the level open ground meets at a piece (a building: its pad, not floor)
    med = np.array(ndi.median(Fc, lab, index=np.arange(npieces))) if npieces else np.array([])
    ids = {(k, ex.get('id')): i for i, (k, _, ex) in enumerate(pieces)}
    lvl = np.full(npieces, np.nan)
    for i, (kind, g, ex) in enumerate(pieces):
        if kind == 'lake':
            m = lab == i
            if m.any():
                lvl[i] = (ex['level_m'] if ex['level_m'] is not None else float(np.percentile(Fc[m], 25))) + ex['bank_m']
        elif kind == 'pitch' and ex['outer']:
            lvl[i] = med[ids[('pitch', ex['outer'])]]
        else:
            lvl[i] = med[i]
    pm = (lab >= 0) & (lab < npieces)
    G[pm] = lvl[lab[pm]]
    H[pm] = G[pm]
    bmask = pm & np.isin(lab, [i for i, p in enumerate(pieces) if p[0] == 'building'])
    H[bmask] += cfg['floor_above_ground_m']
    prof = np.zeros(offs[-1])
    for k, r in enumerate(info):
        p = ndi.gaussian_filter1d(R.sample(Fc, r['pts'][:, 0], r['pts'][:, 1]), sigma_m / r['ds'], mode='nearest')
        g = cfg['stair_slope'] if r['walk'] else cfg['road_grade_max']
        r['limit'] = allowed_grade(p, r['ds'], g, cfg['special_segment_m'])
        r['over'] = r['limit'] > g + 1e-9
        prof[offs[k]:offs[k + 1]] = grade_limit(p, r['ds'], r['limit'])
    rm = lab >= npieces
    allpts = np.concatenate([r['pts'] for r in info])
    for _ in range(3):
        wsum = ndi.uniform_filter(rm.astype(float), 5)
        S = ndi.uniform_filter(np.where(rm, prof[near], 0.0), 5) / np.maximum(wsum, 1e-6)
        ps = R.sample(S, allpts[:, 0], allpts[:, 1], order=0)
        # samples with no road surface round them (the line runs on outside the site) keep their value
        ps = np.where(R.sample(wsum, allpts[:, 0], allpts[:, 1], order=0) > 1e-3, ps, prof)
        for k, r in enumerate(info):
            prof[offs[k]:offs[k + 1]] = grade_limit(ps[offs[k]:offs[k + 1]], r['ds'], r['limit'])
    for k, r in enumerate(info):
        r['grade'] = np.abs(np.gradient(prof[offs[k]:offs[k + 1]], r['ds']))
        r['steep'] = r['grade'] > cfg['walk_grade_max'] + 1e-6 if r['walk'] else np.zeros(len(r['grade']), bool)
    H[rm] = prof[near[rm]]
    G[rm] = H[rm]
    stairs = np.zeros(lab.shape, bool)
    stairs[rm] = np.concatenate([r['steep'] for r in info])[near[rm]]
    # open ground: owner = nearest piece cell; half gap = distance to it + distance to the owners' boundary
    piece = lab >= 0
    d1, (ir, ic) = ndi.distance_transform_edt(~piece, return_indices=True)
    own = lab[ir, ic]
    L = G[ir, ic]
    edge = np.zeros(lab.shape, bool)
    for a, b in (((slice(None), slice(0, -1)), (slice(None), slice(1, None))), ((slice(0, -1), slice(None)), (slice(1, None), slice(None)))):
        e = own[a] != own[b]
        edge[a] |= e
        edge[b] |= e
    edge &= ~piece
    h = d1 + ndi.distance_transform_edt(~edge)
    delta = Fc - L
    a = np.abs(delta)
    wall_part = np.maximum(0, a - cfg['bank_max_drop_m'])
    a2 = a - wall_part
    k = np.clip(a2 / np.maximum(h, 1e-6), cfg['bank_gentle'], cfg['bank_max'])
    rise = np.minimum(a2, k * np.maximum(d1 - 0.5, 0))
    # open ground may carry moved earth, but not above the highest or below the lowest DEM point
    # within the box: that would be a drop the DEM does not have
    Hopen = np.clip(L + np.sign(delta) * (wall_part + rise), lo, hi)
    op = ~piece & in_area
    H[op] = Hopen[op]
    bank = op & (a2 >= cfg['step_height_m']) & (d1 > 0) & (k * np.maximum(d1 - 1.5, 0) < a2)
    return H, lvl, {'lab': lab, 'own': own, 'bank': bank, 'stairs': stairs, 'bmask': bmask, 'wall_part': wall_part}


def classify(H, fl, kinds, in_area, cfg):
    """Every drop of at least one step: grass bank cells, and jumps between neighbouring cells."""
    lab, own = fl['lab'], fl['own']
    who = np.where(lab >= 0, lab, own)          # the piece a cell is, or whose open ground it is
    walk = np.zeros(lab.shape, bool)
    walk[lab >= 0] = np.isin(kinds[lab[lab >= 0]], list(WALKABLE))
    cls = np.zeros(lab.shape, np.uint8)
    drop = np.zeros(lab.shape, np.float32)
    cls[fl['bank']] = CLASS['grass_bank']
    for a, b in (((slice(None), slice(0, -1)), (slice(None), slice(1, None))), ((slice(0, -1), slice(None)), (slice(1, None), slice(None)))):
        dh = H[b] - H[a]
        # a building's floor edge is the building, not a ground drop
        plinth = (fl['bmask'][a] ^ fl['bmask'][b]) & (np.abs(np.abs(dh) - cfg['floor_above_ground_m']) < 1e-3)
        at_edge = (lab[a] >= 0) != (lab[b] >= 0)
        jump = (np.abs(dh) >= cfg['step_height_m'] - 1e-6) & ~plinth & in_area[a] & in_area[b] & \
            ((who[a] != who[b]) | at_edge & (fl['wall_part'][a] + fl['wall_part'][b] > 0))
        st = jump & walk[a] & walk[b]
        for s in (a, b):
            cls[s][jump & ~st] = CLASS['wall']
            cls[s][st] = CLASS['steps']
            drop[s] = np.maximum(drop[s], np.where(jump, np.abs(dh), 0))
    cls[fl['stairs'] & in_area] = CLASS['steps']
    return cls, drop


def build(F, R, area, roads, rc, pieces, cfg, log):
    """Heights for the raster R from DEM F -> H, drop class, drop height, piece levels, summary."""
    X, Z = np.meshgrid(R.x0 + (np.arange(R.w) + .5) * R.res, R.z0 + (np.arange(R.h) + .5) * R.res)
    in_area = shapely.contains_xy(area, X, Z)
    lab, info, near, offs = rasterize(R, area, roads, pieces, rc)
    box = int(cfg['mass_box_m'] / R.res)
    target = ndi.uniform_filter(F, box, mode='nearest')
    core = ndi.binary_erosion(in_area, iterations=box // 2)
    free = (lab < 0) & in_area
    lo = ndi.minimum_filter(F, size=box + 1)
    hi = ndi.maximum_filter(F, size=box + 1)
    C = np.zeros_like(F)
    best = None
    for it in range(cfg['mass_passes']):
        H, lvl, fl = one_pass(F + C, R, lab, pieces, info, near, offs, cfg, rc['profile_sigma_m'], in_area, lo, hi)
        H = np.where(in_area, H, F)
        diff = target - ndi.uniform_filter(H, box, mode='nearest')
        err = float(np.abs(diff[core]).mean())
        if best is None or err < best[0]:
            best = (err, float(np.abs(diff[core]).max()), H, lvl, fl)
        # damped by half; only open ground moves (pushing on flat pieces makes the passes diverge)
        C += 0.5 * np.where(free, diff, 0)
    err, worst, H, lvl, fl = best
    log('rules: mass box', cfg['mass_box_m'], 'm, mean |diff|', round(err, 3), 'max', round(worst, 2))
    kinds = np.array([p[0] for p in pieces] + ['road'] * len(info), object)
    cls, drop = classify(H, fl, kinds, in_area, cfg)
    over = []
    for r in info:
        if r['over'].any():
            idx = np.nonzero(r['over'])[0]
            over.append({'length_m': round(float(r['over'].sum() * r['ds']), 1), 'max_grade': round(float(r['grade'][r['over']].max()), 3),
                         'from_xz': np.round(r['pts'][idx[0]], 1).tolist(), 'to_xz': np.round(r['pts'][idx[-1]], 1).tolist()})
    summary = {'mass_box_mean_abs_diff_m': round(err, 3), 'mass_box_max_abs_diff_m': round(worst, 2),
               'cells': {k: int(((cls == v) & in_area).sum()) for k, v in CLASS.items()},
               'roads_over_grade_limit': over,
               'walkway_steps_m': round(float(sum(r['steep'].sum() * r['ds'] for r in info)), 1)}
    return H, cls, drop, lvl, summary
