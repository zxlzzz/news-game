"""Opponent pawn, with identical geometry and physical grasp to the light pawn."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_held_chess_piece import build
from model_contacts import apply
if __name__=='__main__':
    build('held_chess_piece_dark','trim_dark')
    apply(Path(__file__).resolve().parents[1]/'models/held_chess_piece_dark.glb')
