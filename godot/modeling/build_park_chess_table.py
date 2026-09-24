"""棋桌与双凳. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'table_w': 0.85,
 'table_d': 0.85,
 'table_h': 0.75,
 'top_t': 0.07,
 'post_w': 0.3,
 'foot_w': 0.52,
 'foot_h': 0.08,
 'seat_w': 0.45,
 'seat_d': 0.43,
 'seat_h': 0.45,
 'seat_t': 0.07,
 'seat_z': 0.84,
 'leg_w': 0.18,
 'board_w': 0.62,
 'paint_t': 0.002}

def build():
    reset()
    box('foot',(P['foot_w'],P['foot_h'],P['foot_w']),(0,P['foot_h']/2,0),'concrete')
    box('pedestal',(P['post_w'],P['table_h']-P['top_t'],P['post_w']),(0,(P['table_h']-P['top_t'])/2,0),'concrete')
    box('tabletop',(P['table_w'],P['top_t'],P['table_d']),(0,P['table_h']-P['top_t']/2,0),'concrete')
    for sign in (-1,1):
        z=sign*P['seat_z']
        box('stool_support',(P['leg_w'],P['seat_h']-P['seat_t'],P['leg_w']),(0,(P['seat_h']-P['seat_t'])/2,z),'concrete')
        box('stool_seat',(P['seat_w'],P['seat_t'],P['seat_d']),(0,P['seat_h']-P['seat_t']/2,z),'wood')
    # Sparse, flush checker squares: paint never generates outline geometry.
    cell=P['board_w']/8
    for row in range(8):
        for col in range(8):
            if (row+col)%2 == 0:
                box('board_square',(cell,P['paint_t'],cell),((col-3.5)*cell,P['table_h']+P['paint_t']/2,(row-3.5)*cell),'paint')
    export('park_chess_table')

if __name__ == '__main__':
    build()
