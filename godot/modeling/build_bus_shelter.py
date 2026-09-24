"""公交候车棚与长凳. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 5,
 'depth': 2.1,
 'height': 2.7,
 'post': 0.1,
 'roof_t': 0.12,
 'seat_w': 2.8,
 'seat_d': 0.43,
 'seat_h': 0.45,
 'seat_t': 0.08,
 'bench_z': -0.5,
 'leg': 0.09,
 'back_h': 0.38,
 'back_y': 0.76,
 'panel_h': 1.5,
 'panel_y': 1.15,
 'panel_t': 0.04}

def build():
    reset()
    for x in (-P['width']/2,P['width']/2):
        for z in (-P['depth']/2,P['depth']/2):
            box('post',(P['post'],P['height'],P['post']),(x,P['height']/2,z),'metal')
    box('roof',(P['width']+P['post'],P['roof_t'],P['depth']+P['post']),(0,P['height']-P['roof_t']/2,0),'metal_dark')
    box('back_windbreak',(P['width'],P['panel_h'],P['panel_t']),(0,P['panel_y'],-P['depth']/2),'window')
    box('seat',(P['seat_w'],P['seat_t'],P['seat_d']),(0,P['seat_h']-P['seat_t']/2,P['bench_z']),'wood')
    box('backrest',(P['seat_w'],P['back_h'],P['seat_t']),(0,P['back_y'],P['bench_z']-P['seat_d']/2),'wood')
    for x in (-P['seat_w']*.35,P['seat_w']*.35):
        box('bench_leg',(P['leg'],P['seat_h']-P['seat_t'],P['seat_d']),(x,(P['seat_h']-P['seat_t'])/2,P['bench_z']),'metal_dark')
    export('bus_shelter')

if __name__ == '__main__':
    build()
