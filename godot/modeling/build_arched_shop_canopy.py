"""Deterministic original prop; metres, Y up and +Z front.
Shape parameters are declared below; runtime supplies grayscale/outline style.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
from model_contacts import apply

NAME='arched_shop_canopy'
P=dict(profile=[(-1.4,.045),(-1.25,.38),(-.8,.68),(0,.84),(.8,.68),(1.25,.38),(1.4,.045)],
       depth=.8,thickness=.025,frame_radius=.018,frame_z=(-.385,.385),
       valance_size=(2.8,.12,.028),valance_at=(0,.06,.4))

def build():
    reset()
    profile=P['profile']; n=len(profile)
    vertices=[(x,y-offset,z) for offset in (0,P['thickness'])
              for z in (-P['depth']/2,P['depth']/2) for x,y in profile]
    faces=[]
    for i in range(n-1):
        faces += [(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),
                  (i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)]
    for i in (0,n-1): faces.append((i,n+i,3*n+i,2*n+i))
    mesh('arched_cover',vertices,faces,'fabric')
    for z in P['frame_z']:
        for a,b in zip(profile,profile[1:]):
            bar('arched_frame',(a[0],a[1]-P['thickness'],z),
                (b[0],b[1]-P['thickness'],z),P['frame_radius'],'metal')
    box('valance',P['valance_size'],P['valance_at'],'trim_dark')
    export(NAME)


if __name__=='__main__':
    build()
    apply(Path(__file__).resolve().parents[1]/'models'/f'{NAME}.glb')
