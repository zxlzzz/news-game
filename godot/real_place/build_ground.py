"""Stage 1 ground of a real-place scene: terrain heights and ground cover -> ground.glb + terrain.bin.

Usage: python godot/real_place/build_ground.py godot/scenes/<site>
Reads the scene's site.json and ground.json, the imagery cover (classify_cover.py), the DEM and OSM.
Writes in the scene folder:
  ground.glb    one mesh per colour slot (material named by the slot), scene metres, Y up
  terrain.bin   float32 heights, row-major, rows = Z; terrain.json says where (core/terrain.gd reads it)
  ground_report.json   what came from where, estimated heights
"""
import json
import sys
import time
from pathlib import Path

import contourpy
import numpy as np
import shapely
import tifffile
from scipy import ndimage as ndi
from shapely.geometry import LineString, Polygon, box
from shapely.ops import linemerge, unary_union

sys.path.insert(0, str(Path(__file__).parent))
import glb
import osm
from geo import Site

ROOT = Path(__file__).resolve().parents[2]
T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


def smoothstep(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


class Raster:
    """Square cells of res metres; value i, j at the centre of cell (x0 + (j+.5) res, z0 + (i+.5) res)."""

    def __init__(self, x0, z0, res, w, h):
        self.x0, self.z0, self.res, self.w, self.h = x0, z0, res, w, h

    def window(self, bounds, pad):
        bx0, bz0, bx1, bz1 = bounds
        c0 = max(0, int((bx0 - pad - self.x0) / self.res))
        c1 = min(self.w, int((bx1 + pad - self.x0) / self.res) + 2)
        r0 = max(0, int((bz0 - pad - self.z0) / self.res))
        r1 = min(self.h, int((bz1 + pad - self.z0) / self.res) + 2)
        xs = self.x0 + (np.arange(c0, c1) + .5) * self.res
        zs = self.z0 + (np.arange(r0, r1) + .5) * self.res
        X, Z = np.meshgrid(xs, zs)
        return (slice(r0, r1), slice(c0, c1)), X, Z

    def sample(self, H, x, z, order=1):
        return ndi.map_coordinates(H, [(np.asarray(z) - self.z0) / self.res - .5, (np.asarray(x) - self.x0) / self.res - .5],
                                   order=order, mode='nearest')


def flatten(H, R, geom, target, blend):
    """Blend H towards target inside geom (weight 1) fading to 0 over blend metres outside."""
    win, X, Z = R.window(geom.bounds, blend + 2 * R.res)
    inside = shapely.contains_xy(geom, X, Z)
    if not inside.any():
        return None
    d = ndi.distance_transform_edt(~inside) * R.res
    w = smoothstep(1 - d / blend) if blend > 0 else inside.astype(float)
    w[inside] = 1
    T = target(X, Z, inside) if callable(target) else target
    H[win] = H[win] * (1 - w) + T * w
    return inside


def polygons_from_mask(field, xs, zs, level=0.5):
    """Filled contours of a smooth field at level -> shapely polygons (with holes)."""
    gen = contourpy.contour_generator(x=xs, y=zs, z=field, fill_type='OuterOffset')
    polys, offsets = gen.filled(level, 1e9)
    out = []
    for pts, offs in zip(polys, offsets):
        rings = [pts[offs[i]:offs[i + 1]] for i in range(len(offs) - 1)]
        rings = [r for r in rings if len(r) >= 4]
        if rings:
            out.append(Polygon(rings[0], rings[1:]))
    return shapely.make_valid(unary_union(out)) if out else Polygon()


def only_polys(g):
    parts = [p for p in shapely.get_parts(g) if p.geom_type == 'Polygon' and not p.is_empty]
    if not parts:
        return Polygon()
    return unary_union(parts)


def region_geom(spec):
    """A hand-traced region: 'polygon' [[x, z]...], 'rect' [x0, z0, x1, z1], 'octagon' {centre, size [w, h],
    cut}, 'circle' [x, z, r]; 'union' / 'minus' lists of further specs."""
    if 'polygon' in spec:
        g = Polygon(spec['polygon'])
    elif 'rect' in spec:
        g = box(*spec['rect'])
    elif 'octagon' in spec:
        o = spec['octagon']
        (cx, cz), (w, h), c = o['centre'], o['size'], o['cut']
        x0, x1, z0, z1 = cx - w / 2, cx + w / 2, cz - h / 2, cz + h / 2
        g = Polygon([(x0 + c, z0), (x1 - c, z0), (x1, z0 + c), (x1, z1 - c), (x1 - c, z1), (x0 + c, z1), (x0, z1 - c), (x0, z0 + c)])
    elif 'circle' in spec:
        x, z, r = spec['circle']
        g = shapely.Point(x, z).buffer(r, quad_segs=16)
    else:
        g = Polygon()
    for s in spec.get('union', []):
        g = g.union(region_geom(s))
    for s in spec.get('minus', []):
        g = g.difference(region_geom(s))
    if not g.is_valid or g.is_empty:
        raise SystemExit(f'region {spec.get("name", spec)}: empty or invalid shape')
    return g


def road_network(ways, rc, near):
    """The roads of stage 1: the network that cuts the site into blocks, [(line, width m)].
    Every way of a 'network' kind, plus walkways of a 'connector' kind that join the network at both
    ends and are at least connector.min_length_m long (pieces of one walkway are merged first; a
    walkway joining one accepted this way counts too). Short or dead-end walkways belong to stage 2."""
    def width(tags):
        w = tags.get('width', '')
        return float(w) if w.replace('.', '', 1).isdigit() else rc['width_m'][tags['highway']]

    # area=yes marks a plaza's outline drawn as a highway, not a road
    cand = [w for w in ways if w['tags'].get('highway') in rc['width_m'] and w['tags'].get('area') != 'yes'
            and LineString(w['pts']).intersects(near)]
    net = [(LineString(w['pts']), width(w['tags'])) for w in cand if w['tags']['highway'] in rc['network']]
    cc = rc['connector']
    kinds = [w for w in cand if w['tags']['highway'] in cc['kinds']]
    merged = linemerge([LineString(w['pts']) for w in kinds]) if kinds else Polygon()
    # a walkway that closes on itself (round a plaza) cuts nothing
    pending = [g for g in shapely.get_parts(merged) if g.length >= cc['min_length_m'] and not g.is_closed]
    cw = max(rc['width_m'][k] for k in cc['kinds'])
    while True:
        joined = unary_union([l for l, _ in net]).buffer(cc['end_snap_m'])
        ok = [g for g in pending if joined.contains(shapely.Point(g.coords[0])) and joined.contains(shapely.Point(g.coords[-1]))]
        if not ok:
            break
        net += [(g, cw) for g in ok]
        pending = [g for g in pending if not any(g is o for o in ok)]
    return net


def clean(g, min_area, min_hole):
    """Drop polygons smaller than min_area and holes smaller than min_hole (square metres)."""
    out = []
    for p in shapely.get_parts(g):
        if p.geom_type != 'Polygon' or p.area < min_area:
            continue
        out.append(Polygon(p.exterior, [h for h in p.interiors if Polygon(h).area >= min_hole]))
    return unary_union(out) if out else Polygon()


def mesh_geometry(g, cell, R, H):
    """Triangulate g (clipped to a cell grid so the terrain can bend) -> vertices, normals, triangles."""
    pieces = []
    for p in shapely.get_parts(g):
        if p.geom_type != 'Polygon' or p.area < 1e-4:
            continue
        bx0, bz0, bx1, bz1 = p.bounds
        gx = np.arange(np.floor(bx0 / cell), np.ceil(bx1 / cell)) * cell
        gz = np.arange(np.floor(bz0 / cell), np.ceil(bz1 / cell)) * cell
        GX, GZ = np.meshgrid(gx, gz)
        boxes = shapely.box(GX.ravel(), GZ.ravel(), GX.ravel() + cell, GZ.ravel() + cell)
        shapely.prepare(p)
        hit = shapely.intersects(p, boxes)
        inter = shapely.intersection(boxes[hit], p)
        pieces.extend(q for q in shapely.get_parts(inter) if q.geom_type == 'Polygon' and q.area > 1e-5)
    if not pieces:
        return None
    tris = shapely.get_parts(shapely.constrained_delaunay_triangles(np.array(pieces, dtype=object)))
    tris = tris[shapely.get_type_id(tris) == 3]
    c = shapely.get_coordinates(tris).reshape(-1, 4, 2)[:, :3]
    flat = c.reshape(-1, 2)
    key = np.round(flat * 1000).astype(np.int64)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    xz = uniq / 1000.0
    y = R.sample(H, xz[:, 0], xz[:, 1])
    V = np.column_stack([xz[:, 0], y, xz[:, 1]])
    T = inv.reshape(-1, 3)
    T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
    a, b, cc = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    n = np.cross(b - a, cc - a)
    flip = n[:, 1] < 0
    T[flip] = T[flip][:, [0, 2, 1]]
    n[flip] *= -1
    N = np.zeros_like(V)
    for k in range(3):
        np.add.at(N, T[:, k], n)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    return V, N, T


def walls_along(g, level, R, H, below=0.15):
    """Vertical faces along the rings of g, from level - below up to the terrain: a lake's stone edge."""
    V, T = [], []
    for p in shapely.get_parts(g):
        for ring in [p.exterior, *p.interiors]:
            pts = np.asarray(ring.coords)
            top = R.sample(H, pts[:, 0], pts[:, 1])
            for i in range(len(pts) - 1):
                a, b = pts[i], pts[i + 1]
                k = len(V)
                V += [[a[0], level - below, a[1]], [b[0], level - below, b[1]], [b[0], top[i + 1], b[1]], [a[0], top[i], a[1]]]
                T += [[k, k + 1, k + 2], [k, k + 2, k + 3]]
    if not V:
        return None
    V = np.array(V)
    T = np.array(T)
    # Face the walls outward (towards the land): water is on the ring's inside.
    n = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]])
    mid = (V[T[:, 0]] + V[T[:, 1]] + V[T[:, 2]]) / 3
    probe = mid[:, [0, 2]] + n[:, [0, 2]] / np.maximum(np.linalg.norm(n[:, [0, 2]], axis=1, keepdims=True), 1e-9) * 0.05
    into_water = shapely.contains_xy(g, probe[:, 0], probe[:, 1])
    T[into_water] = T[into_water][:, [0, 2, 1]]
    n[into_water] *= -1
    N = np.zeros_like(V)
    for k in range(3):
        np.add.at(N, T[:, k], n)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    return V, N, T


def read_tiff_window(tif, page, r0, r1, c0, c1):
    """Rows r0:r1, cols c0:c1 of a tiled float32 GeoTIFF, deflate with horizontal predictor.
    Decoded here with zlib: this Python's imagecodecs build does not load with NumPy 2."""
    import zlib
    word = {32: ('<u4', '<f4'), 8: ('u1', 'u1')}.get(page.bitspersample)
    if not (page.is_tiled and page.compression in (8, 32946) and word and page.predictor in (1, 2)):
        raise SystemExit(f'DEM: unsupported TIFF layout (compression {page.compression}, predictor {page.predictor})')
    tw, th = page.tilewidth, page.tilelength
    across = -(-page.imagewidth // tw)
    out = np.zeros((r1 - r0, c1 - c0), np.float64)
    fh = tif.filehandle
    for tr in range(r0 // th, (r1 - 1) // th + 1):
        for tc in range(c0 // tw, (c1 - 1) // tw + 1):
            i = tr * across + tc
            fh.seek(page.dataoffsets[i])
            raw = np.frombuffer(zlib.decompress(fh.read(page.databytecounts[i])), word[0]).reshape(th, tw)
            if page.predictor == 2:
                raw = np.cumsum(raw, axis=1, dtype=raw.dtype)
            tile = raw.view(word[1])
            ra, rb = max(r0, tr * th), min(r1, (tr + 1) * th)
            ca, cb = max(c0, tc * tw), min(c1, (tc + 1) * tw)
            out[ra - r0:rb - r0, ca - c0:cb - c0] = tile[ra - tr * th:rb - tr * th, ca - tc * tw:cb - tc * tw]
    return out


def load_dem(site, path, R, order=3):
    """DEM values at the raster cells (GeoTIFF, geographic, pixel-is-point); bicubic unless order given.
    Bicubic values are kept within the four surrounding samples: unclamped, a 0 m sea sample next
    to 8 m land rings to -1 m and back, one dimple per 30 m sample along the coast."""
    tif = tifffile.TiffFile(path)
    page = tif.pages[0]
    sx, sy, _ = page.tags[33550].value
    tie = page.tags[33922].value
    lon0, lat0 = tie[3], tie[4]
    X, Z = np.meshgrid(R.x0 + (np.arange(R.w) + .5) * R.res, R.z0 + (np.arange(R.h) + .5) * R.res)
    lon, lat = site.xz_to_lonlat_np(X, Z)
    cols = (lon - lon0) / sx
    rows = (lat0 - lat) / sy
    r0, r1 = int(rows.min()) - 3, int(rows.max()) + 4
    c0, c1 = int(cols.min()) - 3, int(cols.max()) + 4
    dem = read_tiff_window(tif, page, r0, r1, c0, c1)
    out = ndi.map_coordinates(dem, [rows - r0, cols - c0], order=order, mode='nearest')
    if order > 1:
        i, j = np.floor(rows - r0).astype(int), np.floor(cols - c0).astype(int)
        corners = np.stack([dem[i, j], dem[i + 1, j], dem[i, j + 1], dem[i + 1, j + 1]])
        out = np.clip(out, corners.min(0), corners.max(0))
    return out


def build_backdrop(scene, site, P, area, R, H, cov):
    """Scenery round the detailed area, out to the site extent: sea, coast, woods and town ground,
    coarser. Heights: the detailed raster where it reaches, else the DEM; the sea is level."""
    B = P['backdrop']
    res = B['raster_m']
    Rb = Raster(site.x0, site.z0, res, int((site.x1 - site.x0) / res), int((site.z1 - site.z0) / res))
    Hb = load_dem(site, ROOT / site.cfg['dem'], Rb)
    ocean = load_dem(site, ROOT / B['water_mask'], Rb, order=0) == B['ocean_value']
    xs = Rb.x0 + (np.arange(Rb.w) + .5) * res
    zs = Rb.z0 + (np.arange(Rb.h) + .5) * res
    sea = polygons_from_mask(ndi.gaussian_filter(ocean.astype(np.float32), 1.0), xs, zs)
    # The coastline from the imagery where it is water next to the mask's (30 m, blocky) sea.
    names = list(cov['names'])
    step = max(1, int(round(res / 2 / float(cov['metres_per_px']))))
    wat = cov['classes'][::step, ::step] == names.index('water')
    cm = float(cov['metres_per_px']) * step
    cx = cov['origin_xz'][0] + (np.arange(wat.shape[1]) + .5) * cm
    cz = cov['origin_xz'][1] + (np.arange(wat.shape[0]) + .5) * cm
    img_water = polygons_from_mask(ndi.gaussian_filter(wat.astype(np.float32), 1.0), cx, cz)
    near_sea = only_polys(img_water.intersection(sea.buffer(B['coast_snap_m'])))
    sea = clean(only_polys(unary_union([sea.buffer(-B['coast_snap_m'] / 2), near_sea]).buffer(2).buffer(-2)), 5000, 400)
    frame = box(site.x0, site.z0, site.x1, site.z1)
    back = frame.difference(area)
    parts, taken = {}, Polygon()

    def take(g, slot):
        nonlocal taken
        g = only_polys(shapely.make_valid(g).intersection(back).difference(taken))
        if not g.is_empty:
            parts.setdefault(slot, []).append(g)
            taken = unary_union([taken, g])

    take(sea.simplify(B['simplify_m']), 'water')
    take(back, P['ground_slot'])
    # Heights: detailed raster inside its extent (so the seam matches), DEM elsewhere.
    X, Z = np.meshgrid(xs, zs)
    inR = (X > R.x0 + 2) & (X < R.x0 + R.w * R.res - 2) & (Z > R.z0 + 2) & (Z < R.z0 + R.h * R.res - 2)
    Hb[inR] = R.sample(H, X[inR], Z[inR])
    # Away from the campus edge, smooth: on a shore the 30 m DEM samples stand up one by one from
    # the sea-level strip, each hatched on its lee side, a row of dots along the coast.
    d = ndi.distance_transform_edt(~shapely.contains_xy(area, X, Z)) * res
    w = smoothstep(d / B['smooth_blend_m'])
    Hb = np.maximum(Hb * (1 - w) + ndi.gaussian_filter(Hb, B['smooth_m'] / res) * w, P['sea_level_m'])
    # The land comes down to the sea over shore_m, else its edge stands above the flat sea and the
    # gap between them shows.
    water = parts.get('water', [])
    if water:
        ds = ndi.distance_transform_edt(~shapely.contains_xy(unary_union(water), X, Z)) * res
        shore = smoothstep((ds - res) / B['shore_m'])
        Hb = P['sea_level_m'] + (Hb - P['sea_level_m']) * (1 - w * (1 - shore))
    out = []
    for slot, gs in parts.items():
        hh = np.full_like(Hb, P['sea_level_m']) if slot == 'water' else Hb
        m = mesh_geometry(unary_union(gs), B['mesh_grid_m'] if slot != 'water' else B['mesh_grid_m'] * 4, Rb, hh)
        if m:
            out.append((slot, [(slot, *m)]))
            log('backdrop', slot, len(m[2]), 'triangles')
    glb.write(scene / 'backdrop.glb', out)


def main(scene):
    scene = Path(scene)
    site = Site(scene)
    P = json.loads((scene / 'ground.json').read_text(encoding='utf-8'))
    report = {'units': 'metres; X east, Y up, Z south', 'sources': {}, 'estimates': []}
    ways = osm.load_ways(ROOT / site.cfg['osm'], site)
    k, v = P['area']['osm_tag']
    campus = [w for w in ways if w['tags'].get(k) == v and w['closed']]
    if len(campus) != 1:
        raise SystemExit(f'area: expected one closed OSM way with {k}={v}, found {len(campus)}')
    area = Polygon(campus[0]['pts']).buffer(P['area']['buffer_m'], join_style='round')
    # Roads (see road_network) before the heights: the edge takes in the full width of a road
    # wherever its centre line is inside, so a street along the edge is not cut down its length.
    near = area.buffer(60)
    rc = P['roads']
    roads = road_network(ways, rc, near)
    area = unary_union([area] + [line.intersection(area).buffer(width / 2, cap_style='flat') for line, width in roads])
    area = only_polys(area)
    res = P['raster_m']
    bx0, bz0, bx1, bz1 = area.bounds
    x0, z0 = np.floor(bx0 / res) * res - 20, np.floor(bz0 / res) * res - 20
    R = Raster(x0, z0, res, int(np.ceil((bx1 - x0 + 20) / res)), int(np.ceil((bz1 - z0 + 20) / res)))
    log('raster', R.w, 'x', R.h, 'area km2', round(area.area / 1e6, 3))

    # ---------------------------------------------------------------- heights
    base = load_dem(site, ROOT / site.cfg['dem'], R)
    H = base.copy()
    report['sources']['terrain'] = f"{site.cfg['dem']} (bicubic from ~30 m samples)"
    log('dem', round(float(base.min()), 1), round(float(base.max()), 1))

    def median_of_base(g):
        win, X, Z = R.window(g.bounds, 0)
        m = shapely.contains_xy(g, X, Z)
        return float(np.median(base[win][m])) if m.any() else float(R.sample(base, *g.representative_point().coords[0]))

    polys = {w['id']: Polygon(w['pts']) for w in ways if w['closed']}
    pitches = [(w['id'], polys[w['id']]) for w in ways if w['closed'] and w['tags'].get('leisure') == 'pitch' and polys[w['id']].intersects(area)]
    for pid, g in sorted(pitches, key=lambda t: -t[1].area):   # big grounds first; pitches inside them keep its level
        cfg = P['pitches']['by_osm_id'].get(pid, P['pitches']['default'])
        outer = [h for oid, og in pitches if oid != pid and og.area > g.area and og.contains(g.representative_point()) for h in [oid]]
        hgt = median_of_base(polys[outer[0]]) if outer else median_of_base(g)
        flatten(H, R, g, hgt, cfg['blend_m'])
        report['estimates'].append({'what': f'pitch {pid}', 'height_m': round(hgt, 2), 'basis': 'median DEM height over the ground, flattened'})
    buildings = [(w['id'], polys[w['id']]) for w in ways if w['closed'] and 'building' in w['tags'] and polys[w['id']].intersects(area)]
    bc = P['buildings']
    for bid, g in buildings:
        # The bank round a pad is invented (the DEM does not see it): keep it no steeper than
        # max_bank_slope, else every pad on a slope shows as a stray hatched streak; but no wider
        # than blend_max_m, else a big pad on a hillside reshapes its neighbours (a real terrace).
        hgt = median_of_base(g)
        win, X, Z = R.window(g.bounds, 0)
        m = shapely.contains_xy(g, X, Z)
        drop = float(np.abs(base[win][m] - hgt).max()) if m.any() else 0.0
        flatten(H, R, g, hgt, float(np.clip(1.5 * drop / bc['max_bank_slope'], bc['blend_m'], bc['blend_max_m'])))
    log('pads', len(pitches), 'pitches', len(buildings), 'buildings')
    for pl in P['platforms']:
        g = region_geom(pl)
        hgt = pl['height_m'] if 'height_m' in pl else median_of_base(g)
        flatten(H, R, g, hgt, pl.get('blend_m', 4))
        report['estimates'].append({'what': f"platform {pl['name']}", 'height_m': round(hgt, 2),
                                    'basis': 'given' if 'height_m' in pl else 'median DEM height over it, flattened'})

    # Roads: each gets a longitudinal profile (DEM smoothed along the road), level across.
    seed_h = np.zeros((R.h, R.w))
    seed_w = np.zeros((R.h, R.w))
    seed = np.zeros((R.h, R.w), bool)
    road_geoms = []
    for line, width in sorted(roads, key=lambda t: t[1]):   # wide roads painted last win
        n = max(2, int(line.length / (res * .5)))
        pts = np.array([line.interpolate(t, normalized=True).coords[0] for t in np.linspace(0, 1, n)])
        prof = ndi.gaussian_filter1d(R.sample(base, pts[:, 0], pts[:, 1]), rc['profile_sigma_m'] / (line.length / n), mode='nearest')
        r = ((pts[:, 1] - R.z0) / res).astype(int)
        c = ((pts[:, 0] - R.x0) / res).astype(int)
        ok = (r >= 0) & (r < R.h) & (c >= 0) & (c < R.w)
        seed[r[ok], c[ok]] = True
        seed_h[r[ok], c[ok]] = prof[ok]
        seed_w[r[ok], c[ok]] = width / 2
        road_geoms.append(line.buffer(width / 2, cap_style='flat' if width >= rc['flat_end_min_width_m'] else 'round'))
    d, (ir, ic) = ndi.distance_transform_edt(~seed, return_indices=True)
    d *= res
    hw = seed_w[ir, ic]
    T = ndi.gaussian_filter(seed_h[ir, ic], 1.5)
    wgt = np.where(d <= hw, 1.0, smoothstep(1 - (d - hw) / rc['blend_m']))
    H = H * (1 - wgt) + T * wgt
    log('roads', len(roads))

    # Soften the creases where levelled pieces meet the slope (they read as stray lines on plain ground).
    H = ndi.gaussian_filter(H, P['smooth_m'] / res)

    # Lakes: level water, a stone edge bank_m above it, ground eased down to the bank.
    lakes = [(w['id'], polys[w['id']]) for w in ways if w['closed'] and w['tags'].get('natural') == 'water' and polys[w['id']].intersects(area)]
    lc = P['lakes']
    water_parts = []
    for lid, g in lakes:
        level = lc['by_osm_id'].get(lid, {}).get('level_m')
        if level is None:
            win, X, Z = R.window(g.bounds, 0)
            level = float(np.percentile(base[win][shapely.contains_xy(g, X, Z)], 25))
        flatten(H, R, g.buffer(0.5), level + lc['bank_m'], lc['blend_m'])
        water_parts.append((g, level))
        report['estimates'].append({'what': f'lake {lid}', 'level_m': round(level, 2), 'basis': 'lower quartile of DEM over the water; bank %.1f m' % lc['bank_m']})
    log('lakes', len(lakes))

    # ---------------------------------------------------------------- cover: water, roads, ground
    cov = np.load(ROOT / site.cfg['imagery']['dir'] / 'cover.npz')
    names = list(cov['names'])
    mpp = float(cov['metres_per_px'])
    ox, oz = cov['origin_xz']
    c0, c1 = int((bx0 - 10 - ox) / mpp), int((bx1 + 10 - ox) / mpp)
    r0, r1 = int((bz0 - 10 - oz) / mpp), int((bz1 + 10 - oz) / mpp)
    cls = cov['classes'][r0:r1, c0:c1]
    xs = ox + (np.arange(c0, c1) + .5) * mpp
    zs = oz + (np.arange(r0, r1) + .5) * mpp
    # The sea's coast comes from the imagery (it has no standard shape); only large water counts.
    field = ndi.gaussian_filter((cls == names.index('water')).astype(np.float32), 1.0)
    sea_img = only_polys(polygons_from_mask(field, xs, zs).buffer(-2).buffer(4).buffer(-2)).simplify(1.0)
    sea_img = only_polys(shapely.make_valid(sea_img)).intersection(area)

    slots = {}
    taken = Polygon()

    def take(g, slot):
        nonlocal taken
        g = only_polys(shapely.make_valid(g).intersection(area).difference(taken))
        if g.is_empty:
            return g
        slots.setdefault(slot, []).append(g)
        taken = unary_union([taken, g])
        return g

    lake_union = unary_union([g for g, _ in water_parts]) if water_parts else Polygon()
    take(lake_union, 'water')
    # small pieces after the cuts are no sea: outside water clipped by the edge, the imagery's
    # lake water beyond the OSM lake outline
    sea = take(clean(only_polys(sea_img.difference(lake_union.buffer(20))), P['sea_min_m2'], P['sea_min_m2']), 'water')
    take(unary_union(road_geoms), P['road_slot'])
    take(area, P['ground_slot'])
    log('partition', {s: round(sum(g.area for g in gs)) for s, gs in slots.items()})

    # ---------------------------------------------------------------- meshes
    parts = []
    for slot, gs in slots.items():
        if slot == 'water':
            continue
        m = mesh_geometry(unary_union(gs), P['mesh_grid_m'], R, H)
        if m:
            parts.append((slot, [(slot, *m)]))
            log('mesh', slot, len(m[2]), 'triangles')
    # Water: a flat surface per lake / the sea, and the stone edge round lakes.
    # (the sea is what was taken as sea, not all water less the lakes: that leaves slivers round them)
    for g, level in water_parts + ([(sea, P['sea_level_m'])] if not sea.is_empty else []):
        flatH = np.full_like(H, level)
        m = mesh_geometry(g.intersection(unary_union(slots['water'])), P['mesh_grid_m'] * 4, R, flatH)
        if m:
            parts.append((f'water_{len(parts)}', [('water', *m)]))
    edge = [walls_along(g, level, R, H) for g, level in water_parts]
    edge = [e for e in edge if e]
    if edge:
        V = np.concatenate([e[0] for e in edge])
        N = np.concatenate([e[1] for e in edge])
        off = np.cumsum([0] + [len(e[0]) for e in edge[:-1]])
        T = np.concatenate([e[2] + o for e, o in zip(edge, off)])
        parts.append(('lake_edge', [('wall_stone', V, N, T)]))
    glb.write(scene / 'ground.glb', parts)
    H.astype('<f4').tofile(scene / 'terrain.bin')
    (scene / 'terrain.json').write_text(json.dumps({'x0': R.x0, 'z0': R.z0, 'cell': res, 'width': R.w, 'height': R.h,
                                                     'note': 'float32 heights at cell centres, rows along +Z'}, indent=1), encoding='utf-8')
    report['triangles'] = {s[0]: int(len(s[3])) for _, surfs in parts for s in surfs}
    report['height_range_m'] = [round(float(H.min()), 2), round(float(H.max()), 2)]
    report['cover_m2'] = {s: round(sum(g.area for g in gs)) for s, gs in slots.items()}
    (scene / 'ground_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    log('ground', sum(report['triangles'].values()), 'triangles')
    if 'backdrop' in P:
        build_backdrop(scene, site, P, area, R, H, cov)
    log('GROUND_OK')


if __name__ == '__main__':
    main(sys.argv[1])
