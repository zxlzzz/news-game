"""邮筒. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 0.52,
 'depth': 0.42,
 'height': 1.25,
 'base_h': 0.4,
 'post_w': 0.16,
 'slot_w': 0.34,
 'slot_h': 0.08,
 'slot_y': 1.05,
 'plate_t': 0.025}

def build():
    reset()
    box('post',(P['post_w'],P['base_h'],P['post_w']),(0,P['base_h']/2,0),'metal_dark')
    box('box',(P['width'],P['height']-P['base_h'],P['depth']),(0,(P['height']+P['base_h'])/2,0),'metal')
    box('letter_slot',(P['slot_w'],P['slot_h'],P['plate_t']),(0,P['slot_y'],P['depth']/2),'metal_dark')
    export('mailbox')

if __name__ == '__main__':
    build()
