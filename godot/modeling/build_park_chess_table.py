"""棋桌与双凳. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *
from build_held_chess_piece import P as PAWN
import bpy

# All design dimensions/placements are collected here (metres unless named otherwise).
# Pedestal and foot plate are slim (2026-10-13): seated stick figures' feet otherwise stand inside the plate.
# 2026-10-14: stools at the park bench's seat height (0.37: the figure's short legs reach the ground with the thighs
# level over the stool's front edge), the table 0.08 m lower with them (0.3 m under the seated figure's neck, where its
# arms start: reaching the board its elbows stay above the table edge) and a 0.24 m foot plate (the seated figure's
# toes end 0.05 m before it).
P = {'table_w': 0.85,
 'table_d': 0.85,
 'table_h': 0.67,
 'top_t': 0.07,
 'post_w': 0.16,
 'foot_w': 0.24,
 'foot_h': 0.03,
 'seat_w': 0.45,
 'seat_d': 0.43,
 'seat_h': 0.37,
 'seat_t': 0.07,
 'seat_z': 0.72,
 'leg_w': 0.18,
 'board_w': 0.62,
 'paint_t': 0.002}

# Two-sided activity setup. Moving clips replace their own source mesh with
# an identical rigid held pawn; destination squares remain free except capture.
PIECES = [('piece_chess_move',1.5,-3.5,'wood'),
 ('piece_chess_move_diagonal',2.5,-2.5,'wood'),
 ('piece_chess_move_side',3.5,-1.5,'wood'),
 ('piece_chess_move_far',.5,-1.5,'wood'),
 ('piece_chess_capture',-.5,-2.5,'wood'),
 ('piece_opponent',.5,-.5,'trim_dark'),
 ('piece_chess_move_b',-1.5,3.5,'trim_dark'),
 ('piece_chess_move_diagonal_b',-2.5,2.5,'trim_dark'),
 ('piece_chess_move_side_b',-3.5,1.5,'trim_dark'),
 ('piece_chess_move_far_b',-.5,1.5,'trim_dark'),
 ('piece_chess_capture_b',.5,2.5,'trim_dark'),
 ('piece_opponent_b',-.5,.5,'wood')]

def pawn(name,x,z,slot):
    before=set(bpy.context.scene.objects)
    y=P['table_h']+P['paint_t']-PAWN['base_center_y']+PAWN['base_height']/2
    for part in ['base','shaft','collar']:
        cylinder(name+'_'+part,PAWN[part+'_radius'],PAWN[part+'_height'],(x,y+PAWN[part+'_center_y'],z),slot)
    ellipsoid(name+'_head',(PAWN['head_diameter'],)*3,(x,y+PAWN['head_center_y'],z),slot)
    pieces=[o for o in bpy.context.scene.objects if o not in before]
    # Keep the same four convex solids as the held pawn. The group can be
    # hidden as one source piece without turning its union into one concave mesh.
    group=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(group)
    for piece in pieces:piece.parent=group

def build():
    reset()
    box('foot',(P['foot_w'],P['foot_h'],P['foot_w']),(0,P['foot_h']/2,0),'concrete')
    box('pedestal',(P['post_w'],P['table_h']-P['top_t'],P['post_w']),(0,(P['table_h']-P['top_t'])/2,0),'concrete')
    box('tabletop',(P['table_w'],P['top_t'],P['table_d']),(0,P['table_h']-P['top_t']/2,0),'concrete')
    for sign in (-1,1):
        z=sign*P['seat_z']
        box('stool_support_a' if sign==-1 else 'stool_support_b',(P['leg_w'],P['seat_h']-P['seat_t'],P['leg_w']),(0,(P['seat_h']-P['seat_t'])/2,z),'concrete')
        box('stool_seat_a' if sign==-1 else 'stool_seat_b',(P['seat_w'],P['seat_t'],P['seat_d']),(0,P['seat_h']-P['seat_t']/2,z),'wood')
    # Sparse, flush checker squares: paint never generates outline geometry.
    cell=P['board_w']/8
    for row in range(8):
        for col in range(8):
            if (row+col)%2 == 0:
                box('board_square',(cell,P['paint_t'],cell),((col-3.5)*cell,P['table_h']+P['paint_t']/2,(row-3.5)*cell),'paint')
    for name,col,row,slot in PIECES:pawn(name,col*cell,row*cell,slot)
    export('park_chess_table')

if __name__ == '__main__':
    build()


# Physical contact nodes share the model build data.
if __name__ == "__main__":
    import sys as _contact_sys
    from pathlib import Path as _ContactPath
    _contact_sys.path.insert(0, str(_ContactPath(__file__).resolve().parent))
    from model_contacts import apply as _apply_contacts
    _apply_contacts(_ContactPath(__file__).resolve().parents[1] / "models" / "park_chess_table.glb")
