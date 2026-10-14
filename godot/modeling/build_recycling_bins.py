"""Three hollow recycling bins with independent rear lid pivots."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from movable_prop_geometry import *

NAME = 'recycling_bins'
P = dict(bin_x=(-.75,0,.75),body_size=(.62,.95,.58),body_y=.475,wall=.025,
         lid_size=(.68,.08,.64),lid_y=.99,
         opening_size=(.32,.14,.03),opening_y=.78,opening_z=.305,opening_cut_depth=.10,
         slots=('metal','wall_plaster','wood'),hinge_y=.975,hinge_z=-.36,hinge_offset=.2,
         support_size=(.019,.065,.04),support_y=.9,support_z=-.29,support_offset=.035,support_radius=.008,
         pin_radius=.017,pin_width=.085,bearing_outer=.026,bearing_inner=.018,bearing_width=.045,
         ear_start_z=-.325,ear_y=.99,ear_z=-.28,ear_radius=.010)
MOVING = {f'LidHinge{i}':dict(parts=['lid'+('.%03d'%i if i else ''),f'lid_ear_{i}_left',f'lid_ear_{i}_right',
    f'lid_bearing_{i}_left',f'lid_bearing_{i}_right'],
    pivot='back_top',pivot_at=(x,P['hinge_y'],P['hinge_z']),axis=[1,0,0],degrees=[0,-105])
    for i,x in enumerate(P['bin_x'])}

def build():
    reset()
    for i,(x,slot) in enumerate(zip(P['bin_x'],P['slots'])):
        body=hollow_case('bin',P['body_size'],(x,P['body_y'],0),P['wall'],slot)
        box('lid',P['lid_size'],(x,P['lid_y'],0),'metal_dark')
        for side,offset in (('left',-P['hinge_offset']),('right',P['hinge_offset'])):
            xx=x+offset
            for support_side in (-1,1):
                sx=xx+support_side*P['support_offset']
                start=(sx,P['support_y'],P['support_z'])
                box('hinge_mount',P['support_size'],start,'metal_dark')
                bar('hinge_support',start,(sx,P['hinge_y'],P['hinge_z']),P['support_radius'],'metal_dark')
            cylinder('hinge_pin',P['pin_radius'],P['pin_width'],(xx,P['hinge_y'],P['hinge_z']),'metal',axis=(1,0,0))
            ring(f'lid_bearing_{i}_{side}',P['bearing_outer'],P['bearing_inner'],P['bearing_width'],
                (xx,P['hinge_y'],P['hinge_z']),'metal_dark',axis=(1,0,0))
            bar(f'lid_ear_{i}_{side}',(xx,P['hinge_y'],P['ear_start_z']),
                (xx,P['ear_y'],P['ear_z']),P['ear_radius'],'metal_dark')
        blind_cut(body,'opening',(P['opening_size'][0],P['opening_size'][1],P['opening_cut_depth']),
            (x,P['opening_y'],P['opening_z']))
    prepare_motion_groups(MOVING)
    export_movable(NAME,MOVING)

if __name__=='__main__': build()
