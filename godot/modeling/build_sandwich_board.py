"""店门口立牌. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 0.62,
 'height': 1.02,
 'depth': 0.58,
 'post': 0.045,
 'panel_h': 0.66,
 'panel_y': 0.63,
 'panel_t': 0.04}

def build():
    reset()
    for x in (-P['width']/2,P['width']/2):
        for z in (-P['depth']/2,P['depth']/2):
            box('foot',(P['post']*2,P['post'],P['post']*2),(x,P['post']/2,z),'wood')
            bar('leg',(x,P['post'],z),(x,P['height']-P['post'],0),P['post'],'wood')
    for sign in (-1,1):
        board=box('blank_board',(P['width'],P['panel_h'],P['panel_t']),(0,P['panel_y'],sign*P['depth']*.2),'trim_dark')
        rotate(board,-sign*16,'X')
    export('sandwich_board')

if __name__ == '__main__':
    build()
