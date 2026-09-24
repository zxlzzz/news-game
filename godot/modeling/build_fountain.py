"""公园喷泉. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'radius': 2.85,
 'wall_t': 0.28,
 'wall_h': 0.52,
 'base_h': 0.1,
 'water_y': 0.32,
 'water_t': 0.025,
 'plinth_r': 0.55,
 'plinth_h': 0.65,
 'shaft_r': 0.22,
 'shaft_h': 1.25,
 'bowl_r': 1,
 'bowl_inner': 0.83,
 'bowl_h': 0.18,
 'bowl_y': 1.62,
 'nozzle_r': 0.1,
 'nozzle_h': 0.45}

def build():
    reset()
    cylinder('pool_floor',P['radius'],P['base_h'],(0,P['base_h']/2,0),'concrete')
    ring('pool_wall',P['radius'],P['radius']-P['wall_t'],P['wall_h'],(0,P['wall_h']/2,0),'concrete')
    cylinder('water',P['radius']-P['wall_t'],P['water_t'],(0,P['water_y']-P['water_t']/2,0),'water')
    cylinder('pedestal',P['plinth_r'],P['plinth_h'],(0,P['plinth_h']/2,0),'concrete')
    cylinder('shaft',P['shaft_r'],P['shaft_h'],(0,P['plinth_h']+P['shaft_h']/2,0),'concrete')
    cylinder('bowl_floor',P['bowl_r'],P['base_h'],(0,P['bowl_y'],0),'concrete')
    ring('bowl_rim',P['bowl_r'],P['bowl_inner'],P['bowl_h'],(0,P['bowl_y']+P['bowl_h']/2,0),'concrete')
    cylinder('upper_water',P['bowl_inner'],P['water_t'],(0,P['bowl_y']+P['base_h'],0),'water')
    cylinder('nozzle',P['nozzle_r'],P['nozzle_h'],(0,P['plinth_h']+P['shaft_h']+P['nozzle_h']/2,0),'metal')
    export('fountain')

if __name__ == '__main__':
    build()
