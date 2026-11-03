"""Reproduce endpoint-constraint experiment inside the existing Kimodo container."""
import json
import pathlib
import numpy as np
import torch
from kimodo import load_model
from kimodo.constraints import FullBodyConstraintSet
from kimodo.skeleton.definitions import SOMASkeleton77
from kimodo.exports.motion_io import save_kimodo_npz
from kimodo.tools import seed_everything
from kimodo_motion_batch import inspect_motion

root = pathlib.Path('/tmp/constraint_probe')
parents = SOMASkeleton77.bone_order_names_with_parents
names = [n for n, _ in parents]
target = dict(np.load(root/'input/stand_idle/motion.npz'))
shake = dict(np.load(root/'input/shake_foot/motion.npz'))
frame = 18
feet = ['LeftFoot','LeftToeBase','LeftToeEnd','RightFoot','RightToeBase','RightToeEnd']
contact = dict(frame=frame, seconds=frame/30, columns=feet,
               joint_indices=[names.index(n) for n in feet],
               values=shake['foot_contacts'][frame].tolist(),
               xyz_m=shake['posed_joints'][frame,[names.index(n) for n in feet]].tolist())
(root/'foot_contact_evidence.json').write_text(json.dumps(contact,indent=2))
inspect_motion(root/'input/shake_foot',names,parents)
print('CONTACT '+json.dumps(contact),flush=True)
model = load_model('Kimodo-SOMA-RP-v1.1',device='cuda:0')
subset = model.skeleton.get_skel_slice(model.skeleton.somaskel77)
print('READY',flush=True)
while True:
 line=input()
 if line=='quit':break
 cfg=json.loads(line)
 n=round(cfg['duration']*30)
 positions=torch.tensor(target['posed_joints'][[0,0]],device=model.device)[:,subset]
 rotations=torch.tensor(target['global_rot_mats'][[0,0]],device=model.device)[:,subset]
 constraint=FullBodyConstraintSet(model.skeleton,torch.tensor([0,n-1]),positions,rotations)
 seed_everything(cfg['seed'])
 out=model(cfg['text'],n,num_denoising_steps=100,num_samples=1,
           constraint_lst=[constraint],cfg_type='separated',cfg_weight=[2.,2.],
           post_processing=True,return_numpy=True,progress_bar=lambda x:x)
 out={k:v[0] if isinstance(v,np.ndarray) and v.ndim>0 and v.shape[0]==1 else v for k,v in out.items()}
 folder=root/cfg['name'];folder.mkdir(exist_ok=True)
 save_kimodo_npz(str(folder/'motion.npz'),out)
 cfg.update(fps=30,model='Kimodo-SOMA-RP-v1.1',text_encoder='matbee/kimodo-llm2vec-nf4',post_processing=True,
            constraint_frames=[0,n-1],target='stand_idle/motion.npz frame 0',
            constraint_type='FullBodyConstraintSet',diffusion_steps=100,cfg_weight=[2,2])
 (folder/'meta.json').write_text(json.dumps(cfg,indent=2))
 errors=np.linalg.norm(out['posed_joints'][[0,-1]]-target['posed_joints'][0],axis=-1)
 ix=[names.index(x) for x in ['LeftHand','RightHand']]
 times=np.linspace(0,n-1,9).round().astype(int)
 stats=dict(mean_error_m=errors.mean(axis=1).tolist(),max_error_m=errors.max(axis=1).tolist(),
            per_joint_error_m=errors.tolist(),joint_names=names,
            subset_mean_error_m=errors[:,subset.cpu().numpy() if hasattr(subset,'cpu') else subset].mean(axis=1).tolist(),
            sample_frames=times.tolist(),hands_xyz_m=out['posed_joints'][times][:,ix].tolist())
 stats['inspection']=inspect_motion(folder,names,parents)
 (folder/'measurements.json').write_text(json.dumps(stats,indent=2))
 print('DONE '+cfg['name']+' '+json.dumps({k:v for k,v in stats.items() if k in ['mean_error_m','max_error_m','subset_mean_error_m']}),flush=True)
