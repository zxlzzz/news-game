"""Audit delivered motion constraints, frozen frames, loop seams and mean root speed.

python scripts/audit_delivery_motions.py [--write]
The denominator is the original generated clip, before a documented trim.
Deferred entries stay in the report as evidence, but are not counted as deliveries.
"""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]

def measure(folder):
 meta=json.loads((folder/'meta.json').read_text(encoding='utf-8-sig'))
 with np.load(folder/'motion.npz',allow_pickle=False) as archive:
  points=archive['posed_joints'];rotations=archive['global_rot_mats']
  finite=all(np.isfinite(archive[key]).all() for key in archive.files if np.issubdtype(archive[key].dtype,np.number))
 fps=float(meta['fps']);generated=round(meta.get('generation_duration',meta['duration'])*fps)
 frames={f for target in meta.get('constraint_targets',[]) if target['type']=='fullbody' for f in target['frames']}
 if not frames:frames={key['frame'] for key in meta.get('keyframes',[])}
 if meta.get('endpoints') and not frames:frames=set(meta.get('constraint_frames',[0,generated-1]))
 frames=sorted((f+generated if f<0 else f) for f in frames)
 spacing=min((b-a for a,b in zip(frames,frames[1:])),default=None)
 max_per_second=max((sum(start<=f<=start+fps for f in frames) for start in frames),default=0)
 movement=np.linalg.norm(np.diff(points,axis=0),axis=2)
 frozen=int((movement.max(axis=1)<0.00001).sum())
 root_speed=np.linalg.norm(np.diff(points[:,0,[0,2]],axis=0),axis=1)*fps
 root_delta=points[-1,0]-points[0,0]
 axes=meta.get('loop_translation_axes','xz')
 if axes not in ('xz','xyz'):raise ValueError(f'{folder.name}: invalid loop_translation_axes {axes!r}')
 travel=root_delta if axes=='xyz' else root_delta*[1,0,1]
 seam=np.linalg.norm((points[-1]-points[0])-travel,axis=1).max()
 return dict(name=folder.name,fps=fps,frames=len(points),generation_frames=generated,
  fullbody_constraint_frames=len(frames),fullbody_constraint_ratio=len(frames)/generated,
  fullbody_min_spacing_frames=spacing,frozen_frames=frozen,
  fullbody_max_in_one_second=max_per_second,
  root_mean_horizontal_speed_mps=float(root_speed.mean()),
  root_speed_min_mps=float(root_speed.min()),root_speed_max_mps=float(root_speed.max()),
  root_delta_m=root_delta.tolist(),loop_translation_axes=axes,floor_min_joint_y_m=float(points[:,:,1].min()),
  seam_root_aligned_max_joint_m=float(seam),seam_global_rotation_matrix_max_abs=float(np.max(np.abs(rotations[-1]-rotations[0]))),
  finite=bool(finite),loop=bool(meta.get('loop',False)),
  npz_sha256=hashlib.sha256((folder/'motion.npz').read_bytes()).hexdigest(),
  rework_required=len(frames)/generated>0.2 or (spacing is not None and spacing<5) or max_per_second>3 or frozen>0)

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--write',action='store_true');args=ap.parse_args()
 path=ROOT/'delivery/检查结果.json'
 motion_dir=ROOT/'delivery/motions'
 folders=sorted(p for p in motion_dir.iterdir() if (p/'motion.npz').exists()) if motion_dir.exists() else []
 report=json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else dict(motions=[dict(name=p.name,delivered=True) for p in folders])
 index={row['name']:row for row in report['motions']};failures=[]
 expected={name for name,row in index.items() if row.get('delivered',True)}
 actual={folder.name for folder in folders}
 failures.extend('missing '+name for name in sorted(expected-actual))
 failures.extend('unexpected '+name for name in sorted(actual-expected))
 if not actual:failures.append('no delivered motions')
 for folder in folders:
  row=measure(folder)
  if folder.name not in index:continue
  index[folder.name].update(row)
  if row['rework_required'] or not row['finite'] or (row['loop'] and (row['seam_root_aligned_max_joint_m']>0.005 or row['seam_global_rotation_matrix_max_abs']>0.00001)):failures.append(row['name'])
  if folder.name=='walk_brisk' and not 1.6<=row['root_mean_horizontal_speed_mps']<=1.9:failures.append('walk_brisk speed')
 if args.write:path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('MOTION_AUDIT_OK' if not failures else 'MOTION_AUDIT_FAIL '+', '.join(failures))
 return int(bool(failures))
if __name__=='__main__':raise SystemExit(main())
