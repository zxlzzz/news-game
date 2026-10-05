"""垃圾桶. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 0.58, 'height': 0.92, 'depth': 0.52, 'cap_h': 0.12, 'inlet': (0.38, 0.18, 0.03), 'inlet_y': 0.7, 'wall_t': 0.035}

def build():
    reset()
    w,h,d,t=P['width'],P['height']-P['cap_h'],P['depth'],P['wall_t']
    box('bottom',(w,t,d),(0,t/2,0),'metal')
    for sign in (-1,1): box('wall',(t,h,d),(sign*(w-t)/2,h/2,0),'metal')
    box('back',(w,h,t),(0,h/2,-(d-t)/2),'metal')
    bottom=P['inlet_y']-P['inlet'][1]/2
    box('front',(w,bottom,t),(0,bottom/2,(d-t)/2),'metal')
    for sign in (-1,1):
        width=(w-P['inlet'][0])/2
        box('front_side',(width,h-bottom,t),(sign*(w-width)/2,(h+bottom)/2,(d-t)/2),'metal')
    box('lid',(w,P['cap_h'],d),(0,P['height']-P['cap_h']/2,0),'metal_dark')
    export('trash_bin')

if __name__ == '__main__':
    build()
