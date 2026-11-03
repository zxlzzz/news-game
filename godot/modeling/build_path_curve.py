"""小径四分之一弯段. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 2, 'center_radius': 3, 'thickness': 0.025, 'curb_w': 0.15, 'curb_h': 0.07, 'segments': 24}

def build():
    reset()
    from math import sin,cos,pi
    # Quarter annulus centred at (-R,0,-R); origin is the occupied arc midpoint.
    r=P['center_radius']; shift=r/(2**.5)
    def arc(name,inner,outer,height):
        n=P['segments']+1
        vertices=[]
        for y,rad in ((0,inner),(0,outer),(height,inner),(height,outer)):
            vertices.extend((rad*cos(i*pi/2/(n-1))-shift,y,rad*sin(i*pi/2/(n-1))-shift) for i in range(n))
        faces=[]
        for i in range(n-1):
            j=i+1
            faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
        faces.extend([(0,n,3*n,2*n),(n-1,3*n-1,4*n-1,2*n-1)])
        mesh(name,vertices,faces,'concrete')
    arc('paving',r-P['width']/2,r+P['width']/2,P['thickness'])
    arc('inner_curb',r-P['width']/2,r-P['width']/2+P['curb_w'],P['curb_h'])
    arc('outer_curb',r+P['width']/2-P['curb_w'],r+P['width']/2,P['curb_h'])
    export('path_curve')

if __name__ == '__main__':
    build()
