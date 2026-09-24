"""公交站牌. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'post_h': 2.7,
 'post_r': 0.045,
 'foot_r': 0.15,
 'foot_h': 0.08,
 'panel': (0.55, 0.85, 0.08),
 'panel_y': 2.22,
 'inset': (0.39, 0.57, 0.025)}

def build():
    reset()
    cylinder('foot',P['foot_r'],P['foot_h'],(0,P['foot_h']/2,0),'metal_dark')
    cylinder('pole',P['post_r'],P['post_h'],(0,P['post_h']/2,0),'metal')
    box('sign',P['panel'],(0,P['panel_y'],0),'metal')
    box('blank_timetable',P['inset'],(0,P['panel_y'],P['panel'][2]/2),'concrete')
    export('bus_stop_sign')

if __name__ == '__main__':
    build()
