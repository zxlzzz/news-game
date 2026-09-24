"""自行车道标志. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'wheel_r': 0.28,
 'wheel_z': (-0.5, 0.5),
 'line_w': 0.07,
 'lift': 0.003,
 'segments': 32,
 'lines': [((0, -0.5), (-0.24, 0)),
           ((-0.24, 0), (0.17, 0.04)),
           ((0.17, 0.04), (0, -0.5)),
           ((-0.24, 0), (-0.23, 0.5)),
           ((-0.23, 0.5), (0.17, 0.04)),
           ((-0.23, 0.5), (0, 0.5)),
           ((-0.23, 0.5), (-0.36, 0.56)),
           ((0.17, -0.1), (0.17, 0.16))]}

def build():
    reset()
    from math import sin,cos,pi,hypot
    for z in P['wheel_z']:
        n=P['segments']; vertices=[]
        for r in (P['wheel_r']-P['line_w']/2,P['wheel_r']+P['line_w']/2):
            vertices.extend((r*cos(i*2*pi/n),P['lift'],z+r*sin(i*2*pi/n)) for i in range(n))
        mesh('paint_wheel',vertices,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],'paint')
    for a,b in P['lines']:
        dx,dz=b[0]-a[0],b[1]-a[1]; length=hypot(dx,dz)
        ox,oz=-dz/length*P['line_w']/2,dx/length*P['line_w']/2
        mesh('paint_frame',[(a[0]+ox,P['lift'],a[1]+oz),(a[0]-ox,P['lift'],a[1]-oz),
            (b[0]-ox,P['lift'],b[1]-oz),(b[0]+ox,P['lift'],b[1]+oz)],[(0,3,2,1)],'paint')
    export('bicycle_marking')

if __name__ == '__main__':
    build()
