"""公交车. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 2.45,
 'length': 11.9,
 'height': 3,
 'body_bottom': 0.36,
 'roof_round': 0.18,
 'body_y': 1.5,
 'wheel_r': 0.5,
 'wheel_t': 0.23,
 'hub_r': 0.27,
 'axles_z': (-3.7, 3.0),
 'pane_t': 0.035,
 'window_y': 2.08,
 'window_h': 0.95,
 'side_windows_z': (-4.7, -3.1, -1.5, 0.1, 1.7, 3.3),
 'window_l': 1.3,
 'front_window': (2.05, 1.02, 0.04),
 'front_window_y': 2.11,
 'door_z': (4.65, -1.25),
 'door_l': 1.1,
 'door_h': 2.25,
 'door_bottom': 0.4,
 'door_bar': 0.07,
 'bumper_h': 0.14,
 'bumper_y': 0.62,
 'bumper_t': 0.08,
 'lamp_size': (0.35, 0.18, 0.06),
 'lamp_y': 0.98,
 'roof_vent': (1.2, 0.12, 1.8)}

def build():
    reset()
    from vehicle_geometry import loft
    w,h,r=P['width'],P['height'],P['roof_round']
    profile=[(-w/2,P['body_bottom']),(w/2,P['body_bottom']),(w/2,h-r),(w/2-r*.134,h-r*.5),(w/2-r*.5,h-r*.134),
        (w/2-r,h),(-w/2+r,h),(-w/2+r*.5,h-r*.134),(-w/2+r*.134,h-r*.5),(-w/2,h-r)]
    loft('coach_body',[(-P['length']/2,profile),(P['length']/2,profile)],'metal')
    for x in (-w/2,w/2):
        for z in P['axles_z']:
            cylinder('tire',P['wheel_r'],P['wheel_t'],(x,P['wheel_r'],z),'metal_dark',axis=(1,0,0))
            cylinder('hub',P['hub_r'],P['wheel_t']*1.03,(x,P['wheel_r'],z),'metal',axis=(1,0,0))
        for z in P['side_windows_z']:
            if x<0 and any(abs(z-dz)<(P['window_l']+P['door_l'])/2 for dz in P['door_z']):
                continue
            box('side_window',(P['pane_t'],P['window_h'],P['window_l']),(x,P['window_y'],z),'window')
    for z in (-P['length']/2,P['length']/2):
        box('windshield',P['front_window'],(0,P['front_window_y'],z),'window')
        box('bumper',(w*.93,P['bumper_h'],P['bumper_t']),(0,P['bumper_y'],z),'metal_dark')
        for x in (-w*.33,w*.33):
            box('lamp',P['lamp_size'],(x,P['lamp_y'],z),'accent' if z>0 else 'trim_dark')
    for z in P['door_z']:
        box('right_side_door',(P['pane_t'],P['door_h'],P['door_l']),(-w/2-P['pane_t']/2,P['door_bottom']+P['door_h']/2,z),'door')
        box('door_window',(P['pane_t'],P['window_h'],P['door_l']*.75),(-w/2-P['pane_t'],P['window_y'],z),'window')
        box('door_split',(P['pane_t'],P['door_h'],P['door_bar']),(-w/2-P['pane_t']*1.5,P['door_bottom']+P['door_h']/2,z),'metal_dark')
    box('roof_equipment',P['roof_vent'],(0,P['height']+P['roof_vent'][1]/2,-.8),'metal')
    export('bus')

if __name__ == '__main__':
    build()
