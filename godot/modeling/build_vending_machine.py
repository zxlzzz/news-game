"""自动售货机. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 1.05,
 'depth': 0.8,
 'height': 1.9,
 'screen': (0.6, 1.1, 0.035),
 'screen_x': -0.13,
 'screen_y': 1.13,
 'controls': (0.12, 0.48, 0.03),
 'tray': (0.65, 0.16, 0.06),
 'tray_y': 0.35, 'mouth_size':(.65,.18,.20),'mouth_z':.37,'mouth_back_z':.272,'mouth_back_t':.005,
 'tray_floor':(.65,.018,.20),'tray_floor_y':.265,'tray_floor_z':.37,
 'tray_lip':(.65,.03,.018),'tray_lip_y':.278,'tray_lip_z':.453,
 'shelf_h': .035, 'product_r': .045, 'product_h': .17, 'product_t': .018, 'button_r': .035, 'button_t': .022, 'shelf_rows': [.80,1.08,1.36], 'product_x': [-.33,-.13,.07]}

def build():
    reset()
    body=box('cabinet',(P['width'],P['height'],P['depth']),(0,P['height']/2,0),'metal')
    box('display',P['screen'],(P['screen_x'],P['screen_y'],P['depth']/2),'window')
    box('controls',P['controls'],(P['width']*.36,P['screen_y'],P['depth']/2),'trim_dark')
    blind_cut(body,'pickup_mouth',P['mouth_size'],(0,P['tray_y'],P['mouth_z']))
    box('pickup_mouth_back',(P['mouth_size'][0],P['mouth_size'][1],P['mouth_back_t']),
        (0,P['tray_y'],P['mouth_back_z']),'metal_dark')
    box('pickup_floor',P['tray_floor'],(0,P['tray_floor_y'],P['tray_floor_z']),'metal')
    box('pickup_lip',P['tray_lip'],(0,P['tray_lip_y'],P['tray_lip_z']),'metal_dark')
    # Shallow product relief remains readable with the project's opaque window slot.
    face=P['depth']/2+P['screen'][2]/2
    for y in P['shelf_rows']:
        box('display_shelf',(P['screen'][0]*.94,P['shelf_h'],P['product_t']),
            (P['screen_x'],y-P['product_h']/2-P['shelf_h']/2,face+P['product_t']/2),'metal')
        for x in P['product_x']:
            box('drink_pack',(P['product_r']*2,P['product_h'],P['product_t']),
                (x,y,face+P['product_t']/2),'trim')
    cylinder('select_button',P['button_r'],P['button_t'],(P['width']*.36,P['screen_y'],P['depth']/2+P['button_t']/2),'metal',axis=(0,0,1))
    export('vending_machine')

if __name__ == '__main__':
    build()


# Physical contact nodes share the model build data.
if __name__ == "__main__":
    import sys as _contact_sys
    from pathlib import Path as _ContactPath
    _contact_sys.path.insert(0, str(_ContactPath(__file__).resolve().parent))
    from model_contacts import apply as _apply_contacts
    _apply_contacts(_ContactPath(__file__).resolve().parents[1] / "models" / "vending_machine.glb")
