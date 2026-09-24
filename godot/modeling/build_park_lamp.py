"""公园柱灯. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'height': 4, 'post_r': 0.06, 'base_r': 0.16, 'base_h': 0.3, 'head_r': 0.24, 'head_h': 0.42, 'cap_h': 0.08}

def build():
    reset()
    cylinder('base',P['base_r'],P['base_h'],(0,P['base_h']/2,0),'metal_dark')
    cylinder('post',P['post_r'],P['height']-P['head_h'],(0,(P['height']-P['head_h'])/2,0),'metal')
    cylinder('lantern',P['head_r'],P['head_h'],(0,P['height']-P['head_h']/2,0),'metal')
    cylinder('cap',P['head_r']*1.1,P['cap_h'],(0,P['height']-P['cap_h']/2,0),'metal_dark')
    export('park_lamp')

if __name__ == '__main__':
    build()
