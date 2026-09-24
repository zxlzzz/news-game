"""公园长椅. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 1.8,
 'seat_d': 0.44,
 'seat_h': 0.45,
 'seat_t': 0.075,
 'leg_w': 0.075,
 'leg_span': 0.65,
 'back_h': 0.38,
 'back_y': 0.76,
 'back_t': 0.07,
 'arm_h': 0.65,
 'arm_r': 0.028}

def build():
    reset()
    box('seat',(P['width'],P['seat_t'],P['seat_d']),(0,P['seat_h']-P['seat_t']/2,0),'wood')
    box('backrest',(P['width'],P['back_h'],P['back_t']),(0,P['back_y'],-P['seat_d']/2),'wood')
    for x in (-P['leg_span'],P['leg_span']):
        for z in (-P['seat_d']*.36,P['seat_d']*.36):
            box('leg',(P['leg_w'],P['seat_h']-P['seat_t'],P['leg_w']),(x,(P['seat_h']-P['seat_t'])/2,z),'metal_dark')
        box('back_support',(P['leg_w'],P['back_y'],P['leg_w']),(x,P['back_y']/2,-P['seat_d']/2),'metal_dark')
        bar('arm',(x,P['arm_h'],-P['seat_d']/2),(x,P['arm_h'],P['seat_d']/2),P['arm_r'],'metal_dark')
    export('bench')

if __name__ == '__main__':
    build()
