"""Standalone ATM; metres, +Y up, +Z front. No textures."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *
from atm_geometry import keypad, aperture
from model_contacts import apply

# Dimensions and positions in metres; retain the current interaction surface.
P = {
    'width': .95, 'depth': .70, 'pedestal_height': .90,
    'cabinet_height': 1.05,
    'screen_size': (.58,.42,.025), 'screen_center': (0,1.56,.3625),
    'keyboard_size': (.60,.068,.23), 'keyboard_center': (0,1.194,.40),
    'key_side': .044, 'key_height': .012, 'key_pitch': .055,
    'key_top': 1.24, 'key_grid_z': .4075, 'function_x': .12,
    'keyboard_bay_size': (.46,.105,.12),
    'keyboard_bay_center': (0,1.2745,.315),
    'cash_slot': {
        'center': (0,.98), 'mouth_z': .383,
        'outer_width': .38, 'outer_height': .10, 'surround_depth': .043,
        'opening_width': .32, 'opening_height': .042, 'recess_depth': .073,
        'backing_depth': .02, 'backing_overlap': .005, 'cut_overshoot': .008,
    },
    'card_slot': {
        'center': (.375,1.50), 'mouth_z': .385,
        'outer_width': .13, 'outer_height': .09, 'surround_depth': .043,
        'opening_width': .095, 'opening_height': .018, 'recess_depth': .070,
        'backing_depth': .02, 'backing_overlap': .005, 'cut_overshoot': .008,
    },
}


def build():
    reset()
    box('pedestal',(P['width'],P['pedestal_height'],P['depth']),
        (0,P['pedestal_height']/2,0),'metal_dark')
    cabinet = box('cabinet',(P['width'],P['cabinet_height'],P['depth']),
                  (0,P['pedestal_height']+P['cabinet_height']/2,0),'metal')
    # The rear row sits in a shallow working recess, never inside the cabinet.
    blind_cut(cabinet,'keyboard_bay',P['keyboard_bay_size'],P['keyboard_bay_center'])
    box('screen',P['screen_size'],P['screen_center'],'glass_dark')
    box('keyboard',P['keyboard_size'],P['keyboard_center'],'trim_dark')
    keypad(P)
    aperture(cabinet,'cash_slot',P['cash_slot'])
    aperture(cabinet,'card_slot',P['card_slot'])
    export('atm_standalone')
    apply(Path(__file__).resolve().parents[1]/'models/atm_standalone.glb')


if __name__ == '__main__':
    build()
