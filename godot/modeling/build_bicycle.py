"""自行车. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'wheelbase': 1.12,
 'wheel_r': 0.34,
 'tire_wall': 0.045,
 'tire_t': 0.055,
 'hub_r': 0.07,
 'spoke_r': 0.012,
 'frame_r': 0.025,
 'frame_segments': [((0, 0.34, -0.56), (0, 0.4, 0)),
                    ((0, 0.4, 0), (0, 0.84, -0.22)),
                    ((0, 0.84, -0.22), (0, 0.34, -0.56)),
                    ((0, 0.84, -0.22), (0, 0.87, 0.38)),
                    ((0, 0.87, 0.38), (0, 0.4, 0)),
                    ((0, 0.87, 0.38), (0, 0.34, 0.56)),
                    ((0, 0.87, 0.38), (0, 1.04, 0.34)),
                    ((0, 0.4, 0), (0, 0.92, -0.24))],
 'seat_size': (0.22, 0.075, 0.3),
 'seat_center': (0, 0.94, -0.24),
 'handle_w': 0.57,
 'handle_y': 1.04,
 'handle_z': 0.34,
 'handle_r': 0.025,
 'crank_w': 0.36,
 'crank_y': 0.4,
 'pedal_size': (0.11, 0.05, 0.17),
 'motor': False}

def build():
    reset()
    from vehicle_geometry import build_two_wheeler
    build_two_wheeler(P)
    export('bicycle')

if __name__ == '__main__':
    build()
