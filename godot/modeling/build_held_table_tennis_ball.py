"""Rebuild held_table_tennis_ball from interaction-props.json."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from interaction_props import build
if __name__ == "__main__": build("held_table_tennis_ball")
