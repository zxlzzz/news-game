"""屋顶广告牌架. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 4, 'height': 2, 'base_h': 1, 'thickness': 0.12, 'foot_d': 1.8, 'leg': 0.1}

def build():
    reset()
    box('blank_sign',(P['width'],P['height'],P['thickness']),(0,P['base_h']+P['height']/2,0),'trim_dark')
    for x in (-P['width']/3,P['width']/3):
        box('foot',(P['leg'],P['leg'],P['foot_d']),(x,P['leg']/2,0),'metal')
        box('upright',(P['leg'],P['base_h']+P['height'],P['leg']),(x,(P['base_h']+P['height'])/2,-P['thickness']),'metal')
        bar('brace',(x,P['leg'],-P['foot_d']/2),(x,P['base_h']+P['height']/2,-P['thickness']),P['leg']/2,'metal')
    export('roof_billboard')

if __name__ == '__main__':
    build()
