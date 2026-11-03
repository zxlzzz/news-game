"""护柱. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'radius': 0.095, 'height': 0.85, 'foot_r': 0.15, 'foot_h': 0.08, 'band_h': 0.12, 'band_y': 0.66}

def build():
    reset()
    cylinder('foot',P['foot_r'],P['foot_h'],(0,P['foot_h']/2,0),'metal_dark')
    cylinder('post',P['radius'],P['height'],(0,P['height']/2,0),'metal_dark')
    cylinder('band',P['radius']*1.02,P['band_h'],(0,P['band_y'],0),'metal')
    export('bollard')

if __name__ == '__main__':
    build()
