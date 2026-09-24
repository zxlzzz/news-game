"""电动车. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
# Step-through: the battery body stays under the seat; the two footrests form the low floor in front of it.
P = {'wheelbase': 1.35,
 'wheel_r': 0.25,
 'tire_wall': 0.075,
 'tire_t': 0.12,
 'hub_r': 0.07,
 'spoke_r': 0.025,
 'frame_r': 0.04,
 'frame_segments': [((0, 0.25, -0.675), (0, 0.45, -0.2)),
                    ((0, 0.45, -0.2), (0, 0.42, 0.32)),
                    ((0, 0.42, 0.32), (0, 1.02, 0.45)),
                    ((0, 1.02, 0.45), (0, 0.25, 0.675))],
 'seat_size': (0.4, 0.13, 0.67),
 'seat_center': (0, 0.79, -0.27),
 'handle_w': 0.58,
 'handle_y': 1.16,
 'handle_z': 0.52,
 'handle_r': 0.035,
 'motor': True,
 'footrest_x': 0.1,
 'footrest_y': 0.30,
 'footrest_z': 0.14,
 'footrest_size': (0.2, 0.05, 0.32),
 'body_size': (0.4, 0.42, 0.58),
 'body_center': (0, 0.46, -0.31),
 'fairing_size': (0.4, 0.55, 0.14),
 'fairing_center': (0, 0.75, 0.43),
 'headlamp_r': 0.09,
 'headlamp_t': 0.04,
 'headlamp_center': (0, 1.03, 0.53)}

def build():
    reset()
    from vehicle_geometry import build_two_wheeler
    build_two_wheeler(P)
    export('scooter')

if __name__ == '__main__':
    build()
