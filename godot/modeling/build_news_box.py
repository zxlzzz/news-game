"""报纸箱. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 0.72,
 'depth': 0.54,
 'height': 1.18,
 'plinth_h': 0.12,
 'window': (0.53, 0.55, 0.035),
 'window_y': 0.72,
 'header_h': 0.2,
 'handle': (0.22, 0.055, 0.09)}

def build():
    reset()
    box('plinth',(P['width'],P['plinth_h'],P['depth']),(0,P['plinth_h']/2,0),'metal_dark')
    box('cabinet',(P['width'],P['height']-P['plinth_h'],P['depth']),(0,(P['height']+P['plinth_h'])/2,0),'metal')
    box('display',P['window'],(0,P['window_y'],P['depth']/2),'window')
    box('blank_masthead',(P['width'],P['header_h'],P['window'][2]),(0,P['height']-P['header_h']/2,P['depth']/2),'trim_dark')
    box('handle',P['handle'],(0,P['window_y']-P['window'][1]/2,P['depth']/2+P['handle'][2]/2),'accent')
    export('news_box')

if __name__ == '__main__':
    build()
