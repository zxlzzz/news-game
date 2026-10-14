"""Remove an internal coplanar flap without changing vertices, skinning or animation."""
from collections import defaultdict, Counter
import struct
import numpy as np
from check_model import accessor
from model_contacts import read, write

VERTEX_TOLERANCE = 0.000001

def repair_internal_flaps(path):
    doc,binary=read(path); binary=bytearray(binary); removed=0
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            positions=np.array(accessor(doc,binary,prim['attributes']['POSITION']))
            index=prim['indices']; triangles=np.array(accessor(doc,binary,index),dtype=int).reshape(-1,3)
            lookup={}; vertex_ids=[]
            for p in positions:
                key=tuple(np.round(p/VERTEX_TOLERANCE).astype(int))
                vertex_ids.append(lookup.setdefault(key,len(lookup)))
            welded=np.array(vertex_ids)[triangles]; edges=defaultdict(list)
            for k,t in enumerate(welded):
                for a,b in zip(t,np.roll(t,-1)):edges[tuple(sorted((int(a),int(b))))].append(k)
            coplanar={k for k,t in enumerate(triangles) if np.ptp(positions[t,0])<VERTEX_TOLERANCE}
            seeds={k for e,faces in edges.items() if len(faces)>2 for k in faces if k in coplanar}
            if not seeds:continue
            candidates=set(seeds);pending=list(sorted(seeds))
            while pending:
                k=pending.pop()
                for a,b in zip(welded[k],np.roll(welded[k],-1)):
                    for neighbor in edges[tuple(sorted((int(a),int(b))))]:
                        if neighbor in coplanar and neighbor not in candidates:
                            candidates.add(neighbor);pending.append(neighbor)
            kept=triangles[[k not in candidates for k in range(len(triangles))]]
            counts=Counter()
            for k,t in enumerate(welded):
                if k in candidates:continue
                for a,b in zip(t,np.roll(t,-1)):counts[tuple(sorted((int(a),int(b))))]+=1
            if any(v!=2 for v in counts.values()):raise ValueError('Flap removal does not produce a closed manifold')
            acc=doc['accessors'][index];view=doc['bufferViews'][acc['bufferView']]
            component={5123:'H',5125:'I'}[acc['componentType']]
            offset=view.get('byteOffset',0)+acc.get('byteOffset',0)
            old_bytes=acc['count']*struct.calcsize(component)
            packed=struct.pack('<'+component*kept.size,*kept.flatten().tolist())
            binary[offset:offset+old_bytes]=packed+b'\0'*(old_bytes-len(packed))
            acc['count']=kept.size
            if 'min' in acc:acc['min']=[int(kept.min())]
            if 'max' in acc:acc['max']=[int(kept.max())]
            removed+=len(candidates)
    # Canonical JSON also makes the two-stage animal build byte-identical to
    # repairing an existing animation library in place.
    write(path,doc,bytes(binary))
    return removed

if __name__=='__main__':
    import sys
    for path in sys.argv[1:]:print(path,'INTERNAL_FACES_REMOVED',repair_internal_flaps(path))
