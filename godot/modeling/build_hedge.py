"""绿篱直段. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 2.5, 'height': 1.1, 'depth': 0.7, 'base_h': 0.15}

def build():
    reset()
    box('planting_base',(P['width'],P['base_h'],P['depth']),(0,P['base_h']/2,0),'concrete')
    box('solid_hedge',(P['width'],P['height']-P['base_h'],P['depth']),(0,(P['height']+P['base_h'])/2,0),'foliage')
    export('hedge')

if __name__ == '__main__':
    build()
