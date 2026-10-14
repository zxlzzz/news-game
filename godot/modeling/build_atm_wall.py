"""Wall ATM; metres, +Y up, +Z front. No textures."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *
from atm_geometry import keypad, aperture

# Dimensions and positions in metres.
P = {
    'body_size': (.85,1.40,.35), 'body_center': (0,.70,0),
    'screen_size': (.53,.38,.025), 'screen_center': (0,.99,.19),
    'keyboard_size': (.55,.048,.23), 'keyboard_center': (0,.634,.26),
    'key_side': .044, 'key_height': .012, 'key_pitch': .055,
    'key_top': .67, 'key_grid_z': .2675, 'function_x': .12,
    'keyboard_bay_size': (.46,.123,.09),
    'keyboard_bay_center': (0,.7135,.155),
    'cash_slot': {
        'center': (0,.43), 'mouth_z': .210,
        'outer_width': .37, 'outer_height': .09, 'surround_depth': .043,
        'opening_width': .31, 'opening_height': .037, 'recess_depth': .065,
        'backing_depth': .02, 'backing_overlap': .005, 'cut_overshoot': .008,
    },
    'card_slot': {
        'center': (.34,.99), 'mouth_z': .212,
        'outer_width': .13, 'outer_height': .09, 'surround_depth': .045,
        'opening_width': .095, 'opening_height': .018, 'recess_depth': .070,
        'backing_depth': .02, 'backing_overlap': .005, 'cut_overshoot': .008,
    },
}


def build():
    reset()
    body = box('body',P['body_size'],P['body_center'],'metal')
    blind_cut(body,'keyboard_bay',P['keyboard_bay_size'],P['keyboard_bay_center'])
    box('screen',P['screen_size'],P['screen_center'],'glass_dark')
    box('keyboard',P['keyboard_size'],P['keyboard_center'],'metal_dark')
    keypad(P)
    aperture(body,'cash_slot',P['cash_slot'])
    aperture(body,'card_slot',P['card_slot'])
    export('atm_wall')


if __name__ == '__main__':
    build()
