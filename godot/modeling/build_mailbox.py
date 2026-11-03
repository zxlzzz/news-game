"""邮筒. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 0.52,
 'depth': 0.42,
 'height': 1.25,
 'base_h': 0.4,
 'post_w': 0.16,
 'slot_w': 0.34,
 'slot_h': 0.08,
 'slot_y': 1.05,
 'plate_t': 0.025,'slot_depth':.13,'slot_z':.185,'back_t':.005,'back_z':.121,
 'lip_size':(.37,.018,.035),'lip_y':1.001,'lip_z':.219}

def build():
    reset()
    box('post',(P['post_w'],P['base_h'],P['post_w']),(0,P['base_h']/2,0),'metal_dark')
    body=box('box',(P['width'],P['height']-P['base_h'],P['depth']),(0,(P['height']+P['base_h'])/2,0),'metal')
    blind_cut(body,'letter_mouth',(P['slot_w'],P['slot_h'],P['slot_depth']),(0,P['slot_y'],P['slot_z']))
    box('letter_mouth_back',(P['slot_w'],P['slot_h'],P['back_t']),(0,P['slot_y'],P['back_z']),'metal_dark')
    box('slot_lip',P['lip_size'],(0,P['lip_y'],P['lip_z']),'metal')
    export('mailbox')

if __name__ == '__main__':
    build()


# Physical contact nodes share the model build data.
if __name__ == "__main__":
    import sys as _contact_sys
    from pathlib import Path as _ContactPath
    _contact_sys.path.insert(0, str(_ContactPath(__file__).resolve().parent))
    from model_contacts import apply as _apply_contacts
    _apply_contacts(_ContactPath(__file__).resolve().parents[1] / "models" / "mailbox.glb")
