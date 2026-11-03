"""实线段. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 0.12, 'length': 6, 'dashes': False, 'dash_l': 1.2, 'dash_centers': (-2.4, 0, 2.4), 'lift': 0.003}

def build():
    reset()
    for z in (P['dash_centers'] if P['dashes'] else (0,)):
        w=P['width']/2; l=(P['dash_l'] if P['dashes'] else P['length'])/2; y=P['lift']
        mesh('paint',[(-w,y,z-l),(w,y,z-l),(w,y,z+l),(-w,y,z+l)],[(0,3,2,1)],'paint')
    export('lane_line_solid')

if __name__ == '__main__':
    build()
