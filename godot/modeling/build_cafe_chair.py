"""咖啡馆椅子. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 0.44,
 'depth': 0.43,
 'seat_h': 0.45,
 'seat_t': 0.05,
 'leg_r': 0.025,
 'back_h': 0.38,
 'back_t': 0.055}

def build():
    reset()
    box('seat',(P['width'],P['seat_t'],P['depth']),(0,P['seat_h']-P['seat_t']/2,0),'wood')
    for x in (-P['width']*.4,P['width']*.4):
        for z in (-P['depth']*.4,P['depth']*.4):
            cylinder('leg',P['leg_r'],P['seat_h']-P['seat_t'],(x,(P['seat_h']-P['seat_t'])/2,z),'metal_dark')
    box('backrest',(P['width'],P['back_h'],P['back_t']),(0,P['seat_h']+P['back_h']/2,-P['depth']/2),'wood')
    export('cafe_chair')

if __name__ == '__main__':
    build()
