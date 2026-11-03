"""Deterministic original prop; metres, Y up and +Z front.
Shape parameters are declared below; runtime supplies grayscale/outline style.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
from model_contacts import apply

NAME='scattered_papers'
P=dict(size=(.21,.0012,.30),centers=[(-.3,0,.2),(.12,0,.05),(.35,0,-.25),(-.2,0,-.24),(.05,0,.43)])

def build():
    reset()
    for x,_,z in P['centers']:box('paper',P['size'],(x,P['size'][1]/2,z),'trim')
    export(NAME)


if __name__=='__main__':
    build()
    apply(Path(__file__).resolve().parents[1]/'models'/f'{NAME}.glb')
