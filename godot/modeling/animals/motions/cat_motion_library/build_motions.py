import sys
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/"animal_tools"))
from motion_core import main
main(HERE,HERE.parents[1]/"models/animal_cat/profile.json",HERE.parents[3]/"models/animal_cat.glb")
