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
    for x in P['crate_x']:
        box('goods_crate',P['crate'],(x,P['counter_h']+P['crate'][1]/2,P['counter_z']),'wood')
    export('market_stall')

if __name__ == '__main__':
    build()
