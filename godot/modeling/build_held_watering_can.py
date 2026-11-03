"""Deterministic original prop; metres, Y up and +Z front.
Shape parameters are declared below; runtime supplies grayscale/outline style.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
from model_contacts import apply

NAME='held_watering_can'
P=dict(body_radius=.15,body_inner=.132,body_height=.28,body_at=(-.12,-.12,0),bottom_height=.016,
       spout_start=(-.2,-.16,0),spout_end=(-.48,.05,0),spout_radius=.035,
       rose_radius=.07,rose_height=.04,rose_at=(-.5,.065,0),rose_axis=(-1,1,0),
       hole_radius=.006,hole_offsets=((0,0),(.027,0),(-.027,0),(0,.027),(0,-.027)),
       handle_outer=.12,handle_inner=.085,handle_height=.045,handle_at=(.065,0,0))

def build():
    reset()
    ring('open_reservoir',P['body_radius'],P['body_inner'],P['body_height'],P['body_at'],'metal')
    bottom_y=P['body_at'][1]-P['body_height']/2+P['bottom_height']/2
    cylinder('reservoir_bottom',P['body_radius'],P['bottom_height'],(P['body_at'][0],bottom_y,0),'metal')
    bar('spout',P['spout_start'],P['spout_end'],P['spout_radius'],'metal')
    rose=cylinder('rose',P['rose_radius'],P['rose_height'],P['rose_at'],'metal',axis=P['rose_axis'])
    normal=Vector(P['rose_axis']).normalized(); radial=Vector((1,1,0)).normalized()
    for along,z in P['hole_offsets']:
        center=Vector(P['rose_at'])+radial*along+Vector((0,0,z))
        cutter=cylinder('rose_outlet',P['hole_radius'],P['rose_height']*1.5,center,None,axis=normal)
        subtract(rose,cutter,'outlet')
    ring('handle',P['handle_outer'],P['handle_inner'],P['handle_height'],P['handle_at'],'metal_dark',axis=(0,0,1))
    export(NAME)


if __name__=='__main__':
    build()
    apply(Path(__file__).resolve().parents[1]/'models'/f'{NAME}.glb')
