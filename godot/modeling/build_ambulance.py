"""Deterministic ambulance: joined medical body and shaped driving cab, +Z front."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *
from vehicle_geometry import side_prism, fitted_glazing, finish_wheeled_vehicle

NAME = 'ambulance'
P = {
    'width': 2.0, 'rear_z': -2.9, 'front_z': 2.9,
    'floor_y': 0.625, 'body_floor_y': 0.7, 'medical_front_z': 1.24,
    'medical_roof_y': 2.4, 'cab_rear_z': 1.18, 'cab_roof_front_z': 2.10,
    'cab_roof_y': 2.15, 'windscreen_bottom_z': 2.72, 'bonnet_y': 1.27,
    'nose_y': 1.16, 'wheel_r': 0.43, 'wheel_t': 0.18,
    'hub_r': 0.2064, 'hub_t': 0.20, 'axle_x': 1.0,
    'axles_z': [-1.74, 1.682], 'arch_gap': 0.05,
    'axle_r': 0.045, 'axle_gap': 0.004,
    'pane_t': 0.04, 'pane_inset': 0.008,
    'windscreen_outline': [(-0.8,1.37),(0.8,1.37),(0.8,2.04),(-0.8,2.04)],
    'side_window_outline': [(1.36,1.34),(2.02,1.34),(2.02,2.01),(1.36,2.55)],
    'bumper_size': [2.08,0.18,0.18], 'bumper_y': 0.62,
    'headlight_size': [0.35,0.20,0.05], 'headlight_y': 1.0, 'headlight_x': 0.60,
    'grille_size': [0.65,0.18,0.03], 'grille_y': 0.88,
    'cross_z': -0.95, 'cross_y': 1.55, 'cross_length': 0.65, 'cross_width': 0.18,
    'cross_depth': 0.03, 'rear_lamp_size': [0.20,0.34,0.04],
    'rear_lamp_x': 0.78, 'rear_lamp_y': 0.97,
    'lightbar_size': [1.3,0.15,0.2], 'lightbar_y': 2.28, 'lightbar_z': 1.64,
    'lightbar_foot_size': [0.15,0.055,0.15], 'lightbar_foot_x': 0.43333333333333335,
    'rail_width': 0.18, 'chassis_height': 0.25, 'chassis_y': 0.5,
}


def build():
    reset()
    for x in (-P['axle_x'], P['axle_x']):
        for z in P['axles_z']:
            cylinder('tire',P['wheel_r'],P['wheel_t'],(x,P['wheel_r'],z),'metal_dark',(1,0,0))
            cylinder('hub',P['hub_r'],P['hub_t'],(x,P['wheel_r'],z),'metal',(1,0,0))
    box('chassis',(P['width'],P['chassis_height'],P['front_z']-P['rear_z']),(0,P['chassis_y'],0),'metal_dark')
    medical_length=P['medical_front_z']-P['rear_z']
    medical_center=(P['medical_front_z']+P['rear_z'])/2
    box('cargo',(P['width'],P['medical_roof_y']-P['body_floor_y'],medical_length),
        (0,(P['medical_roof_y']+P['body_floor_y'])/2,medical_center),'fabric')
    cab_profile=[(P['cab_rear_z'],P['floor_y']),(P['front_z'],P['floor_y']),
        (P['front_z'],P['nose_y']),(P['windscreen_bottom_z'],P['bonnet_y']),
        (P['cab_roof_front_z'],P['cab_roof_y']),(P['cab_rear_z'],P['cab_roof_y'])]
    cab=side_prism('cab',cab_profile,P['width'],0,'metal')
    fitted_glazing('windshield',P['windscreen_outline'],cab,2,1,P['pane_t'],P['pane_inset'])
    for sign in (-1,1):
        fitted_glazing('side_window',P['side_window_outline'],cab,0,sign,P['pane_t'],P['pane_inset'])
        cross_x=sign*(P['width']/2+P['cross_depth']/2)
        box('cross_vertical',(P['cross_depth'],P['cross_length'],P['cross_width']),
            (cross_x,P['cross_y'],P['cross_z']),'trim_dark')
        box('cross_horizontal',(P['cross_depth'],P['cross_width'],P['cross_length']),
            (cross_x,P['cross_y'],P['cross_z']),'trim_dark')
        box('headlight',P['headlight_size'],(sign*P['headlight_x'],P['headlight_y'],P['front_z']),'accent')
        box('rear_lamp',P['rear_lamp_size'],(sign*P['rear_lamp_x'],P['rear_lamp_y'],P['rear_z']),'trim_dark')
    box('bumper',P['bumper_size'],(0,P['bumper_y'],P['front_z']),'metal_dark')
    box('rear_bumper',P['bumper_size'],(0,P['bumper_y'],P['rear_z']),'metal_dark')
    box('grille',P['grille_size'],(0,P['grille_y'],P['front_z']),'metal_dark')
    box('lightbar',P['lightbar_size'],(0,P['lightbar_y'],P['lightbar_z']),'accent')
    foot_y=P['cab_roof_y']+P['lightbar_foot_size'][1]/2
    rail_h=P['body_floor_y']-P['floor_y']
    for sign in (-1,1):
        box('lightbar_foot',P['lightbar_foot_size'],(sign*P['lightbar_foot_x'],foot_y,P['lightbar_z']),'metal_dark')
        box('cargo_chassis_rail',(P['rail_width'],rail_h,medical_length),
            (sign*P['width']/3,(P['body_floor_y']+P['floor_y'])/2,medical_center),'metal_dark')
    finish_wheeled_vehicle(bpy.context.scene.objects,P['arch_gap'],P['axle_r'],P['axle_gap'])
    export(NAME)


if __name__ == '__main__':
    build()
    from movable_prop_geometry import annotate_model_motion
    annotate_model_motion(NAME)
