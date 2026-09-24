"""宽冠公园树. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'trunk_h': 3.8,
 'trunk_r': 0.25,
 'crowns': [((-1.1, 4.9, 0), (4.3, 3.3, 4.0)),
            ((1.35, 5.1, 0.1), (4.1, 3.0, 3.8)),
            ((0, 5.7, -0.45), (4.4, 3.2, 3.8))],
 'branch_r': 0.11}

def build():
    reset()
    cylinder('trunk',P['trunk_r'],P['trunk_h'],(0,P['trunk_h']/2,0),'bark',radius_top=P['trunk_r']*.6)
    for center,size in P['crowns']:
        bar('branch',(0,P['trunk_h']*.7,0),center,P['branch_r'],'bark')
        ellipsoid('solid_crown',size,center,'foliage')
    export('park_tree_broad')

if __name__ == '__main__':
    build()
