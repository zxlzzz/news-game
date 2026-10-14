"""摊位. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 2.7,
 'depth': 2.2,
 'counter_h': 0.9,
 'counter_d': 0.65,
 'counter_z': 0.64,
 'counter_t': 0.1,
 'post': 0.075,
 'roof_y': 2.15,
 'roof_rise': 0.4,
 'roof_t': 0.035,
 'base_t': 0.1,
 'crate': (0.65, 0.18, 0.45),
 'crate_x': (-0.8, 0, 0.8)}

def build():
    reset()
    box('counter',(P['width'],P['counter_t'],P['counter_d']),(0,P['counter_h']-P['counter_t']/2,P['counter_z']),'wood')
    box('counter_front',(P['width'],P['counter_h']-P['counter_t'],P['base_t']),(0,(P['counter_h']-P['counter_t'])/2,P['counter_z']+P['counter_d']/2-P['base_t']/2),'wood')
    for x in (-P['width']/2,P['width']/2):
        for z in (-P['depth']/2,P['depth']/2):
            height=P['roof_y']+P['roof_rise']*(P['depth']/2-z)/P['depth']
            box('post',(P['post'],height,P['post']),(x,height/2,z),'metal_dark')
    roof_panel('awning',P['width']+P['post'],P['depth']+P['post'],P['roof_y'],P['roof_rise'],P['roof_t'],0,'fabric')
    # Open crates with goods in them (2026-10-13: solid crates gave the vendor and customers nothing to handle).
    goods = [('orange', 0.085, 'accent'), ('apple', 0.08, 'trim_dark'), ('cabbage', 0.15, 'foliage')]
    for (x, (kind, size, slot)) in zip(P['crate_x'], goods):
        w, h, d = P['crate']
        y0 = P['counter_h']
        wall, tray_h = 0.015, 0.12
        box('goods_crate', (w, 0.02, d), (x, y0 + 0.01, P['counter_z']), 'wood')
        for side in (-1, 1):
            box('goods_crate_side', (wall, tray_h, d), (x + side * (w - wall) / 2, y0 + tray_h / 2, P['counter_z']), 'wood')
            box('goods_crate_end', (w - 2 * wall, tray_h, wall), (x, y0 + tray_h / 2, P['counter_z'] + side * (d - wall) / 2), 'wood')
        cols, rows = max(2, int((w - 0.06) // size)), max(2, int((d - 0.06) // size))
        for layer in range(2):
            n_c, n_r = cols - layer, rows - layer
            for i in range(n_c):
                for j in range(n_r):
                    cx = x + (i - (n_c - 1) / 2) * size
                    cz = P['counter_z'] + (j - (n_r - 1) / 2) * size
                    ellipsoid('goods_' + kind, (size * 0.95, size * 0.9, size * 0.95), (cx, y0 + 0.02 + size * 0.45 + layer * size * 0.7, cz), slot)
    export('market_stall')

if __name__ == '__main__':
    build()


# Physical contact nodes share the model build data.
if __name__ == "__main__":
    import sys as _contact_sys
    from pathlib import Path as _ContactPath
    _contact_sys.path.insert(0, str(_ContactPath(__file__).resolve().parent))
    from model_contacts import apply as _apply_contacts
    _apply_contacts(_ContactPath(__file__).resolve().parents[1] / "models" / "market_stall.glb")
