"""甲: the measured / designed heights from the two public drawings, in scene metres.
Sources (both in 680030_山大科研楼图纸（去网络机房）9.20.zip from ggzyjy.weihai.cn, 2019-09-30):
  山大总图 -调整_t6.dwg   site plan over a topographic survey: spot heights (layer 地形, gc200 point
                          + number), design levels (DM-标高 blocks 室外标高 / 室内标高); 1985 datum
  山大室外给排水_t3.dwg   outdoor drainage: manhole cover / invert pairs, site levels (A-DIM_ELEV)
                          drawn at site-plan coordinates + (3200.662, 297.265) (shared layers match)
Writes raw/points_all.json and points.csv (the table)."""
import csv
import json
import re
import sys
from pathlib import Path

import numpy as np
from ezdxf import recover
from scipy.spatial import cKDTree
from shapely.geometry import Point, Polygon

HERE = Path(__file__).parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / 'godot/real_place'))
import osm  # noqa: E402
from geo import Site  # noqa: E402
from align_plan import to_scene  # noqa: E402

DRAIN_SHIFT = np.array([3200.662, 297.265])
SITE = '山大总图 -调整_t6.dwg'
DRAIN = '山大室外给排水_t3.dwg'


def campus_area():
    site = Site(ROOT / 'godot/scenes/sdu_weihai')
    P = json.loads((ROOT / 'godot/scenes/sdu_weihai/ground.json').read_text(encoding='utf-8'))
    ways = osm.load_ways(ROOT / site.cfg['osm'], site)
    k, v = P['area']['osm_tag']
    c = [w for w in ways if w['tags'].get(k) == v and w['closed']][0]
    return Polygon(c['pts']).buffer(P['area']['buffer_m'])


def main():
    D = json.loads((HERE / 'raw/tender/site_plan.json').read_text(encoding='utf-8'))
    rows = []
    # survey spot heights: position = the gc200 dot; else the text less the usual offset (0.8, -0.5)
    for s in D['spots']:
        if s['point_xy'] is not None and s['point_dist'] < 2.5:
            xy, how = s['point_xy'], '测量点符号(gc200)的位置'
        else:
            xy, how = [s['text_xy'][0] - 0.8, s['text_xy'][1] + 0.5], '数字左下方0.8 m处(附近没有测量点符号，按常见偏移推)'
        rows.append({'kind': '测量高程点', 'file': SITE, 'where_in_file': '图层 地形', 'raw': f"{s['h']:.2f}", 'h': s['h'], 'xy_d': xy, 'how': how})
    for d in D['design']:
        rows.append({'kind': '设计' + d['kind'], 'file': SITE, 'where_in_file': '图层 DM-标高', 'raw': f"{d['h']:.2f}", 'h': d['h'], 'xy_d': d['xy'], 'how': '标高符号插入点'})
    # drainage drawing
    doc, _ = recover.readfile(str(HERE / 'raw/tender/x/山大室外给排水_t3.dxf'))
    msp = doc.modelspace()
    wells = [(e.dxf.insert.x, e.dxf.insert.y, e.dxf.layer) for e in msp.query('INSERT') if 'WELL' in e.dxf.layer]
    names = [(e.dxf.text.strip(), e.dxf.insert.x, e.dxf.insert.y) for e in msp.query('TEXT') if 'WELL' in e.dxf.layer]
    wt = cKDTree([(w[0], w[1]) for w in wells])
    nt = cKDTree([(n[1], n[2]) for n in names])
    nums = [(float(e.dxf.text), e.dxf.insert.x, e.dxf.insert.y, e.dxf.layer) for e in msp.query('TEXT')
            if e.dxf.layer in ('W-GTRW-DIM-雨水', 'W-DMWW-DIM-生污', 'DIM_污水') and re.fullmatch(r'\d+\.\d+', e.dxf.text.strip())]
    used = set()
    for i, (h, x, y, lay) in enumerate(nums):
        # cover = upper number of a pair whose lower number sits ~1.6 below it
        low = [j for j, (h2, x2, y2, l2) in enumerate(nums) if l2 == lay and abs(x2 - x) < .6 and 1.2 < y - y2 < 2.2]
        if not low or i in used:
            continue
        used.add(low[0])
        dw, iw = wt.query((x, y))
        _, ino = nt.query(wells[iw][:2])
        rows.append({'kind': '设计检查井井盖', 'file': DRAIN, 'where_in_file': f'图层 {lay}，井 {names[ino][0]}',
                     'raw': f"{h:.3f}/{nums[low[0]][0]:.3f}（井盖/管内底）", 'h': h, 'xy_d': (np.array(wells[iw][:2]) - DRAIN_SHIFT).tolist(),
                     'how': f'最近的检查井符号，离数字 {dw:.1f} m'})
    for e in msp.query('TEXT'):
        t = e.dxf.text.strip()
        if e.dxf.layer == 'A-DIM_ELEV' and re.fullmatch(r'\d+\.\d+', t):
            rows.append({'kind': '设计场地标高' if t not in ('4.450',) else '设计室内±0.000', 'file': DRAIN, 'where_in_file': '图层 A-DIM_ELEV',
                         'raw': t + ('（±0.00）' if t == '4.450' else ''), 'h': float(t),
                         'xy_d': (np.array([e.dxf.insert.x, e.dxf.insert.y]) - DRAIN_SHIFT).tolist(), 'how': '标高数字的位置（符号尖端在数字下方约1 m内）'})
    # dedupe identical (kind, h, position within 0.5 m)
    out, seen = [], []
    for r in rows:
        key = (r['kind'], r['h'])
        if any(k == key and np.hypot(*(np.array(p) - r['xy_d'])) < .5 for k, p in seen):
            continue
        seen.append((key, r['xy_d']))
        out.append(r)
    sc = to_scene([r['xy_d'] for r in out])
    area = campus_area()
    # the 2019 building site (土地证范围): the old survey there no longer shows today's ground
    # the building lot: the open 7-point line of layer 00土地证范围 (the closed one is the whole campus)
    lot = Polygon(to_scene([l for l in D['lines']['00土地证范围'] if len(l['pts']) == 7][0]['pts'])).buffer(0)
    for r, (x, z) in zip(out, sc):
        r['x'], r['z'] = round(float(x), 2), round(float(z), 2)
        r['in_campus'] = bool(area.contains(Point(x, z)))
        r['in_2019_lot'] = bool(lot.contains(Point(x, z)))
    (HERE / 'raw/points_all.json').write_text(json.dumps({'lot_2019': list(lot.exterior.coords), 'points': out}, ensure_ascii=False, indent=0), encoding='utf-8')
    import collections
    print(collections.Counter((r['kind'], r['in_campus'], r['in_2019_lot']) for r in out))


if __name__ == '__main__':
    main()
