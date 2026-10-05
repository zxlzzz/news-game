"""Deterministic pawn. Origin is the shaft pinch point; metres, +Y up."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import reset, cylinder, ellipsoid, export

P = {'base_radius': .025, 'base_height': .012, 'base_center_y': -.034,
     'shaft_radius': .011, 'shaft_height': .052, 'shaft_center_y': -.002,
     'collar_radius': .018, 'collar_height': .008, 'collar_center_y': .023,
     'head_diameter': .034, 'head_center_y': .040}

def build():
    reset()
    cylinder('base',P['base_radius'],P['base_height'],(0,P['base_center_y'],0),'wood')
    cylinder('shaft',P['shaft_radius'],P['shaft_height'],(0,P['shaft_center_y'],0),'wood')
    cylinder('collar',P['collar_radius'],P['collar_height'],(0,P['collar_center_y'],0),'wood')
    ellipsoid('head',(P['head_diameter'],)*3,(0,P['head_center_y'],0),'wood')
    export('held_chess_piece')

if __name__=='__main__':
    build()
