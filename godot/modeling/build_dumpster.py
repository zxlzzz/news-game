"""Dumpster with a real cavity, rear lid hinge and independent wheel pivots."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from movable_prop_geometry import *

NAME = 'dumpster'
P = dict(body_size=(1.8,.92,1.0),body_center=(0,.74,0),wall=.04,
         lid_size=(1.95,.14,1.12),lid_center=(0,1.27,0),
         wheel_radius=.14,wheel_width=.12,wheel_x=.75,wheel_z=.38,
         fork_width=.025,fork_depth=.07,
         wheel_axle_radius=.015,wheel_bore_radius=.018,wheel_axial_clearance=.003,
         fork_drop=.021,fork_embed=.008,wheel_axle_out=.004,
         hinge_x=.72,hinge_at=(0,1.23,-.61),support_size=(.035,.12,.05),
         support_y=1.11,support_z=-.50,support_offset=.065,support_radius=.012,
         pin_radius=.025,pin_width=.18,bearing_outer=.038,bearing_inner=.026,bearing_width=.08,
         ear_start_z=-.566,ear_y=1.265,ear_z=-.51,ear_radius=.015)
MOVING = {'LidHinge':dict(parts=['lid','lid_ear','lid_ear.001','lid_bearing','lid_bearing.001'],pivot='back_top',
    pivot_at=P['hinge_at'],axis=[1,0,0],degrees=[0,-105])}
for i,(x,z) in enumerate(((-P['wheel_x'],-P['wheel_z']),(-P['wheel_x'],P['wheel_z']),
                          (P['wheel_x'],-P['wheel_z']),(P['wheel_x'],P['wheel_z']))):
    MOVING[f'Wheel{i}'] = dict(parts=['wheel'+('.%03d'%i if i else '')],
        pivot='center',pivot_at=(x,P['wheel_radius'],z),axis=[1,0,0],degrees=[0,360])

def build():
    reset()
    hollow_case('container',P['body_size'],P['body_center'],P['wall'],'metal_dark')
    box('lid',P['lid_size'],P['lid_center'],'metal')
    for x in (-P['hinge_x'],P['hinge_x']):
        for side in (-1,1):
            xx=x+side*P['support_offset']
            start=(xx,P['support_y'],P['support_z'])
            box('rear_hinge_mount',P['support_size'],start,'metal')
            bar('rear_hinge_support',start,(xx,*P['hinge_at'][1:]),P['support_radius'],'metal')
        cylinder('hinge_pin',P['pin_radius'],P['pin_width'],(x,*P['hinge_at'][1:]),'metal',axis=(1,0,0))
        ring('lid_bearing',P['bearing_outer'],P['bearing_inner'],P['bearing_width'],
            (x,*P['hinge_at'][1:]),'metal_dark',axis=(1,0,0))
        bar('lid_ear',(x,P['hinge_at'][1],P['ear_start_z']),
            (x,P['ear_y'],P['ear_z']),P['ear_radius'],'metal_dark')
    for x in (-P['wheel_x'],P['wheel_x']):
        for z in (-P['wheel_z'],P['wheel_z']):
            ring('wheel',P['wheel_radius'],P['wheel_bore_radius'],P['wheel_width'],
                (x,P['wheel_radius'],z),'metal_dark',axis=(1,0,0))
            axle_length=P['wheel_width']+2*(P['wheel_axial_clearance']+P['fork_width']+P['wheel_axle_out'])
            cylinder('caster_axle',P['wheel_axle_radius'],axle_length,
                (x,P['wheel_radius'],z),'metal',axis=(1,0,0))
            bottom=P['body_center'][1]-P['body_size'][1]/2
            fork_low=P['wheel_radius']-P['fork_drop']
            fork_top=bottom+P['fork_embed']
            for sign in (-1,1):
                fork_x=x+sign*(P['wheel_width']/2+P['wheel_axial_clearance']+P['fork_width']/2)
                box('caster_fork',(P['fork_width'],fork_top-fork_low,P['fork_depth']),
                    (fork_x,(fork_low+fork_top)/2,z),'metal')
    prepare_motion_groups(MOVING)
    export_movable(NAME,MOVING)

if __name__=='__main__': build()
