import sys
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'animal_tools'))
from convert_animal import run
if __name__=='__main__':run(HERE/'profile.json')
