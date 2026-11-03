"""细高柏树. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'trunk_h': 2.7,
 'trunk_r': 0.2,
 'crowns': [((0, 4.3, 0), (2.0, 6.0, 2.0)), ((0, 6.3, 0), (1.2, 3.4, 1.2))],
 'branch_r': 0.11}

def build():
    reset()
    cylinder('trunk',P['trunk_r'],P['trunk_h'],(0,P['trunk_h']/2,0),'bark',radius_top=P['trunk_r']*.6)
    for center,size in P['crowns']:
        bar('branch',(0,P['trunk_h']*.7,0),center,P['branch_r'],'bark')
        ellipsoid('solid_crown',size,center,'foliage')
    export('park_tree_cypress')

if __name__ == '__main__':
    build()
