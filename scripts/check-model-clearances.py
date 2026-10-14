"""Regression checks for actual forbidden mesh-pair intersections."""
import fnmatch
import argparse
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('intersections',ROOT/'scripts/check-model-intersections.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--geometry',type=Path,required=True)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    rules=json.loads((ROOT/'godot/modeling/model-clearance-rules.json').read_text())
    cache={};results=[]
    def parts(name):
        if name not in cache:
            meta=json.loads((args.geometry/f'{name}.json').read_text());data=(args.geometry/f'{name}.bin').read_bytes()
            cache[name]=[c.Part(p,data) for p in meta['parts']]
        return cache[name]
    def selected(part,patterns):return any(fnmatch.fnmatchcase(part.name.rsplit('/',1)[-1],pattern) for pattern in patterns)
    for rule in rules:
        for name in rule['models']:
            a=[p for p in parts(name) if selected(p,rule['a'])];b=[p for p in parts(name) if selected(p,rule['b'])]
            assert a and b,(name,'Missing physical parts',rule)
            checked=set();hits=[]
            for left in a:
                for right in b:
                    if left is right:continue
                    key=tuple(sorted((left.name,right.name)))
                    if key in checked:continue
                    checked.add(key);hit=c.pair(left,right)
                    if hit:hits.append(hit)
            results.append(dict(model=name,reason=rule['reason'],checked_pairs=len(checked),intersections=hits))
    if args.output: args.output.write_text(json.dumps(results,indent=2),encoding='utf-8')
    failures=[r for r in results if r['intersections']]
    assert not failures,json.dumps(failures,indent=2)
    print('MODEL_CLEARANCES_OK',len(results),'groups;',sum(r['checked_pairs'] for r in results),'pairs')

if __name__=='__main__':main()
