"""空调外机. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 1, 'height': 0.65, 'depth': 0.45, 'fan_r': 0.22, 'fan_t': 0.03, 'leg': 0.06}

def build():
    reset()
    box('housing',(P['width'],P['height'],P['depth']),(0,P['height']/2,0),'metal')
    cylinder('fan_face',P['fan_r'],P['fan_t'],(-P['width']*.15,P['height']/2,P['depth']/2+P['fan_t']/2),'metal_dark',axis=(0,0,1))
    for x in (-P['width']*.35,P['width']*.35):
        box('wall_bracket',(P['leg'],P['leg'],P['depth']),(x,P['leg']/2,0),'metal_dark')
    export('air_conditioner')

if __name__ == '__main__':
    build()
