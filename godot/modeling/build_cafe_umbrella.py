"""咖啡馆遮阳伞. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'radius': 1.35,
 'height': 2.9,
 'canopy_h': 0.85,
 'canopy_t': 0.035,
 'rim_lift': 0.09,
 'rib_count': 8,
 'rib_r': 0.025,
 'post_r': 0.035,
 'base_r': 0.27,
 'base_h': 0.1}

def build():
    reset()
    cylinder('base',P['base_r'],P['base_h'],(0,P['base_h']/2,0),'concrete')
    cylinder('post',P['post_r'],P['height'],(0,P['height']/2,0),'metal')
    # Thin, closed conical shell. Bottom is another cone, not a solid filled cone.
    from math import pi,cos,sin
    n=CIRCLE_SEGMENTS
    verts=[]
    for dy in (0,-P['canopy_t']):
        verts.append((0,P['height']+dy,0))
        verts.extend((P['radius']*cos(i*2*pi/n),P['height']-P['canopy_h']+dy+P['rim_lift']*abs(sin(i*pi*P['rib_count']/n)),P['radius']*sin(i*2*pi/n)) for i in range(n))
    faces=[]
    for i in range(n):
        a,b=1+i,1+(i+1)%n
        faces.extend([(0,a,b),(n+1,b+n+1,a+n+1),(a,a+n+1,b+n+1,b)])
    mesh('canopy_shell',verts,faces,'fabric')
    # Eight visible radial seams/ribs and a scalloped hem make the canopy legible from above.
    for i in range(P['rib_count']):
        angle=i*2*pi/P['rib_count']
        bar('canopy_rib',(0,P['height'],0),
            (P['radius']*cos(angle),P['height']-P['canopy_h'],P['radius']*sin(angle)),P['rib_r'],'metal')
    export('cafe_umbrella')

if __name__ == '__main__':
    build()
