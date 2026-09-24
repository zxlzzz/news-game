"""小径直段. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 2, 'length': 4, 'thickness': 0.025, 'curb_w': 0.15, 'curb_h': 0.07}

def build():
    reset()
    box('paving',(P['width'],P['thickness'],P['length']),(0,P['thickness']/2,0),'concrete')
    for x in (-(P['width']-P['curb_w'])/2,(P['width']-P['curb_w'])/2):
        box('curb',(P['curb_w'],P['curb_h'],P['length']),(x,P['curb_h']/2,0),'concrete')
    export('path_straight')

if __name__ == '__main__':
    build()
