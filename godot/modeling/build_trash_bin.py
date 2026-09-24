"""垃圾桶. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 0.58, 'height': 0.92, 'depth': 0.52, 'cap_h': 0.12, 'inlet': (0.38, 0.18, 0.03), 'inlet_y': 0.7}

def build():
    reset()
    box('bin',(P['width'],P['height']-P['cap_h'],P['depth']),(0,(P['height']-P['cap_h'])/2,0),'metal')
    box('lid',(P['width'],P['cap_h'],P['depth']),(0,P['height']-P['cap_h']/2,0),'metal_dark')
    box('closed_dark_inlet',P['inlet'],(0,P['inlet_y'],P['depth']/2),'metal_dark')
    export('trash_bin')

if __name__ == '__main__':
    build()
