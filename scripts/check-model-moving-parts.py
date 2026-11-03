"""Check actual Godot exports for part motion, rigid supports and articulation clearance."""
import argparse
import importlib.util
import json
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('intersections',ROOT/'scripts/check-model-intersections.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
spec=importlib.util.spec_from_file_location('contacts',ROOT/'godot/modeling/model_contacts.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)

def read_parts(path):
    meta=json.loads(path.read_text())
    data=path.with_suffix('.bin').read_bytes()
    return [c.Part(p,data) for p in meta['parts']]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--geometry',type=Path,required=True)
    parser.add_argument('--names',nargs='+',required=True)
    args=parser.parse_args()
    count=0
    for name in args.names:
        doc,_=g.read(ROOT/'godot/models'/f'{name}.glb')
        pivots=[n['name'] for n in doc['nodes'] if 'motion' in n.get('extras',{})]
        assert pivots,(name,'No motion pivots')
        files=sorted(args.geometry.glob(f'{name}__parts_*.json'))
        assert len(files)>=3,(name,'Insufficient actual phase exports')
        base=read_parts(args.geometry/f'{name}.json')
        groups={p.name:next((pivot for pivot in pivots if pivot in p.name.split('/')),None) for p in base}
        fixed={p.name:p.points for p in base if groups[p.name] is None}
        moved=set()
        baseline={p.name:p.points for p in base}
        for file in files:
            parts=read_parts(file)
            for part in parts:
                if part.name in fixed:
                    assert np.allclose(part.points,fixed[part.name],atol=1e-5),(name,file.stem,'Fixed geometry moved',part.name)
                elif not np.allclose(part.points,baseline[part.name],atol=1e-5):
                    moved.add(groups[part.name])
            for part in parts:
                if part.name in fixed: continue
                for other in parts:
                    if other.name not in fixed: continue
                    hit=c.pair(part,other)
                    assert not hit,(name,file.stem,'Moving part crosses fixed geometry',hit)
            moving_parts=[part for part in parts if part.name not in fixed]
            for index,part in enumerate(moving_parts):
                for other in moving_parts[index+1:]:
                    if groups[part.name]==groups[other.name]: continue
                    hit=c.pair(part,other)
                    assert not hit,(name,file.stem,'Independent moving parts collide',hit)
            count+=1
        assert all(p in moved for p in pivots),(name,'Pivot does not move geometry',set(pivots)-moved)
        print('MODEL_PARTS_REVIEWED',name,len(pivots),'pivots;',len(files),'phases',flush=True)
    print('MODEL_MOVING_PARTS_OK',len(args.names),'models;',count,'phase exports')

if __name__=='__main__': main()
