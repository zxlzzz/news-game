"""Deterministic original prop; metres, Y up and +Z front.
Shape parameters are declared below; runtime supplies grayscale/outline style.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
from model_contacts import apply

NAME='held_guitar'
P=dict(lower_size=(.35,.4,.085),lower_at=(0,-.295,0),upper_size=(.29,.3,.08),upper_at=(0,-.065,0),
       neck_size=(.065,.5,.045),neck_at=(0,.305,0),head_size=(.09,.14,.05),head_at=(0,.625,0),
       hole_radius=.065,hole_y=-.11,hole_cut_depth=.06,hole_cut_z=.035,hole_back_z=.006,
       bridge_size=(.14,.035,.017),bridge_at=(0,-.345,.044),string_radius=.0009,string_spacing=.009,
       string_start_y=-.345,string_end_y=.66,string_z=.054,nut_y=.555,nut_size=(.072,.012,.012),
       fingerboard_size=(.065,.5,.028),fingerboard_at=(0,.305,.0355),
       fret_y=(.12,.20,.28,.36,.44,.50),fret_size=(.066,.003,.004),fret_z=.0515,
       tuning_y=(.585,.625,.665),peg_radius=.008,peg_length=.038,peg_x=.055,
       tuner_post_x=.026,tuner_post_y=.038,tuner_post_depth=.03,
       grips={'grip_left':(0,.275,0),'grip_right':(0,-.275,0)})

def build():
    reset()
    bodies=[ellipsoid('lower_body',P['lower_size'],P['lower_at'],'wood'),
            ellipsoid('upper_body',P['upper_size'],P['upper_at'],'wood')]
    for body in bodies:
        cutter=cylinder('hole_cut',P['hole_radius'],P['hole_cut_depth'],(0,P['hole_y'],P['hole_cut_z']),None,axis=(0,0,1))
        subtract(body,cutter,'soundhole')
    cylinder('soundhole_back',P['hole_radius'],P['hole_back_z'],(0,P['hole_y'],P['hole_back_z']/2),'metal_dark',axis=(0,0,1))
    box('neck',P['neck_size'],P['neck_at'],'wood')
    box('fingerboard',P['fingerboard_size'],P['fingerboard_at'],'trim_dark')
    box('head',P['head_size'],P['head_at'],'wood')
    box('bridge',P['bridge_size'],P['bridge_at'],'trim_dark')
    box('nut',P['nut_size'],(0,P['nut_y'],P['string_z']),'trim')
    for y in P['fret_y']:box('fret',P['fret_size'],(0,y,P['fret_z']),'metal')
    for i in range(6):
        x=(i-2.5)*P['string_spacing']
        bar('string',(x,P['string_start_y'],P['string_z']),(x,P['nut_y'],P['string_z']),P['string_radius'],'metal')
        side=-1 if i<3 else 1
        end=(side*P['tuner_post_x'],P['tuning_y'][i%3],P['tuner_post_y']+P['tuner_post_depth']/2)
        bar('head_string',(x,P['nut_y'],P['string_z']),end,P['string_radius'],'metal')
        cylinder('tuner_post',P['peg_radius'],P['tuner_post_depth'],
            (end[0],end[1],P['tuner_post_y']),'metal',axis=(0,0,1))
    for side in (-1,1):
        for y in P['tuning_y']:
            cylinder('tuning_peg',P['peg_radius'],P['peg_length'],(side*P['peg_x'],y,0),'metal',axis=(1,0,0))
    for name,position in P['grips'].items():
        node=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(node);node.location=xyz(position)
    export(NAME)


if __name__=='__main__':
    build()
    apply(Path(__file__).resolve().parents[1]/'models'/f'{NAME}.glb')
