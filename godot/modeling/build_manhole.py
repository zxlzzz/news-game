"""井盖. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'radius': 0.36,
 'height': 0.025,
 'inset_r': 0.3,
 'inset_h': 0.005,
 'bar_w': 0.035,
 'bar_l': 0.42,
 'bar_z': (-0.12, 0.12)}

def build():
    reset()
    cylinder('cover',P['radius'],P['height'],(0,P['height']/2,0),'metal_dark')
    cylinder('inset',P['inset_r'],P['inset_h'],(0,P['height']+P['inset_h']/2,0),'metal')
    for z in P['bar_z']:
        box('grip',(P['bar_l'],P['inset_h'],P['bar_w']),(0,P['height']+P['inset_h'],z),'metal_dark')
    export('manhole')

if __name__ == '__main__':
    build()
