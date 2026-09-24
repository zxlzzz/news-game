"""屋顶水箱. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'radius': 0.9, 'height': 1.65, 'base_h': 0.35, 'leg_r': 0.07, 'leg_span': 0.65, 'cap_h': 0.12}

def build():
    reset()
    for x in (-P['leg_span'],P['leg_span']):
        for z in (-P['leg_span'],P['leg_span']):
            cylinder('support',P['leg_r'],P['base_h'],(x,P['base_h']/2,z),'metal_dark')
    cylinder('tank',P['radius'],P['height'],(0,P['base_h']+P['height']/2,0),'metal')
    cylinder('cap',P['radius'],P['cap_h'],(0,P['base_h']+P['height']+P['cap_h']/2,0),'concrete',radius_top=P['radius']*.8)
    export('roof_water_tank')

if __name__ == '__main__':
    build()
