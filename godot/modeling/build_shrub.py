"""灌木. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'crowns': [((-0.3, 0.52, 0), (1.1, 1.04, 1)), ((0.3, 0.47, 0.1), (1.0, 0.94, 1.1))]}

def build():
    reset()
    for center,size in P['crowns']:
        ellipsoid('solid_shrub',size,center,'foliage')
    export('shrub')

if __name__ == '__main__':
    build()
