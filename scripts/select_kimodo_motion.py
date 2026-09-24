"""Copy an explicitly reviewed candidate into the existing NPZ library; never auto-approve.

Arguments: candidate folder, --name public_name --notes Chinese_review --attempts N
Optional --loop declares lifecycle use in the separate endpoint index, never in meta.json.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('folder',type=Path); ap.add_argument('--name',required=True)
    ap.add_argument('--notes',required=True); ap.add_argument('--attempts',type=int,required=True)
    ap.add_argument('--loop',action='store_true')
    args=ap.parse_args()
    if not args.name or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789_' for c in args.name):
        raise ValueError('Invalid asset name')
    target=ROOT/'assets/animations/npz'/args.name
    if target.exists():
        raise FileExistsError('Selection will not overwrite an existing asset: '+str(target))
    metrics=json.loads((args.folder.parent/(args.folder.name+'_mapped_metrics.json')).read_text())
    meta=json.loads((args.folder/'meta.json').read_text(encoding='utf-8-sig'))
    with np.load(args.folder/'motion.npz',allow_pickle=False) as data:
        assert data['posed_joints'].shape==(round(meta['duration']*meta['fps']),77,3)
        assert data['foot_contacts'].shape==(len(data['posed_joints']),6)
        assert all(np.isfinite(v).all() for v in data.values() if np.issubdtype(v.dtype,np.number))
        if args.loop:
            assert metrics['endpoint_root_aligned_max_joint_m']<.005,metrics
    target.mkdir()
    shutil.copy2(args.folder/'motion.npz',target/'motion.npz')
    src_hash=hashlib.sha256((args.folder/'motion.npz').read_bytes()).hexdigest()
    assert src_hash==hashlib.sha256((target/'motion.npz').read_bytes()).hexdigest()
    meta['name']=args.name
    meta['review']=dict(status='selected',date='2026-09-24',notes_zh=args.notes,attempts=args.attempts,
        views=['source side','source full hands','accepted mapping x3 front/side','prop reference where applicable'],
        metrics=metrics,sha256=src_hash)
    (target/'meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    index_path=ROOT/'assets/animations/clip_endpoints.json'
    index=json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else dict(
        description='New assets only; original NPZ frame indices. Root displacement is retained; no runtime integration implied.',clips={})
    index['clips'][args.name]=dict(loop=args.loop,entry=dict(clip=args.name,frame=0),
        exit=dict(clip=args.name,frame=metrics['frames']-1),source_root_delta_m=metrics['source_root_delta_m'],
        endpoint_root_aligned_max_joint_m=metrics['endpoint_root_aligned_max_joint_m'])
    index_path.write_text(json.dumps(index,ensure_ascii=False,indent=2),encoding='utf-8')
    print('SELECTED',args.name,src_hash)


if __name__=='__main__':
    main()
