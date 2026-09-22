"""BVH (MoCapAnything output) -> dog-local 3D points [forward, up, left] per frame + travel along forward."""
import json, os, numpy as np, bvh_fk

# Outputs are Truebones-rig derived (MoCapAnything demo reference skeleton) -> kept on D:, never in the repo.
WORK = os.environ.get("MOCAP_WORK", r"D:\mocap-trial\work")
KEYS = {
 'spine': ['Bip01_Pelvis','Bip01_Spine1','Bip01_Spine2','Bip01_Spine3','Bip01_Neck'],
 'neck':  ['Bip01_Neck','Bip01_Neck2','Bip01_Head'],
 'muzzle':['Bip01_Head','Bip01_Head_Muzzle'],
 'tail':  ['Bip01_Spine0_Tail1','Bip01_Spine0_Tail2','Bip01_Spine0_Tail3','Bip01_Spine0_Tail4'],
 'RH': ['Bip01_R_Thigh','Bip01_R_Calf','Bip01_R_Foot','Bip01_R_Toe0'],
 'LH': ['Bip01_L_Thigh','Bip01_L_Calf','Bip01_L_Foot','Bip01_L_Toe0'],
 'RF': ['Bip01_R_UpperArm','Bip01_R_Forearm','Bip01_R_Hand','Bip01_R_Finger0'],
 'LF': ['Bip01_L_UpperArm','Bip01_L_Forearm','Bip01_L_Hand','Bip01_L_Finger0'],
}
FPS = 15.0  # the input videos are 15 fps; the BVH header's 1/30 frame time does not match
CLIPS = [('out_act2', '官方样例 · 小跑（背景已抠）')]
out = {}
for tag, label in CLIPS:
    names, par, P, _ = bvh_fk.load(os.path.join(WORK, tag, 'npy', 'Dog_Dog_rot6d_pred.bvh'))
    ix = {n: i for i, n in enumerate(names)}
    f = (P[:, ix['Bip01_Head']] - P[:, ix['Bip01_Pelvis']]).mean(0); f[1] = 0; f /= np.linalg.norm(f)
    left = np.cross([0, 1, 0], f)
    L = np.stack([P @ f, P[:, :, 1], P @ left], -1)
    paws = [ix[k[-1]] for k in (KEYS['RH'], KEYS['LH'], KEYS['RF'], KEYS['LF'])]
    ground = np.percentile(L[:, paws, 1].min(1), 10); L[:, :, 1] -= ground
    inc = np.zeros(len(P))
    for t in range(1, len(P)):
        p = paws[int(np.argmin(L[t-1, paws, 1]))]
        inc[t] = -(L[t, p, 0] - L[t-1, p, 0])
    inc = np.convolve(inc, np.ones(5) / 5, mode='same')
    travel = np.cumsum(inc)
    frames = [{k: [[round(float(v), 4) for v in L[t, ix[j]]] for j in js] for k, js in KEYS.items()} for t in range(len(P))]
    out[tag] = {'label': label, 'fps': FPS, 'frames': frames, 'travel': [round(float(x), 4) for x in travel],
                'speed': round(float(travel[-1] / (len(P) / FPS)), 3)}
    print(tag, len(P), 'frames, speed', out[tag]['speed'])
open(os.path.join(WORK, 'mocap_dog.json'), 'w').write(json.dumps(out, separators=(',', ':')))
