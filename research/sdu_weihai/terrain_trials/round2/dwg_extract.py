"""甲: read the site plan (山大总图 -调整_t6.dwg, converted to DXF by LibreDWG dwg2dxf) and dump
what is needed: surveyed spot heights (layer 地形, numeric text next to a gc200 point block),
design elevations (DM-标高 blocks), road slope labels, and building/road line work for alignment.
Output: raw/tender/site_plan.json (drawing coordinates: x east, y north, metres)."""
import json
import re
import sys
from pathlib import Path

import numpy as np
from ezdxf import recover
from scipy.spatial import cKDTree

HERE = Path(__file__).parent
SRC = HERE / 'raw/tender/x/山大总图 -调整_t6.dxf'


def main():
    doc, _ = recover.readfile(str(SRC))
    msp = doc.modelspace()
    texts = [(e.dxf.text.strip(), e.dxf.insert.x, e.dxf.insert.y, e.dxf.layer, e.dxf.rotation) for e in msp.query('TEXT')]
    num = [t for t in texts if t[3] == '地形' and re.fullmatch(r'-?\d+\.\d+', t[0])]
    blocks = {}
    for e in msp.query('INSERT'):
        if e.dxf.layer == '地形':
            blocks.setdefault(e.dxf.name.lower(), []).append((e.dxf.insert.x, e.dxf.insert.y))
    gc = np.array(blocks.get('gc200', []))
    tree = cKDTree(gc)
    spots = []
    for s, x, y, _, rot in num:
        d, i = tree.query((x, y))
        spots.append({'h': float(s), 'text_xy': [x, y], 'point_xy': gc[i].tolist() if d < 3 else None, 'point_dist': float(d)})
    design = []
    for e in msp.query('INSERT'):
        if e.dxf.layer == 'DM-标高' and e.attribs:
            design.append({'kind': e.dxf.name, 'h': float(e.attribs[0].dxf.text), 'xy': [e.dxf.insert.x, e.dxf.insert.y]})
    slopes = [{'text': t[0], 'xy': [t[1], t[2]]} for t in texts if t[3] == 'DM-坡度']
    labels = [{'text': t[0], 'xy': [t[1], t[2]], 'layer': t[3]} for t in texts if not re.fullmatch(r'-?[\d.]+', t[0])]
    lines = {}
    for e in msp:
        if e.dxftype() in ('LWPOLYLINE', 'POLYLINE', 'LINE'):
            try:
                pts = [(p[0], p[1]) for p in (e.get_points('xy') if e.dxftype() == 'LWPOLYLINE' else
                                               ([v.dxf.location[:2] for v in e.vertices] if e.dxftype() == 'POLYLINE' else [e.dxf.start[:2], e.dxf.end[:2]]))]
            except Exception:
                continue
            closed = bool(getattr(e, 'closed', False) or (e.dxftype() == 'POLYLINE' and e.is_closed))
            lines.setdefault(e.dxf.layer, []).append({'pts': [list(map(float, p)) for p in pts], 'closed': closed})
    out = {'source': 'research/sdu_weihai/terrain_trials/round2/raw/tender/680030_*.zip -> 山大总图 -调整_t6.dwg',
           'blocks_on_topo_layer': {k: len(v) for k, v in sorted(blocks.items(), key=lambda kv: -len(kv[1]))[:30]},
           'spots': spots, 'design': design, 'slopes': slopes, 'labels': labels, 'lines': lines}
    (HERE / 'raw/tender/site_plan.json').write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
    paired = sum(s['point_xy'] is not None for s in spots)
    print('spots', len(spots), 'paired with a point block', paired, 'design', len(design), 'slopes', len(slopes))
    print('line layers', sorted(((k, len(v)) for k, v in lines.items()), key=lambda t: -t[1])[:30])


if __name__ == '__main__':
    main()
