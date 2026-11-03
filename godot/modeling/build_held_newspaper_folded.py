"""Deterministic original prop; metres, Y up and +Z front.
Shape parameters are declared below; runtime supplies grayscale/outline style.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
from model_contacts import apply

NAME='held_newspaper_folded'
P=dict(width=.15,bottom_y=-.24,top_y=.06,thickness=.003,slope=-.01125/.24,
       headline_width=.12,headline_bottom=-.0075,headline_top=.0375,print_thickness=.0007)

def strip(name,width,bottom,top,offset,thickness,slot):
    vertices=[(x,y,y*P['slope']+z) for z in (offset,offset+thickness)
              for x,y in [(-width/2,bottom),(width/2,bottom),(width/2,top),(-width/2,top)]]
    mesh(name,vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],slot)

def build():
    reset()
    strip('folded_paper',P['width'],P['bottom_y'],P['top_y'],-P['thickness']/2,P['thickness'],'trim')
    strip('headline',P['headline_width'],P['headline_bottom'],P['headline_top'],P['thickness']/2,P['print_thickness'],'metal_dark')
    export(NAME)


if __name__=='__main__':
    build()
    apply(Path(__file__).resolve().parents[1]/'models'/f'{NAME}.glb')
