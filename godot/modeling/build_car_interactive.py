"""Rebuild car_interactive from interaction-props.json."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from interaction_props import build
if __name__ == "__main__": build("car_interactive")


# Physical contact nodes share the model build data.
if __name__ == "__main__":
    import sys as _contact_sys
    from pathlib import Path as _ContactPath
    _contact_sys.path.insert(0, str(_ContactPath(__file__).resolve().parent))
    from model_contacts import apply as _apply_contacts
    _apply_contacts(_ContactPath(__file__).resolve().parents[1] / "models" / "car_interactive.glb")


# Independent model articulation is declared alongside the model build data.
if __name__ == "__main__":
    import sys as _motion_sys
    from pathlib import Path as _MotionPath
    _motion_sys.path.insert(0, str(_MotionPath(__file__).resolve().parent))
    from movable_prop_geometry import annotate_model_motion as _annotate_model_motion
    _annotate_model_motion("car_interactive")
