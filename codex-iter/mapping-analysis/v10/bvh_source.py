"""Read-only native BVH evaluation; no retargeting.
Copied source-reading code from v9; ALL native samples retained.
"""
import re,json
import numpy as np
from pathlib import Path
from scipy.spatial.transform import Rotation
ROOT=Path(__file__).resolve().parents[3]
def read(p):return json.loads(p.read_text('utf-8-sig'))

def bvh(path):
    text=path.read_text('utf-8');header,motion=text.split('MOTION',1);tokens=re.findall(r'[^\s{}]+|[{}]',header);pos=0;nodes=[];channels=0
    def pop():
        nonlocal pos
        s=tokens[pos];pos+=1;return s
    def node(parent,kind):
        nonlocal channels
        name=pop() if kind!='End' else (pop()+'_'+str(len(nodes)))
        index=len(nodes);row=dict(name=name,parent=parent,offset=None,channels=[],start=channels);nodes.append(row);assert pop()=='{'
        while True:
            key=pop()
            if key=='}':break
            if key=='OFFSET':row['offset']=np.array([float(pop()) for _ in range(3)])
            elif key=='CHANNELS':
                count=int(pop());row['channels']=[pop() for _ in range(count)];row['start']=channels;channels+=count
            elif key in ['JOINT','End']:node(index,key)
            else:raise ValueError('Unexpected BVH token '+key)
        assert row['offset'] is not None
    assert pop()=='HIERARCHY';assert pop()=='ROOT';node(-1,'ROOT');assert pos==len(tokens)
    match=re.match(r'\s*Frames:\s*(\d+)\s*Frame Time:\s*([\d.eE+-]+)\s*',motion);assert match;frames=int(match[1]);dt=float(match[2]);assert abs(1/dt-120)<.02
    values=np.fromstring(motion[match.end():],sep=' ');assert values.size==frames*channels;values=values.reshape(frames,channels);ids=np.arange(frames);values=values[ids];n=len(ids);positions=np.empty((n,len(nodes),3));rotations=np.empty((n,len(nodes),3,3));identity=np.tile(np.eye(3),(n,1,1))
    for j,row in enumerate(nodes):
        local_pos=np.tile(row['offset'],(n,1));rotation_columns=[];order=''
        for k,ch in enumerate(row['channels']):
            data=values[:,row['start']+k]
            # Translation channels specify local positions, replacing OFFSET
            # on that axis (also Blender's BVH armature import convention).
            # Adding the Hips rest OFFSET double-counted its ~1.01 m height.
            if ch.endswith('position'):local_pos[:, 'XYZ'.index(ch[0])]=data
            elif ch.endswith('rotation'):order+=ch[0];rotation_columns.append(data)
            else:raise ValueError(ch)
        local_rot=Rotation.from_euler(order,np.array(rotation_columns).T,degrees=True).as_matrix() if order else identity
        parent=row['parent']
        if parent<0:positions[:,j]=local_pos;rotations[:,j]=local_rot
        else:positions[:,j]=positions[:,parent]+np.einsum('nij,nj->ni',rotations[:,parent],local_pos);rotations[:,j]=rotations[:,parent]@local_rot
    names=[r['name'] for r in nodes];expected=read(Path(__file__).resolve().parent/'reference.json')['names'];assert set(expected).issubset(names),(set(expected)-set(names));s=positions[:,[names.index(k) for k in expected]]*.01
    assert np.isfinite(s).all();J={name:i for i,name in enumerate(expected)};height=float(np.median(s[:,J['HeadEnd'],1]-s[:,J['LeftFoot'],1]));assert .4<height<2.4,('Unit/axis check failed',height)
    return s,dict(native_frames=frames,nominal_native_fps=120,header_frame_time_s=dt,playback_fps=1/dt,sampled_native_frame_ids=ids.tolist(),sampling='Every native frame retained, header rate preserved; no downsampling or time rescaling.',bvh_nodes=len(nodes),bvh_channels=channels,units='BVH centimetres -> metres before mapping',fk='Declared BVH intrinsic channel rotation order, parent/local transforms; translation channels replace OFFSET on their axes, matching Blender armature importer. No floor shift.',median_native_head_to_left_foot_y_m=height),J
