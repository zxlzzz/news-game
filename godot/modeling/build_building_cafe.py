"""咖啡馆. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'wall_slot': 'wall_stone',
 'window_shape': 'arch',
 'shop_shape': 'arch',
 'vertical_bars': 0,
 'transom_ratio': 0,
 'pair_gap': 0.18,
 'arch_rise_ratio': 0.3,
 'arch_segments': 16,
 'corner_clip_ratio': 0.18,
 'width': 6,
 'depth': 6.8,
 'ground_h': 3.8,
 'floor_h': 3.2,
 'floors': 2,
 'recess': 0.48,
 'cut_overlap': 0.02,
 'window_base': 0.65,
 'window_w': 1.1,
 'window_h': 2,
 'window_x': (-1.4, 1.4),
 'pane_thickness': 0.04,
 'side_window_z': (-2, -5.5),
 'shop_windows': ((-1.1, 2.5),),
 'shop_base': 0.4,
 'shop_h': 2.15,
 'door_x': 1.8,
 'door_w': 1.1,
 'door_h': 2.3,
 'sill_extra': 0.16,
 'sill_h': 0.1,
 'sill_depth': 0.26,
 'mullion_w': 0.08,
 'frame_depth': 0.08,
 'mullions': True,
 'traditional': True,
 'corner': False,
 'parapet_t': 0.22,
 'parapet_h': 0.5,
 'coping_h': 0.12,
 'coping_extra': 0.06,
 'roof_room': (2.6, 1.3, 2.4),
 'roof_room_xz': (0, -4.7),
 'roof_kind': 'gable',
 'roof_rise': 0.65,
 'tank_radius': 0.7,
 'tank_h': 1.2,
 'roof_vents': (),
 'vent_size': (0.7, 0.6, 0.7),
 'sign_w': 3,
 'sign_h': 0.48,
 'sign_t': 0.12,
 'sign_x': -0.8,
 'sign_y': 3.12,
 'canopy_w': 4.8,
 'canopy_depth': 0.95,
 'canopy_y': 2.65,
 'canopy_rise': 0.16,
 'canopy_t': 0.04,
 'fabric_canopy': True,
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
    export('building_cafe')

if __name__ == '__main__':
    build()
