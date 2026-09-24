"""开放报刊架. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 0.85,
 'depth': 0.48,
 'height': 1.4,
 'post': 0.055,
 'shelf_t': 0.05,
 'shelf_y': (0.3, 0.68, 1.06),
 'header_h': 0.22,
 'paper_w': 0.55,
 'paper_h': 0.25,
 'paper_t': 0.03}

def build():
    reset()
    for x in (-P['width']/2,P['width']/2):
        box('side_post',(P['post'],P['height'],P['post']),(x,P['height']/2,-P['depth']/2),'metal_dark')
        box('foot',(P['post'],P['post'],P['depth']),(x,P['post']/2,0),'metal_dark')
    for y in P['shelf_y']:
        box('shelf',(P['width'],P['shelf_t'],P['depth']),(0,y,0),'metal')
        box('front_lip',(P['width'],P['shelf_t']*2,P['shelf_t']),(0,y+P['shelf_t'],P['depth']/2),'metal')
        box('newspaper_block',(P['paper_w'],P['paper_h'],P['paper_t']),(0,y+P['paper_h']/2,-P['depth']/4),'concrete')
    box('blank_header',(P['width'],P['header_h'],P['post']),(0,P['height']-P['header_h']/2,-P['depth']/2),'trim_dark')
    export('news_rack')

if __name__ == '__main__':
    build()
