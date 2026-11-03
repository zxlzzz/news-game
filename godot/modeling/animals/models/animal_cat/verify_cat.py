import sys,json
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/"animal_tools"))
from verify_animal import verify
verify(Path(sys.argv[1]) if len(sys.argv)>1 else HERE/"animal_cat.glb",json.loads((HERE/"profile.json").read_text(encoding="utf-8")))
