"""屋顶太阳能板. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 2.8, 'depth': 1.7, 'low': 0.35, 'rise': 0.65, 'thickness': 0.06, 'leg': 0.08, 'rail_y': 0.17}

def build():
    reset()
    roof_panel('panel',P['width'],P['depth'],P['low'],P['rise'],P['thickness'],0,'metal_dark')
    for z,h in ((P['depth']/2,P['low']),(-P['depth']/2,P['low']+P['rise'])):
        for x in (-P['width']/3,P['width']/3):
            box('support',(P['leg'],h,P['leg']),(x,h/2,z),'metal')
    for x in (-P['width']/2,P['width']/2):
        bar('panel_rim',(x,P['low'],P['depth']/2),(x,P['low']+P['rise'],-P['depth']/2),P['leg']/2,'metal')
    export('roof_solar_panel')

if __name__ == '__main__':
    build()
