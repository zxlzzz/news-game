"""自行车. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
# Compact city bicycle: the saddle supports the adult rider above the crank circle.
# Frame joints have one seat tube, a separate exposed seatpost and a head tube.
P = {'wheelbase': 1.12,
 'wheel_r': 0.28,
 'tire_wall': 0.034,
 'fork_clearance': 0.006,
 'tire_t': 0.045,
 'hub_r': 0.028,
 'hub_width': 0.12,
 'rear_hub_width': 0.16,
 'spoke_r': 0.006,
 'frame_r': 0.016,
 'chainstay_mount_x': 0.035,
 'chainstay_bend_fraction': 0.15,
 'seatstay_bend_fraction': 0.78,
 'frame_segments': [((0, 0.28, -0.56), (0, 0.33, 0.06)),
                    ((0, 0.33, 0.06), (0, 0.65, -0.111192732)),
                    ((0, 0.65, -0.111192732), (0, 0.28, -0.56)),
                    ((0, 0.65, -0.111192732), (0, 0.77, 0.39)),
                    ((0, 0.66, 0.43), (0, 0.33, 0.06)),
                    ((0, 0.66, 0.43), (0, 0.28, 0.56))],
 'seatpost_start': (0, 0.65, -0.111192732),
 'seatpost_end': (0, 0.7580555556, -0.169),
 'seatpost_r': 0.012,
 'head_tube_start': (0, 0.66, 0.43),
 'head_tube_end': (0, 0.77, 0.39),
 'head_tube_r': 0.022,
 'stem_r': 0.012,
 'seat_size': (0.16, 0.035, 0.27),
 'seat_center': (0, 0.7715555556, -0.23),
 # z fraction, width fraction, top drop; one closed moulded saddle.
 'saddle_stations': [(-0.5, 0.68, 0.005), (-0.39, 1.0, 0),
                     (-0.09, 0.88, 0.001), (0.0, 0.72, 0.003),
                     (0.22, 0.40, 0.009), (0.42, 0.24, 0.014),
                     (0.5, 0.14, 0.016)],
 'saddle_round': 0.009,
 'saddle_lower_round': 0.004,
 'steerer_top': (0, 0.96, 0.3209090909),
 'handle_stem_r': 0.014,
 'handle_w': 0.48,
 'handle_y': 0.98,
 'handle_z': 0.40,
 'handle_center_z': 0.44,
 'handle_middle_w': 0.12,
 'handle_grip_inner_x': 0.11,
 'handle_r': 0.017,
 'crank_w': 0.20,
 'crank_axle_r': 0.009,
 'crank_arm_r': 0.012,
 'crank_bearing_r': 0.012,
 'bottom_bracket_r': 0.025,
 'bottom_bracket_w': 0.11,
 'crank_bore_margin': 0.006,
 'pedal_offset': 0.08,
 'pedal_rim': 0.018,
 'pedal_deck_t': 0.035,
 'pedal_corner': 0.018,
 'spindle_r': 0.009,
 'chain_x': -0.078,
 'chainring_r': 0.105,
 'chainring_wall': 0.014,
 'chainring_t': 0.012,
 'chain_r': 0.0055,
 'chain_arc_segments': 16,
 'sprocket_r': 0.043,
 'crank_y': 0.33,
 'crank_z': 0.06,
 'pedal_size': (0.11, 0.05, 0.135),
 'crank_radius': 0.15,
 'motor': False}

def build():
    reset()
    from vehicle_geometry import build_two_wheeler
    build_two_wheeler(P)
    export('bicycle')

if __name__ == '__main__':
    build()


# Physical contacts belong to this model, including moving-part parenting.
if __name__ == "__main__":
    import sys as _contact_sys
    from pathlib import Path as _ContactPath
    _contact_sys.path.insert(0, str(_ContactPath(__file__).resolve().parent))
    from model_contacts import apply as _apply_contacts
    _apply_contacts(_ContactPath(__file__).resolve().parents[1] / "models" / "bicycle.glb")


# Independent model articulation is declared alongside the model build data.
if __name__ == "__main__":
    import sys as _motion_sys
    from pathlib import Path as _MotionPath
    _motion_sys.path.insert(0, str(_MotionPath(__file__).resolve().parent))
    from movable_prop_geometry import annotate_model_motion as _annotate_model_motion
    _annotate_model_motion("bicycle")
