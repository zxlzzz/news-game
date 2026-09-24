"""现代办公楼. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'wall_slot': 'wall_stone',
 'window_shape': 'rect',
 'shop_shape': 'rect',
 'vertical_bars': 2,
 'transom_ratio': 0,
 'pair_gap': 0.18,
 'arch_rise_ratio': 0.3,
 'arch_segments': 16,
 'corner_clip_ratio': 0.18,
 'width': 18,
 'depth': 10,
 'ground_h': 3.8,
 'floor_h': 3.2,
 'floors': 5,
 'recess': 0.48,
 'cut_overlap': 0.02,
 'window_base': 1.0,
 'window_w': 3.1,
 'window_h': 1.25,
 'window_x': (-6.6, -2.2, 2.2, 6.6),
 'pane_thickness': 0.04,
 'side_window_z': (-2, -5.5),
 'shop_windows': ((-6.5, 2.7), (-2.5, 2.7), (2.5, 2.7)),
 'shop_base': 0.4,
 'shop_h': 2.15,
 'door_x': 6.4,
 'door_w': 1.1,
 'door_h': 2.3,
 'sill_extra': 0.16,
 'sill_h': 0.1,
 'sill_depth': 0.26,
 'mullion_w': 0.08,
 'frame_depth': 0.08,
 'mullions': True,
 'traditional': False,
 'corner': False,
 'parapet_t': 0.22,
 'parapet_h': 0.35,
 'coping_h': 0.12,
 'coping_extra': 0.06,
 'roof_room': (5, 1.3, 3.6),
 'roof_room_xz': (-3, -6.5),
 'roof_kind': 'slope',
 'roof_rise': 0.65,
 'tank_radius': 0.7,
 'tank_h': 1.2,
 'roof_vents': ((4, -4), (4, -7)),
 'vent_size': (0.7, 0.6, 0.7),
 'sign_w': 2,
 'sign_h': 0.48,
 'sign_t': 0.12,
 'sign_x': 6.4,
 'sign_y': 3.12,
 'canopy_w': 0,
 'canopy_depth': 0.85,
 'canopy_y': 2.65,
 'canopy_rise': 0.16,
 'canopy_t': 0.04,
 'fabric_canopy': False,
 'band_h': 0.14,
 'band_depth': 0.2,
 'balconies': (),
 'balcony_w': 1.9,
 'balcony_depth': 0.75,
 'balcony_slab_h': 0.12,
 'rail_h': 1,
 'rail_t': 0.08}

def build():
    reset()
    from building_geometry import build_building
    build_building(P)
    export('building_modern')

if __name__ == '__main__':
    build()
