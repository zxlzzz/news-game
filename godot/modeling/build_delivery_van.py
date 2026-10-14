"""Delivery van: continuous cargo/cab shell with a sloped windshield and short bonnet."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *
from vehicle_geometry import loft, fitted_glazing, finish_wheeled_vehicle

P = {
    'width': 1.8, 'bottom': .30, 'shoulder': 1.03, 'roof_inset': .065,
    'roof_bevel': .08, 'stations': [(-2.25,1.95),(.90,1.95),(1.18,1.95),(1.88,1.12),(2.25,1.05)],
    'wheel_r': .34, 'wheel_t': .18, 'hub_r': .1632, 'hub_t': .20,
    'wheel_x': .90, 'axles_z': (-1.35,1.30), 'wheel_clearance': .035,
    'axle_r': .035, 'axle_gap': .004, 'glass_t': .012, 'glass_inset': .001,
    'windshield': [(-.72,1.23),(.72,1.23),(.68,1.84),(-.68,1.84)],
    'side_window': [(1.04,1.16),(1.69,1.16),(1.15,1.82),(1.04,1.82)],
    'sliding_door_size': (.012,1.28,1.53), 'sliding_door_center': (-.901,1.04,-.25),
    'door_handle_size': (.028,.055,.21), 'door_handle_center': (-.919,1.18,.30),
    'bumper_size': (1.78,.17,.10), 'bumper_y': .52, 'bumper_z': (-2.28,2.28),
    'headlamp_size': (.30,.18,.04), 'headlamp_y': .88, 'headlamp_z': 2.253,
    'taillamp_size': (.16,.30,.035), 'taillamp_y': .94, 'taillamp_z': -2.253,
    'lamp_x': .62, 'rear_door_size': (.73,1.39,.012),
    'rear_door_y': 1.065, 'rear_door_z': -2.251, 'rear_door_x': .388,
}

def build():
    reset()
    half=P['width']/2
    roof=half-P['roof_inset']
    sections=[]
    for z,top in P['stations']:
        belt=min(P['shoulder'],top-P['roof_bevel'])
        sections.append((z,[(-half,P['bottom']),(half,P['bottom']),
            (half,belt),(half,top-P['roof_bevel']),(roof,top),
            (-roof,top),(-half,top-P['roof_bevel']),(-half,belt)]))
    body=loft('body',sections,'metal')
    for x in (-P['wheel_x'],P['wheel_x']):
        for z in P['axles_z']:
            cylinder('tire',P['wheel_r'],P['wheel_t'],(x,P['wheel_r'],z),'metal_dark',axis=(1,0,0))
            cylinder('hub',P['hub_r'],P['hub_t'],(x,P['wheel_r'],z),'metal',axis=(1,0,0))
        fitted_glazing('side_window',[(y,z) for z,y in P['side_window']],body,0,
            1 if x>0 else -1,P['glass_t'],P['glass_inset'])
    fitted_glazing('windshield',P['windshield'],body,2,1,P['glass_t'],P['glass_inset'])
    box('sliding_door',P['sliding_door_size'],P['sliding_door_center'],'metal_dark')
    box('door_handle',P['door_handle_size'],P['door_handle_center'],'metal')
    for z in P['bumper_z']:
        box('bumper',P['bumper_size'],(0,P['bumper_y'],z),'metal_dark')
    for x in (-P['lamp_x'],P['lamp_x']):
        box('headlight',P['headlamp_size'],(x,P['headlamp_y'],P['headlamp_z']),'accent')
        box('taillight',P['taillamp_size'],(x,P['taillamp_y'],P['taillamp_z']),'trim_dark')
    for x in (-P['rear_door_x'],P['rear_door_x']):
        box('rear_door',P['rear_door_size'],(x,P['rear_door_y'],P['rear_door_z']),'metal')
    finish_wheeled_vehicle(bpy.context.scene.objects,P['wheel_clearance'],P['axle_r'],P['axle_gap'])
    export('delivery_van')

if __name__ == '__main__':
    build()
    from movable_prop_geometry import annotate_model_motion
    annotate_model_motion('delivery_van')
