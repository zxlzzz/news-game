"""Deterministic original prop; metres, Y up and +Z front.
Shape parameters are declared below; runtime supplies grayscale/outline style.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
from model_contacts import apply

NAME='broken_cup'
P=dict(radius=.075,wall=.007,foot=.006,
       retained_angles=(-150,-125,-100,-75,-50,-25,0,25),
       retained_heights=(.055,.078,.065,.10,.083,.063,.043,.029),
       loose_angles=(25,50,75,100,125),loose_heights=(.028,.035,.025,.04,.03),
       loose_at=(.105,0,-.07),
       shards=[([(-.055,0),(.028,-.02),(.015,.058)],(-.10,0,.09)),
               ([(-.032,0),(.042,.008),(.003,.065)],(.035,0,.13))],
       handle_center=(-.095,.009,-.09),handle_radius=.025,handle_tube=.009,
       handle_angles=(0,35,70,105,140,175,210))

def fractured_wall(name,angles,heights,at):
    n=len(angles); points=[]
    for inner in (False,True):
        r=P['radius']-(P['wall'] if inner else 0)
        for top in (False,True):
            for angle,h in zip(angles,heights):
                a=angle*pi/180
                points.append((at[0]+r*cos(a),at[1]+(h if top else 0),at[2]+r*sin(a)))
    faces=[]
    for i in range(n-1):
        faces += [(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),
                  (n+i,n+i+1,3*n+i+1,3*n+i),(i,2*n+i,2*n+i+1,i+1)]
    for i in (0,n-1):faces.append((i,n+i,3*n+i,2*n+i))
    mesh(name,points,faces,'trim')

def build():
    reset()
    fractured_wall('ragged_cup_wall',P['retained_angles'],P['retained_heights'],(0,0,0))
    fractured_wall('low_broken_wall',P['loose_angles'],P['loose_heights'],P['loose_at'])
    for i,(outline,at) in enumerate(P['shards']):
        vertices=[(x+at[0],y,z+at[2]) for y in (0,P['foot']) for x,z in outline]
        mesh(f'ceramic_shard_{i}',vertices,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'trim')
    center=P['handle_center']; r=P['handle_radius']
    points=[(center[0]+r*cos(a*pi/180),center[1],center[2]+r*sin(a*pi/180))
            for a in P['handle_angles']]
    for a,b in zip(points,points[1:]):bar('broken_handle',a,b,P['handle_tube'],'trim')
    export(NAME)


if __name__=='__main__':
    build()
    apply(Path(__file__).resolve().parents[1]/'models'/f'{NAME}.glb')
