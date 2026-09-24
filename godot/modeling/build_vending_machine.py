"""自动售货机. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 1.05,
 'depth': 0.8,
 'height': 1.9,
 'screen': (0.6, 1.1, 0.035),
 'screen_x': -0.13,
 'screen_y': 1.13,
 'controls': (0.12, 0.48, 0.03),
 'tray': (0.65, 0.16, 0.06),
 'tray_y': 0.35}

def build():
    reset()
    box('cabinet',(P['width'],P['height'],P['depth']),(0,P['height']/2,0),'metal')
    box('display',P['screen'],(P['screen_x'],P['screen_y'],P['depth']/2),'window')
    box('controls',P['controls'],(P['width']*.36,P['screen_y'],P['depth']/2),'trim_dark')
    box('pickup_tray',P['tray'],(0,P['tray_y'],P['depth']/2),'metal_dark')
    export('vending_machine')

if __name__ == '__main__':
    build()
