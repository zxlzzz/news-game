"""立面雨棚. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 3, 'depth': 1.15, 'low': 0.35, 'rise': 0.2, 'thickness': 0.04, 'rod_r': 0.035}

def build():
    reset()
    roof_panel('awning',P['width'],P['depth'],P['low'],P['rise'],P['thickness'],0,'fabric')
    for x in (-P['width']*.4,P['width']*.4):
        bar('bracket',(x,P['rod_r'],-P['depth']/2),(x,P['low'],P['depth']/2),P['rod_r'],'metal_dark')
    export('awning')

if __name__ == '__main__':
    build()
