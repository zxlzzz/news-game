"""排水口. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 0.75,
 'depth': 0.35,
 'height': 0.025,
 'bar_w': 0.05,
 'bar_t': 0.015,
 'positions': (-0.27, -0.135, 0, 0.135, 0.27),
 'border': 0.055}

def build():
    reset()
    box('dark_base',(P['width'],P['height'],P['depth']),(0,P['height']/2,0),'metal_dark')
    for x in P['positions']:
        box('grating',(P['bar_w'],P['bar_t'],P['depth']-2*P['border']),(x,P['height']+P['bar_t']/2,0),'metal')
    for z in (-(P['depth']-P['border'])/2,(P['depth']-P['border'])/2):
        box('rim',(P['width'],P['bar_t'],P['border']),(0,P['height']+P['bar_t']/2,z),'metal')
    export('drain')

if __name__ == '__main__':
    build()
