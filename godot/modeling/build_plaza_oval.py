"""椭圆棋桌广场. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'radius_x': 8, 'radius_z': 5, 'thickness': 0.025, 'curb_w': 0.18, 'curb_h': 0.07}

def build():
    reset()
    from math import sin,cos,pi
    n=64
    verts=[(P['radius_x']*cos(i*2*pi/n),y,P['radius_z']*sin(i*2*pi/n)) for y in (0,P['thickness']) for i in range(n)]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh('paving',verts,faces,'concrete')
    verts=[]
    for y,shrink in ((0,0),(0,P['curb_w']),(P['curb_h'],0),(P['curb_h'],P['curb_w'])):
        verts.extend(((P['radius_x']-shrink)*cos(i*2*pi/n),y,(P['radius_z']-shrink)*sin(i*2*pi/n)) for i in range(n))
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    mesh('continuous_curb',verts,faces,'concrete')
    export('plaza_oval')

if __name__ == '__main__':
    build()
