"""行道树与树池. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'trunk_r': 0.18,
 'trunk_h': 3.5,
 'crown': (3.3, 3.1, 3.0),
 'crown_y': 4.05,
 'pit_w': 1.5,
 'pit_h': 0.12,
 'pit_t': 0.14,
 'branch_r': 0.1}

def build():
    reset()
    cylinder('trunk',P['trunk_r'],P['trunk_h'],(0,P['trunk_h']/2,0),'bark',radius_top=P['trunk_r']*.7)
    for sign in (-1,1):
        bar('branch',(0,P['trunk_h']*.65,0),(sign*P['crown'][0]*.25,P['crown_y'],0),P['branch_r'],'bark')
    ellipsoid('solid_crown',P['crown'],(0,P['crown_y'],0),'foliage')
    for z in (-(P['pit_w']-P['pit_t'])/2,(P['pit_w']-P['pit_t'])/2):
        box('tree_pit_edge',(P['pit_w'],P['pit_h'],P['pit_t']),(0,P['pit_h']/2,z),'concrete')
    for x in (-(P['pit_w']-P['pit_t'])/2,(P['pit_w']-P['pit_t'])/2):
        box('tree_pit_side',(P['pit_t'],P['pit_h'],P['pit_w']-2*P['pit_t']),(x,P['pit_h']/2,0),'concrete')
    export('street_tree')

if __name__ == '__main__':
    build()
