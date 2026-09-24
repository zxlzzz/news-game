"""消防栓. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'radius': 0.15,
 'height': 0.82,
 'foot_r': 0.23,
 'foot_h': 0.12,
 'cap_h': 0.16,
 'outlet_y': 0.52,
 'outlet_r': 0.085,
 'outlet_span': 0.48}

def build():
    reset()
    cylinder('foot',P['foot_r'],P['foot_h'],(0,P['foot_h']/2,0),'metal_dark')
    cylinder('body',P['radius'],P['height']-P['cap_h'],(0,(P['height']-P['cap_h'])/2,0),'metal')
    ellipsoid('cap',(2*P['radius'],2*P['cap_h'],2*P['radius']),(0,P['height']-P['cap_h'],0),'metal')
    cylinder('outlets',P['outlet_r'],P['outlet_span'],(0,P['outlet_y'],0),'metal',axis=(1,0,0))
    export('fire_hydrant')

if __name__ == '__main__':
    build()
