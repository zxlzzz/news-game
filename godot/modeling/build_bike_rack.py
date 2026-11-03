"""自行车停车架. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 2.4,
 'depth': 0.6,
 'height': 0.75,
 'radius': 0.035,
 'positions': (-0.9, -0.3, 0.3, 0.9),
 'rail_y': 0.08}

def build():
    reset()
    for z in (-P['depth']/2,P['depth']/2):
        bar('ground_rail',(-P['width']/2,P['radius'],z),(P['width']/2,P['radius'],z),P['radius'],'metal')
    for x in P['positions']:
        bar('rack_side',(x,P['radius'],-P['depth']/2),(x,P['height']-P['radius'],0),P['radius'],'metal')
        bar('rack_side',(x,P['radius'],P['depth']/2),(x,P['height']-P['radius'],0),P['radius'],'metal')
    export('bike_rack')

if __name__ == '__main__':
    build()
