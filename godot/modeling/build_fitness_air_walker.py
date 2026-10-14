"""Air walker with outboard pendulums and clear, cantilevered foot platforms."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
NAME = 'fitness_air_walker'
# Metres, Y up. Front bar and outboard arms leave room for an upright stride.
P = dict(post_x=.65, post_h=1.4, post_r=.065, bar_r=.05, grip_z=-.35,
         arm_x=.54, arm_r=.035, plate_x=.20,
         plate_y=.23, plate_z=.08, plate_size=(.30,.07,.48),
         base_size=(.20,.08,.52), bearing_r=.07, bearing_l=.20,
         support_h=.04, support_depth=.12, rim_w=.02, rim_h=.04,
         bearing_clearance=.005, axis_ring_r=.10, axis_ring_l=.08, arm_top_drop=.085)

def build():
    reset()
    for sign in (-1,1):
        bar('upright',(sign*P['post_x'],0,0),(sign*P['post_x'],P['post_h'],0),P['post_r'],'metal')
        box('base',P['base_size'],(sign*P['post_x'],P['base_size'][1]/2,0),'metal_dark')
        cylinder('pivot_bearing',P['bearing_r'],P['bearing_l'],(sign*P['arm_x'],P['post_h'],0),'metal_dark',axis=(1,0,0))
    for sign in (-1,1):
        bar('handle_support',(sign*P['post_x'],P['post_h'],0),(sign*P['post_x'],P['post_h'],P['grip_z']),P['bar_r'],'metal_dark')
    bar('crossbar',(-P['post_x'],P['post_h'],P['grip_z']),(P['post_x'],P['post_h'],P['grip_z']),P['bar_r'],'metal_dark')
    # Left/right mesh names remain stable for contact and articulation data.
    for side,sign in [('left',-1),('right',1)]:
        support_y=P['plate_y']-P['plate_size'][1]/2-P['support_h']/2
        ring('swing_axis_ring', P['axis_ring_r'], P['bearing_r'] + P['bearing_clearance'],
             P['axis_ring_l'], (sign * P['arm_x'], P['post_h'], 0), 'metal', axis=(1, 0, 0))
        bar('swing_arm',(sign*P['arm_x'],support_y,P['plate_z']),
            (sign*P['arm_x'],P['post_h']-P['arm_top_drop'],0),P['arm_r'],'metal')
        box('footplate',P['plate_size'],(sign*P['plate_x'],P['plate_y'],P['plate_z']),'metal_dark')
        reach=P['arm_x']-P['plate_x']
        box('cantilever_'+side,(reach+P['arm_r']*2,P['support_h'],P['support_depth']),
            (sign*(P['arm_x']+P['plate_x'])/2,support_y,P['plate_z']),'metal')
        w,h,l=P['plate_size']; top=P['plate_y']+h/2
        for edge in (-1,1):
            box('rim_'+side,(P['rim_w'],P['rim_h'],l),
                (sign*P['plate_x']+edge*(w-P['rim_w'])/2,top+P['rim_h']/2,P['plate_z']),'metal')
        box('heel_stop_'+side,(w-2*P['rim_w'],P['rim_h'],P['rim_w']),
            (sign*P['plate_x'],top+P['rim_h']/2,P['plate_z']+(l-P['rim_w'])/2),'metal')
    export(NAME)
    from model_contacts import apply
    apply(Path(__file__).resolve().parents[1]/'models'/f'{NAME}.glb')

if __name__=='__main__': build()


# Independent model articulation is declared alongside the model build data.
if __name__ == "__main__":
    import sys as _motion_sys
    from pathlib import Path as _MotionPath
    _motion_sys.path.insert(0, str(_MotionPath(__file__).resolve().parent))
    from movable_prop_geometry import annotate_model_motion as _annotate_model_motion
    _annotate_model_motion("fitness_air_walker")
