"""Electrical cabinet with a hollow shell and a door/handle sharing a real hinge."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from movable_prop_geometry import *

NAME = 'electrical_cabinet'
P = dict(base_size=(.85,.15,.55),base_center=(0,.075,0),
         body_size=(.78,1.25,.48),body_center=(0,.775,0),wall=.035,
         door_size=(.74,1.2,.035),door_center=(0,.775,.26),
         handle_size=(.04,.2,.06),handle_center=(.23,.82,.31),hinge_at=(-.415,.775,.278),
         hinge_y=(.4,1.15),mount_size=(.05,.06,.06),mount_x=-.4025,mount_z=.22,
         bracket_x=-.39,bracket_y_offset=-.065,bracket_radius=.012,
         pin_radius=.016,pin_height=.16,bearing_outer=.024,bearing_inner=.017,bearing_height=.09,
         leaf_size=(.057,.07,.012),leaf_x=-.3685,leaf_z=.27)
MOVING = {'CabinetDoor':dict(parts=['door','handle','hinge_leaf','hinge_leaf.001','door_bearing','door_bearing.001'],
    pivot='left_front',pivot_at=P['hinge_at'],axis=[0,1,0],degrees=[0,-110])}

def build():
    reset()
    box('base',P['base_size'],P['base_center'],'concrete')
    hollow_case('box',P['body_size'],P['body_center'],P['wall'],'metal',open_front=True)
    box('door',P['door_size'],P['door_center'],'trim_dark')
    box('handle',P['handle_size'],P['handle_center'],'metal')
    for y in P['hinge_y']:
        support_y=y+P['bracket_y_offset']
        box('hinge_mount',P['mount_size'],(P['mount_x'],support_y,P['mount_z']),'metal_dark')
        bar('hinge_bracket',(P['bracket_x'],support_y,P['mount_z']),
            (P['hinge_at'][0],support_y,P['hinge_at'][2]),P['bracket_radius'],'metal_dark')
        cylinder('hinge_pin',P['pin_radius'],P['pin_height'],(P['hinge_at'][0],y,P['hinge_at'][2]),'metal_dark')
        ring('door_bearing',P['bearing_outer'],P['bearing_inner'],P['bearing_height'],
            (P['hinge_at'][0],y,P['hinge_at'][2]),'metal')
        box('hinge_leaf',P['leaf_size'],(P['leaf_x'],y,P['leaf_z']),'metal')
    prepare_motion_groups(MOVING)
    export_movable(NAME,MOVING)

if __name__=='__main__': build()
