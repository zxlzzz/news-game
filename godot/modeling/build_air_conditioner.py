"""Outdoor compressor; metres, +Y up, +Z front.

A recessed fan sits behind a light circular guard. Geometry remains simple
because runtime outlines every exposed edge; this is a legible guard, not a
full-size simulation of each wire in a manufactured mesh.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# Model-owned dimensions (metres) and layout.
P = {
    'width': 1.0, 'height': .65, 'depth': .45,
    'runner_width': .07, 'runner_height': .06, 'runner_depth': .40,
    'runner_x': .35, 'fan_x': -.18,
    'opening_radius': .211, 'opening_depth': .09,
    'opening_z': .220, 'backing_radius': .210,
    'backing_depth': .02, 'backing_z': .176,
    'blade_depth': .015, 'blade_z': .200, 'blade_count': 3,
    'blade_profile': ((.018,.027),(.082,.021),(.184,.065),
                      (.157,.135),(.075,.119),(.026,.052)),
    'hub_radius': .038, 'hub_depth': .040, 'hub_z': .195,
    'rim_outer': .225, 'rim_inner': .210, 'rim_depth': .024,
    'rim_z': .226, 'guard_z': .237,
    'guard_ring_radii': (.06,.111,.162), 'guard_wire_width': .006,
    'guard_depth': .008, 'guard_support_radius': .0035,
    'guard_support_count': 3, 'guard_inner_radius': .015,
    'guard_center_radius': .018, 'guard_center_depth': .008,
    'vent_x': .30, 'vent_width': .20, 'vent_height': .025,
    'vent_depth': .04, 'vent_z': .235,
    'vent_spacing': .057, 'vent_count': 5,
    'vent_backing_width': .192, 'vent_backing_height': .023,
    'vent_backing_depth': .015, 'vent_backing_z': .216,
}


def build():
    reset()
    body_height = P['height'] - P['runner_height']
    body_y = P['runner_height'] + body_height / 2
    housing = box('housing', (P['width'], body_height, P['depth']),
                  (0, body_y, 0), 'metal')
    cutter = cylinder('fan_opening_cutter', P['opening_radius'],
                      P['opening_depth'],
                      (P['fan_x'],body_y,P['opening_z']), None, axis=(0,0,1))
    subtract(housing, cutter, 'recessed_fan_opening')
    cylinder('fan_backing',P['backing_radius'],P['backing_depth'],
             (P['fan_x'],body_y,P['backing_z']),'glass_dark',axis=(0,0,1))
    for blade in range(P['blade_count']):
        angle = 2*pi*blade/P['blade_count']
        outline = [(x*cos(angle)-y*sin(angle),x*sin(angle)+y*cos(angle))
                   for x,y in P['blade_profile']]
        prism(f'fan_blade_{blade+1}',outline,P['blade_depth'],
              (P['fan_x'],body_y,P['blade_z']),'metal_dark')
    cylinder('fan_hub',P['hub_radius'],P['hub_depth'],
             (P['fan_x'],body_y,P['hub_z']),'metal',axis=(0,0,1))
    ring('fan_mounting_rim',P['rim_outer'],P['rim_inner'],P['rim_depth'],
         (P['fan_x'],body_y,P['rim_z']),'metal',axis=(0,0,1))
    for index,radius in enumerate(P['guard_ring_radii']):
        ring(f'guard_ring_{index+1}',radius+P['guard_wire_width']/2,
             radius-P['guard_wire_width']/2,P['guard_depth'],
             (P['fan_x'],body_y,P['guard_z']),'metal',axis=(0,0,1))
    for index in range(P['guard_support_count']):
        angle = 2*pi*index/P['guard_support_count']
        start = (P['fan_x']+sin(angle)*P['guard_inner_radius'],
                 body_y+cos(angle)*P['guard_inner_radius'],P['guard_z'])
        end = (P['fan_x']+sin(angle)*(P['rim_outer']-P['guard_wire_width']/2),
               body_y+cos(angle)*(P['rim_outer']-P['guard_wire_width']/2),
               P['guard_z'])
        bar(f'guard_support_{index+1}',start,end,P['guard_support_radius'],'metal')
    cylinder('guard_center',P['guard_center_radius'],P['guard_center_depth'],
             (P['fan_x'],body_y,P['guard_z']),'metal',axis=(0,0,1))
    for index in range(P['vent_count']):
        y = body_y+(index-(P['vent_count']-1)/2)*P['vent_spacing']
        blind_cut(housing,f'vent_opening_{index+1}',
                  (P['vent_width'],P['vent_height'],P['vent_depth']),
                  (P['vent_x'],y,P['vent_z']))
        box(f'vent_backing_{index+1}',
            (P['vent_backing_width'],P['vent_backing_height'],P['vent_backing_depth']),
            (P['vent_x'],y,P['vent_backing_z']),'metal_dark')
    for side,x in enumerate((-P['runner_x'],P['runner_x'])):
        box(f'base_runner_{side+1}',
            (P['runner_width'],P['runner_height'],P['runner_depth']),
            (x,P['runner_height']/2,0),'metal_dark')
    export('air_conditioner')


if __name__ == '__main__':
    build()
