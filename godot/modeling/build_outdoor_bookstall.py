"""Deterministic original prop; metres, Y up and +Z front.
Shape parameters are declared below; runtime supplies grayscale/outline style.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
from model_contacts import apply

NAME='outdoor_bookstall'
P=dict(table_size=(2.4,.12,.9),table_at=(0,.8,0),leg_size=(.12,.74,.12),leg_x=(-1,1),leg_z=(-.32,.32),
       book_width=.28,book_depth=.38,stack_x=(-.9,-.45,0,.45,.9),stack_z=(-.23,.23),
       stack_height=(.15,.23,.12,.19,.27),stack_base=.86,book_target_height=.045,cover_height=.003,
       cover_margin=.008,spine_depth=.012)

def build():
    reset()
    box('table',P['table_size'],P['table_at'],'wood')
    for x in P['leg_x']:
        for z in P['leg_z']:box('leg',P['leg_size'],(x,P['leg_size'][1]/2,z),'wood')
    for x,height in zip(P['stack_x'],P['stack_height']):
        count=max(2,round(height/P['book_target_height'])); step=height/count
        for z in P['stack_z']:
            for i in range(count):
                y=P['stack_base']+step*i;cover='metal_dark' if i%2 else 'fabric'
                box('book_pages',(P['book_width']-P['cover_margin'],step-2*P['cover_height'],P['book_depth']-P['cover_margin']),
                    (x,y+step/2,z),'trim')
                for yy in (y+P['cover_height']/2,y+step-P['cover_height']/2):
                    box('book_cover',(P['book_width'],P['cover_height'],P['book_depth']),(x,yy,z),cover)
                box('book_spine',(P['book_width'],step,P['spine_depth']),
                    (x,y+step/2,z-P['book_depth']/2+P['spine_depth']/2),cover)
    export(NAME)


if __name__=='__main__':
    build()
    apply(Path(__file__).resolve().parents[1]/'models'/f'{NAME}.glb')
