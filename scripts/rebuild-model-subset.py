"""Rebuild an explicit mixture of Blender props, native builders and components."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
def main():
    p=argparse.ArgumentParser()
    p.add_argument('request',type=Path)
    p.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    request=json.loads(args.request.read_text(encoding='utf-8'))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.with_suffix('.log').open('w',encoding='utf-8') as log:
        if request.get('blender'):
            subprocess.run(['D:/steam/steamapps/common/Blender/blender.exe','--background',
                '--factory-startup','--python-exit-code','1','--python',
                str(ROOT/'godot/modeling/rebuild_blender_subset.py'),'--',str(args.request.resolve())],
                stdout=log,stderr=subprocess.STDOUT,check=True,
                creationflags=subprocess.CREATE_NO_WINDOW)
        for name in request.get('native',[]):
            subprocess.run([sys.executable,str(ROOT/f'godot/modeling/build_{name}.py')],
                stdout=log,stderr=subprocess.STDOUT,check=True)
        if request.get('components'):
            subprocess.run([sys.executable,str(ROOT/'godot/modeling/build_component.py'),
                *request['components']],stdout=log,stderr=subprocess.STDOUT,check=True)
    names=sum((request.get(k,[]) for k in ('blender','native','components')),[])
    hashes={name:hashlib.sha256((ROOT/f'godot/models/{name}.glb').read_bytes()).hexdigest() for name in names}
    args.output.write_text(json.dumps(hashes,indent=2),encoding='utf-8')
    print('SUBSET_REBUILT',len(hashes),flush=True)

if __name__=='__main__':main()
