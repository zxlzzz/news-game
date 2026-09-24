"""长条花坛. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 2.4,
 'depth': 0.85,
 'height': 0.4,
 'wall_t': 0.12,
 'base_t': 0.08,
 'plants': [(-0.75, 0.55, 0), (0, 0.61, 0), (0.75, 0.54, 0)],
 'plant_size': (0.9, 0.6, 0.65)}

def build():
    reset()
    box('base',(P['width'],P['base_t'],P['depth']),(0,P['base_t']/2,0),'concrete')
    for z in (-(P['depth']-P['wall_t'])/2,(P['depth']-P['wall_t'])/2):
        box('long_wall',(P['width'],P['height'],P['wall_t']),(0,P['height']/2,z),'concrete')
    for x in (-(P['width']-P['wall_t'])/2,(P['width']-P['wall_t'])/2):
        box('end_wall',(P['wall_t'],P['height'],P['depth']-2*P['wall_t']),(x,P['height']/2,0),'concrete')
    for center in P['plants']:
        ellipsoid('plant_clump',P['plant_size'],center,'foliage')
    export('flowerbed')

if __name__ == '__main__':
    build()
