"""小汽车. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 1.76,
 'length': 4.5,
 'height': 1.46,
 'body_bottom': 0.3,
 'belt_y': 0.91,
 'roof_round': 0.17,
 'body_stations': [(-2.25, 1.55, 0.75), (-1.65, 1.76, 0.96), (1.55, 1.76, 0.9), (2.25, 1.55, 0.68)],
 'cabin_stations': [(-1.42, 1.42, 1.07), (-0.77, 1.5, 1.46), (0.68, 1.5, 1.46), (1.35, 1.42, 1.03)],
 'axles_z': (-1.4, 1.4),
 'wheel_r': 0.33,
 'wheel_t': 0.19,
 'hub_r': 0.17,
 'hub_out': 0.01,
 'pane_t': 0.025,
 'side_windows': [[(-1.18, 1.0), (-0.72, 1.29), (-0.12, 1.29), (-0.12, 1.0)],
                  [(0, 1.0), (0, 1.29), (0.62, 1.29), (1.12, 1.0)]],
 'glass_inset_fractions': (0.15, 0.85),
 'glass_width': 1.1,
 'glass_lift': 0.004,
 'bumper_h': 0.12,
 'bumper_t': 0.05,
 'bumper_y': 0.5,
 'lamp_size': (0.3, 0.14, 0.055),
 'lamp_y': 0.66,
 'taxi': False,
 'taxi_sign': (0.5, 0.18, 0.24),
 'taxi_sign_z': -0.1}

def build():
    reset()
    from vehicle_geometry import build_car
    build_car(P)
    export('car')

if __name__ == '__main__':
    build()
