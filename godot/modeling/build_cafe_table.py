"""咖啡馆圆桌. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'radius': 0.38, 'top_h': 0.75, 'top_t': 0.05, 'post_r': 0.045, 'base_r': 0.25, 'base_h': 0.04}

def build():
    reset()
    cylinder('base',P['base_r'],P['base_h'],(0,P['base_h']/2,0),'metal_dark')
    cylinder('pedestal',P['post_r'],P['top_h']-P['top_t'],(0,(P['top_h']-P['top_t'])/2,0),'metal_dark')
    cylinder('tabletop',P['radius'],P['top_t'],(0,P['top_h']-P['top_t']/2,0),'wood')
    export('cafe_table')

if __name__ == '__main__':
    build()
