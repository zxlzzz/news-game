"""Pick our 11 stick joints out of a Kimodo SOMA npz (77 joints) and dump frames as JSON (meters, Y up).
Joint indices were identified from the SOMA kinematic tree (parent recovered from rotation matrices)."""
import json, sys, numpy as np
MAP = {'body': 0, 'neck': 5, 'head': 7, 'l_elbow': 13, 'l_hand': 14, 'r_elbow': 41, 'r_hand': 42,
       'l_knee': 68, 'l_foot': 69, 'r_knee': 73, 'r_foot': 74}
src, dst = sys.argv[1], sys.argv[2]
d = np.load(src)
J = d['posed_joints']
frames = [{k: [round(float(v), 4) for v in J[f, i]] for k, i in MAP.items()} for f in range(len(J))]
json.dump({'fps': 30, 'frames': frames}, open(dst, 'w'))
print(len(frames), frames[0])
