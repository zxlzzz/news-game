"""Rebuild held_table_tennis_ball from interaction-props.json."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from interaction_props import build
if __name__ == "__main__": build("held_table_tennis_ball")


# Physical contact nodes share the model build data.
if __name__ == "__main__":
    import sys as _contact_sys
    from pathlib import Path as _ContactPath
    _contact_sys.path.insert(0, str(_ContactPath(__file__).resolve().parent))
    from model_contacts import apply as _apply_contacts
    _apply_contacts(_ContactPath(__file__).resolve().parents[1] / "models" / "held_table_tennis_ball.glb")
