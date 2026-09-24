"""电话亭. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 1.15,
 'depth': 1.05,
 'height': 2.35,
 'post': 0.09,
 'cap_h': 0.22,
 'panel_h': 1.65,
 'panel_bottom': 0.25,
 'panel_t': 0.03,
 'phone': (0.27, 0.42, 0.15),
 'phone_y': 1.3}

def build():
    reset()
    for x in (-P['width']/2,P['width']/2):
        for z in (-P['depth']/2,P['depth']/2):
            box('corner_post',(P['post'],P['height'],P['post']),(x,P['height']/2,z),'metal')
    box('roof',(P['width']+P['post'],P['cap_h'],P['depth']+P['post']),(0,P['height']-P['cap_h']/2,0),'metal_dark')
    box('back_panel',(P['width'],P['panel_h'],P['panel_t']),(0,P['panel_bottom']+P['panel_h']/2,-P['depth']/2),'window')
    for x in (-P['width']/2,P['width']/2):
        box('side_panel',(P['panel_t'],P['panel_h'],P['depth']),(x,P['panel_bottom']+P['panel_h']/2,0),'window')
    box('telephone',P['phone'],(0,P['phone_y'],-P['depth']/2+P['phone'][2]/2),'metal')
    export('phone_booth')

if __name__ == '__main__':
    build()
