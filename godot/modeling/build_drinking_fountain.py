"""Deterministic original prop; metres, Y up and +Z front.
Shape parameters are declared below; runtime supplies grayscale/outline style.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
from model_contacts import apply

NAME='drinking_fountain'
P=dict(column_radius=.18,column_height=.83,basin_outer=.32,basin_inner=.25,
       basin_height=.13,basin_y=.895,floor_height=.04,floor_y=.85,drain_radius=.037,
       pipe_start=(0,.9,-.19),pipe_elbow=(0,1.1,-.19),pipe_end=(0,1.1,-.02),
       pipe_radius=.035,outlet_inner=.023,outlet_depth=.09)

def build():
    reset()
    cylinder('column',P['column_radius'],P['column_height'],(0,P['column_height']/2,0),'metal')
    ring('basin',P['basin_outer'],P['basin_inner'],P['basin_height'],(0,P['basin_y'],0),'metal')
    floor=ring('basin_floor',P['basin_inner'],P['drain_radius'],P['floor_height'],(0,P['floor_y'],0),'metal')
    cylinder('drain_recess',P['drain_radius'],P['floor_height']/2,(0,P['floor_y']-P['floor_height']/2,0),'metal_dark')
    bar('pipe_stem',P['pipe_start'],P['pipe_elbow'],P['pipe_radius'],'metal_dark')
    tip=bar('spout',P['pipe_elbow'],P['pipe_end'],P['pipe_radius'],'metal_dark')
    center=(P['pipe_end'][0],P['pipe_end'][1],P['pipe_end'][2]-P['outlet_depth']/2)
    cutter=cylinder('outlet_cut',P['outlet_inner'],P['outlet_depth']*1.02,center,None,axis=(0,0,1))
    subtract(tip,cutter,'real_outlet')
    export(NAME)


if __name__=='__main__':
    build()
    apply(Path(__file__).resolve().parents[1]/'models'/f'{NAME}.glb')
