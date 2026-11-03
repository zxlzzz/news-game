"""Find part crossings and competing coplanar faces in actual assembled models.

Run Godot tools/export_model_geometry.gd first. Results are candidates for physical
review: a welded joint, a buried mounting end and an intentional foliage union are
not automatically defects. Crossings are evaluated on triangles, not just boxes.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from rtree import index
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1]
TOL=0.0005
AREA_TOL=0.0004

def tree(bounds):
    properties=index.Property();properties.dimension=3
    return index.Index(((i,tuple(b),None) for i,b in enumerate(bounds)),properties=properties)

def bounds(triangles):
    return np.concatenate((triangles.min(1),triangles.max(1)),axis=1)

def crossings(a,b):
    """Proper segment/triangle crossings; touching end points are excluded."""
    points=[]
    for source,target in [(a,b),(b,a)]:
        e1=target[:,1]-target[:,0];e2=target[:,2]-target[:,0]
        for k in range(3):
            origin=source[:,k];delta=source[:,(k+1)%3]-origin
            h=np.cross(delta,e2);det=np.einsum('ij,ij->i',e1,h)
            valid=np.abs(det)>1e-12
            inv=np.divide(1,det,out=np.zeros_like(det),where=valid)
            s=origin-target[:,0];u=inv*np.einsum('ij,ij->i',s,h)
            q=np.cross(s,e1);v=inv*np.einsum('ij,ij->i',delta,q)
            t=inv*np.einsum('ij,ij->i',e2,q)
            edge_length=np.linalg.norm(delta,axis=1)
            epsilon=TOL/np.maximum(edge_length,TOL)
            hit=valid&(u>=-1e-7)&(v>=-1e-7)&(u+v<=1+1e-7)&(t>epsilon)&(t<1-epsilon)
            if hit.any():points.append(origin[hit]+delta[hit]*t[hit,None])
    if not points:return np.empty((0,3))
    return np.unique(np.round(np.concatenate(points),5),axis=0)

def planes(triangles):
    cross=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
    length=np.linalg.norm(cross,axis=1)
    normals=cross/np.maximum(length[:,None],1e-20)
    groups={}
    for t,n,area in zip(triangles,normals,length/2):
        if area<1e-10:continue
        key=(*np.round(n,5),round(float(np.dot(n,t[0])),5))
        groups.setdefault(key,[]).append(t)
    result=[]
    for key,tris in groups.items():
        n=np.array(key[:3]);drop=int(np.abs(n).argmax());axes=[i for i in range(3) if i!=drop]
        area=unary_union([Polygon(t[:,axes]) for t in tris])
        if area.area>=AREA_TOL:result.append((n,key[3],axes,area))
    return result

class Part:
    def __init__(self,meta,data):
        self.meta=meta;self.name=meta['name'];self.slot=meta['slot']
        start=meta['offset'];n=meta['vertices'];m=meta['indices']
        self.points=np.frombuffer(data,dtype='<f4',count=n*3,offset=start).reshape(-1,3).astype(float)
        self.indices=np.frombuffer(data,dtype='<i4',count=m,offset=start+n*12).reshape(-1,3)
        self.tris=self.points[self.indices]
        self.box=np.r_[self.points.min(0),self.points.max(0)]
        self._tree=None;self._planes=None
        unique=np.unique(np.round(self.points,5),axis=0)
        _,_,vectors=np.linalg.svd(unique-unique.mean(0),full_matrices=False)
        self.axis=vectors[0];projected=unique@self.axis
        self.axis_min=projected.min();self.axis_size=projected.ptp() if hasattr(projected,'ptp') else np.ptp(projected)
        spans=np.ptp(unique@vectors.T,axis=0)
        self.strut=self.slot.startswith('metal') and spans[0]>.12 and spans[0]/max(spans[1],spans[2],.001)>3
    @property
    def tri_tree(self):
        if self._tree is None:self._tree=tree(bounds(self.tris))
        return self._tree
    @property
    def flat_planes(self):
        if self._planes is None:self._planes=planes(self.tris)
        return self._planes

def pair(a,b):
    overlap=np.minimum(a.box[3:],b.box[3:])-np.maximum(a.box[:3],b.box[:3])
    if overlap.min()<-TOL:return None
    ia=[];ib=[]
    # Query the larger part with the smaller part's triangle boxes.
    if len(a.tris)>len(b.tris):a,b=b,a
    for k,box in enumerate(bounds(a.tris)):
        found=list(b.tri_tree.intersection(tuple(box)))
        ia.extend([k]*len(found));ib.extend(found)
    if not ia:return None
    # Float32 exports can put a mating face a few microns past its neighbour.
    # Such face contact is not volumetric penetration.
    points=crossings(a.tris[ia],b.tris[ib]) if overlap.min()>TOL else np.empty((0,3))
    same_face_area=0.
    for na,da,axes,pa in a.flat_planes:
        for nb,db,_,pb in b.flat_planes:
            # Opposite normals represent mating faces, not competing visible faces.
            if np.dot(na,nb)>.999999 and abs(da-db)<TOL:
                same_face_area+=pa.intersection(pb).area/max(abs(na[3-sum(axes)]),.001)
    if len(points)<2 and same_face_area<AREA_TOL:return None
    middle=[]
    for rod,other in [(a,b),(b,a)]:
        if rod.strut and not other.strut and len(points):
            fractions=(points@rod.axis-rod.axis_min)/max(rod.axis_size,.001)
            if ((fractions>.15)&(fractions<.85)).any():middle.append(rod.name)
    priority=3 if middle else 2 if same_face_area>=AREA_TOL else 1
    if a.slot==b.slot=='foliage':priority=0
    if a.slot in ('hidden','paint') or b.slot in ('hidden','paint'):priority=0
    if len(points):lo=points.min(0);hi=points.max(0)
    else:lo=np.maximum(a.box[:3],b.box[:3]);hi=np.minimum(a.box[3:],b.box[3:])
    return dict(parts=[a.name,b.name],slots=[a.slot,b.slot],surfaces=[a.meta['surface'],b.meta['surface']],
        crossing_points=len(points),same_facing_coplanar_area_m2=round(same_face_area,6),
        bounds_min=lo.tolist(),bounds_max=hi.tolist(),middle_struts=middle,priority=priority)

def audit(name,folder):
    meta=json.loads((folder/f'{name}.json').read_text())
    data=(folder/f'{name}.bin').read_bytes()
    parts=[Part(m,data) for m in meta['parts']]
    result=[];part_tree=tree([p.box for p in parts])
    for i,a in enumerate(parts):
        for j in part_tree.intersection(tuple(a.box)):
            if j<=i:continue
            if '__open_' in name:
                # Opening checks need moving/fixed clearance, including an
                # assembled building's walls and neighbouring components.
                left=a.name.split('SashHinge/')[0] if 'SashHinge/' in a.name else None
                right=parts[j].name.split('SashHinge/')[0] if 'SashHinge/' in parts[j].name else None
                if left==right:continue
            candidate=pair(a,parts[j])
            if candidate:result.append(candidate)
    result.sort(key=lambda r:(r['priority'],r['same_facing_coplanar_area_m2'],r['crossing_points']),reverse=True)
    return dict(name=name,assembled=meta['assembled'],mesh_surfaces=len(parts),candidates=result)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--geometry',type=Path,required=True);parser.add_argument('--output',type=Path)
    parser.add_argument('--names',nargs='*');parser.add_argument('--label',default='baseline')
    args=parser.parse_args();folder=args.geometry
    names=args.names or [p.stem for p in sorted(folder.glob('*.json'))]
    result=[]
    for k,name in enumerate(names):
        item=audit(name,folder);result.append(item)
        if (k+1)%25==0:print('AUDITED',k+1,len(names),flush=True)
    assert names, 'No geometry inputs'
    if args.output: args.output.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print('INTERSECTION_CANDIDATES',len(result),sum(len(r['candidates']) for r in result),flush=True)

if __name__=='__main__':main()
