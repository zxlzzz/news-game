"""公交候车棚与长凳. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 5,
 'depth': 2.1,
 'height': 2.7,
 'post': 0.1,
 'roof_t': 0.12,
 'seat_w': 2.8,
 'seat_d': 0.44,
 'seat_h': 0.37,
 'seat_t': 0.08,
 'bench_z': -0.5,
 'leg': 0.09,
 'back_h': 0.38,
 'back_t': 0.07,
 'back_y': 0.68,
 'back_bracket_y': 0.22,
 'back_bracket_h': 0.06,
 'panel_h': 1.5,
 'panel_y': 1.15,
 'panel_t': 0.04}

def build():
    reset()
    for x in (-P['width']/2,P['width']/2):
        for z in (-P['depth']/2,P['depth']/2):
            box('post',(P['post'],P['height']-P['roof_t'],P['post']),(x,(P['height']-P['roof_t'])/2,z),'metal')
    box('roof',(P['width']+P['post'],P['roof_t'],P['depth']+P['post']),(0,P['height']-P['roof_t']/2,0),'metal_dark')
    box('back_windbreak',(P['width']-P['post'],P['panel_h'],P['panel_t']),(0,P['panel_y'],-P['depth']/2),'window')
    box('seat',(P['seat_w'],P['seat_t'],P['seat_d']),(0,P['seat_h']-P['seat_t']/2,P['bench_z']),'wood')
    # Seat and backrest match the park bench around the seat (depth, height, backrest face): the seated clips are
    # built once for every seat of post kind sit (npc/pose_build.gd checks that the markers agree).
    box('backrest',(P['seat_w'],P['back_h'],P['back_t']),(0,P['back_y'],P['bench_z']-P['seat_d']/2),'wood')
    for x in (-P['seat_w']*.35,P['seat_w']*.35):
        box('bench_leg',(P['leg'],P['seat_h']-P['seat_t'],P['seat_d']),(x,(P['seat_h']-P['seat_t'])/2,P['bench_z']),'metal_dark')
    # Back supports stay behind both wooden panels and connect to the legs.
    rear=P['bench_z']-P['seat_d']/2-P['back_t']/2
    for x in (-P['seat_w']*.35,P['seat_w']*.35):
        box('back_mount',(P['leg'],P['back_y']+P['back_h']/2,P['leg']),
            (x,(P['back_y']+P['back_h']/2)/2,rear-P['leg']/2),'metal_dark')
        gap=P['back_t']/2
        box('back_seat_bracket',(P['leg'],P['back_bracket_h'],gap),
            (x,P['back_bracket_y'],rear+gap/2),'metal_dark')
    export('bus_shelter')

if __name__ == '__main__':
    build()

# Physical contact nodes share the model build data.
if __name__ == "__main__":
    import sys as _contact_sys
    from pathlib import Path as _ContactPath
    _contact_sys.path.insert(0, str(_ContactPath(__file__).resolve().parent))
    from model_contacts import apply as _apply_contacts
    _apply_contacts(_ContactPath(__file__).resolve().parents[1] / "models" / "bus_shelter.glb")
