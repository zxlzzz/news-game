"""Recover missing facade installation planes from actual assembled wall geometry."""
import importlib.util
import argparse
import json
import os
from pathlib import Path
import tempfile
import numpy as np
from shapely.geometry import Polygon, box

parser=argparse.ArgumentParser()
parser.add_argument('--verify',action='store_true',help='Compare inferred planes without rewriting models or layouts.')
parser.add_argument('--geometry',type=Path,required=True)
parser.add_argument('--output',type=Path)
args=parser.parse_args()

ROOT=Path(__file__).resolve().parents[1]
MODELING=ROOT/'godot/modeling'
OUT=args.output
spec=importlib.util.spec_from_file_location('window_details',MODELING/'window_details.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
layouts=json.loads((MODELING/'building-layouts.json').read_text())
samples={}
repairs=[]
for building,layout in layouts.items():
    meta=json.loads((args.geometry/f'{building}.json').read_text())
    data=(args.geometry/f'{building}.bin').read_bytes()
    walls=[];wall_owners=[]
    door_backings=[]
    for joint in meta.get('door_joints',[]):
        parts=[p for p in meta['parts'] if p['name'].startswith(joint['name']+'/')]
        points=np.concatenate([np.frombuffer(data,dtype='<f4',count=p['vertices']*3,
            offset=p['offset']).reshape(-1,3) for p in parts])
        pivot=np.array(joint['pivot']);stop=float(joint['open_degrees'])
        sweep=[]
        for degrees in np.r_[np.arange(0,abs(stop),5),abs(stop)]:
            angle=np.deg2rad(np.sign(stop)*degrees);cs,sn=np.cos(angle),np.sin(angle)
            rotation=np.array([[cs,0,sn],[0,1,0],[-sn,0,cs]])
            sweep.append((points-pivot)@rotation.T+pivot)
        swept=np.concatenate(sweep)
        door_backings.append((swept.min(0),swept.max(0),points[:,2].min()))
    def is_door_backing(tri):
        # A newly fitted door pocket can reach the adjacent window's probe
        # ring. Its close rear cap is not the window's facade mounting plane.
        # Use the actual leaf/handle sweep, rather than model-name exceptions.
        a,b=tri.min(0),tri.max(0)
        if b[2]-a[2]>.0005:return False
        return any(0<back-a[2]<.02 and (a[:2]>=lo[:2]-.03).all()
                   and (b[:2]<=hi[:2]+.03).all() for lo,hi,back in door_backings)
    for part in meta['parts']:
        if not part['name'].startswith('model/'):continue
        if not (part['slot'].startswith('wall') or 'window_surround' in part['name']):continue
        count=part['vertices'];offset=part['offset']
        points=np.frombuffer(data,dtype='<f4',count=count*3,offset=offset).reshape(-1,3)
        indices=np.frombuffer(data,dtype='<i4',count=part['indices'],offset=offset+count*12).reshape(-1,3)
        triangles=points[indices].astype(float)
        normals=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
        normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
        walls.append((triangles,normals))
        if part['name'].endswith('_masonry'):
            wall_owners.append((points.min(0),points.max(0)))
    wall_points=np.concatenate([triangles.reshape(-1,3) for triangles,_ in walls])
    building_center=(wall_points.min(0)+wall_points.max(0))/2
    for row_index,row in enumerate(layout):
        name=row['type']
        if not name.startswith('window_'):continue
        recipe=json.loads((MODELING/f'components/{name}.json').read_text())
        sash=next(p for p in recipe['parts'] if p.get('moving'))
        loop=w.outline(sash['primitives'])
        plane=np.linalg.lstsq(np.c_[loop[:,:2],np.ones(len(loop))],loop[:,2],rcond=None)[0]
        normal=np.array([-plane[0],-plane[1],1.]);normal/=np.linalg.norm(normal)
        a=row.get('yaw',0);rotation=np.array([[np.cos(a),0,np.sin(a)],[0,1,0],[-np.sin(a),0,np.cos(a)]])
        origin=np.array(row['position']);forward=normal@rotation.T
        owner_center=building_center
        if building=='building_rowhouse':
            choices=[(a,b) for a,b in wall_owners if a[1]-.1<=origin[1]<=b[1]+.1]
            owner=min(choices,key=lambda bounds:abs(origin[0]-(bounds[0][0]+bounds[1][0])/2))
            owner_center=(owner[0]+owner[1])/2
        radial=origin-owner_center;radial[1]=0
        if np.dot(forward,radial)<0:
            old=row.get('yaw',0);row['yaw']=old+np.pi
            repairs.append(dict(building=building,index=row_index,type=name,old_yaw=old,new_yaw=row['yaw']))
            a=row['yaw'];rotation=np.array([[np.cos(a),0,np.sin(a)],[0,1,0],[-np.sin(a),0,np.cos(a)]])
            forward=normal@rotation.T
        values=[]
        # Probe outside pane/frame tolerances, so a slightly larger blind
        # recess back cap cannot be mistaken for the exterior facade.
        ring=Polygon(w.inset(loop,-.22)[:,:2]).difference(Polygon(w.inset(loop,-.15)[:,:2]))
        low,high=loop.min(0),loop.max(0)
        ring=ring.intersection(box(low[0]-1,low[1]+.3*(high[1]-low[1]),high[0]+1,low[1]+.7*(high[1]-low[1])))
        for tris,normals in walls:
            chosen=np.abs(normals@forward)>.999
            local=(tris[chosen]-origin)@rotation
            if not len(local):continue
            lo=local.min(1);hi=local.max(1)
            overlap=(hi[:,:2]>=loop.min(0)[:2]-.22).all(1)&(lo[:,:2]<=loop.max(0)[:2]+.22).all(1)
            for tri in local[overlap]:
                if Polygon(tri[:,:2]).intersection(ring).area>.0004 and not is_door_backing(tri@rotation.T+origin):
                    distance=float((tri@normal).mean())
                    if .06<abs(distance-float(loop[0]@normal))<2:values.append(distance)
        assert values,(building,name,'No facade installation surface')
        # Recess back caps share the facade normal. The outermost adjacent
        # surface is the exterior, regardless of whether the pane origin lies
        # inside or outside the masonry. Signed distance alone is ambiguous.
        distance=max(values)
        samples.setdefault(name,[]).append(dict(building=building,index=row_index,plane=round(distance,6)))

existing=json.loads((MODELING/'window-installation.json').read_text()) if (MODELING/'window-installation.json').exists() else {}
def default_installation(name):
    family=w.STRUCTURES[name]['family']
    key='awning_degrees' if family in ('awning','display_vent') else 'casement_degrees'
    return dict(open_degrees=-w.PARAMS[key])

installation={name:dict(existing.get(name,default_installation(name)),
    mount_plane=min(s['plane'] for s in rows)) for name,rows in sorted(samples.items())}
for settings in installation.values():
    settings.pop('frame_width',None)  # Derived from pane dimensions by the builder.
placement_repairs=[]
for name,rows in samples.items():
    mount=installation[name]['mount_plane']
    for sample in rows:
        delta=sample['plane']-mount
        if delta<.001:continue
        recipe=json.loads((MODELING/f'components/{name}.json').read_text())
        row=layouts[sample['building']][sample['index']]
        loop=w.outline(recipe['parts'][0]['primitives'])
        plane=np.linalg.lstsq(np.c_[loop[:,:2],np.ones(len(loop))],loop[:,2],rcond=None)[0]
        local_normal=np.array([-plane[0],-plane[1],1.]);local_normal/=np.linalg.norm(local_normal)
        yaw=row.get('yaw',0);rotation=np.array([[np.cos(yaw),0,np.sin(yaw)],[0,1,0],[-np.sin(yaw),0,np.cos(yaw)]])
        normal=local_normal@rotation.T
        old=list(row['position']);row['position']=np.round(np.array(old)+delta*normal,6).tolist()
        placement_repairs.append(dict(building=sample['building'],index=sample['index'],type=name,old_position=old,new_position=row['position']))
assert len(installation)==104
installation['window_single']=existing.get('window_single',dict(mount_plane=0.0,open_degrees=-w.PARAMS['casement_degrees']))
if args.verify:
    differences={n:(existing[n]['mount_plane'],v['mount_plane']) for n,v in installation.items()
                 if abs(existing[n]['mount_plane']-v['mount_plane'])>.001}
    assert not (repairs or placement_repairs or differences),(repairs,placement_repairs,differences)
    if OUT: (OUT/'window_installation_sources.json').write_text(json.dumps(samples,indent=2),encoding='utf-8')
    print('WINDOW_INSTALLATION_VERIFIED',len(installation))
    raise SystemExit(0)
path=MODELING/'window-installation.json'
with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as f:
    f.write((json.dumps(installation,indent=2)+'\n').replace('\n','\r\n').encode());pending=f.name
os.replace(pending,path)
layout_path=MODELING/'building-layouts.json'
with tempfile.NamedTemporaryFile(dir=layout_path.parent,delete=False) as f:
    f.write((json.dumps(layouts,indent=2)+'\n').replace('\n','\r\n').encode());pending=f.name
os.replace(pending,layout_path)
if repairs or placement_repairs:
    if OUT: (OUT/'window_orientation_repairs.json').write_text(json.dumps(repairs,indent=2),encoding='utf-8')
    if OUT: (OUT/'window_placement_repairs.json').write_text(json.dumps(placement_repairs,indent=2),encoding='utf-8')
    import sys
    sys.path.insert(0,str(MODELING))
    from modular_buildings import assemble
    for name in sorted({r['building'] for r in repairs+placement_repairs}):assemble(name)
if OUT: (OUT/'window_installation_sources.json').write_text(json.dumps(samples,indent=2),encoding='utf-8')
print('WINDOW_INSTALLATION_PLANES',len(installation),'OUTWARD_ORIENTATION_REPAIRS',len(repairs),
      'shared spreads',[(n,round(max(s['plane'] for s in r)-min(s['plane'] for s in r),6)) for n,r in samples.items() if max(s['plane'] for s in r)-min(s['plane'] for s in r)>.001])
