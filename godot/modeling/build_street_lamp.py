"""街道路灯. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'height': 6.5,
 'post_r': 0.075,
 'base_r': 0.18,
 'base_h': 0.35,
 'arm': 1.3,
 'arm_r': 0.06,
 'lamp': (0.5, 0.16, 0.8)}

def build():
    reset()
    cylinder('foot',P['base_r'],P['base_h'],(0,P['base_h']/2,0),'metal_dark')
    cylinder('post',P['post_r'],P['height']-P['lamp'][1],(0,(P['height']-P['lamp'][1])/2,0),'metal')
    bar('forward_arm',(0,P['height']-P['lamp'][1],0),(0,P['height']-P['lamp'][1],P['arm']),P['arm_r'],'metal')
    box('lamp_head',P['lamp'],(0,P['height']-P['lamp'][1]/2,P['arm']),'metal_dark')
    box('light_face',(P['lamp'][0]*.75,P['lamp'][1]*.15,P['lamp'][2]*.8),(0,P['height']-P['lamp'][1],P['arm']),'accent')
    export('street_lamp')

if __name__ == '__main__':
    build()
