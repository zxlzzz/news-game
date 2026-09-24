"""拱顶招牌. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 2.4, 'height': 0.85, 'depth': 0.16, 'style': 'arch', 'border': 0.08}

def build():
    reset()
    w,h,d=P['width'],P['height'],P['depth']
    if P['style']=='arch':
        prism('arched_sign',[(-w/2,0),(w/2,0),(w/2,h*.65),(w*.3,h),(-w*.3,h),(-w/2,h*.65)],d,(0,0,0),'trim_dark')
    elif P['style']=='blade':
        prism('hanging_sign',[(-w*.4,0),(w*.4,0),(w/2,h*.15),(w/2,h*.5),(w*.4,h*.65),(-w*.4,h*.65),(-w/2,h*.5),(-w/2,h*.15)],d,(0,0,0),'wood')
        box('hanging_bar',(w,P['border'],P['border']),(0,h-P['border']/2,0),'metal_dark')
        for x in (-w*.3,w*.3):
            box('hanger',(P['border'],h*.35,P['border']),(x,h*.825,0),'metal_dark')
    else:
        box('blank_sign',(w,h,d),(0,h/2,0),'trim_dark')
        box('sign_inset',(w-2*P['border'],h-2*P['border'],P['border']/2),(0,h/2,d/2),'wood' if P['style']=='blade' else 'metal')
    export('shop_sign_arch')

if __name__ == '__main__':
    build()
