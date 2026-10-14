"""Complete extracted window leaves with closed casing, sash rims and real handles.

Use the actual pane boundary, including arches and angled facade panels. Existing
complete surrounds remain intact. Dimensions live in window-detail-params.json.
"""
import json
from collections import Counter
from copy import deepcopy
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon, box as rectangle
from shapely.geometry.polygon import orient

PARAMS = json.loads(Path(__file__).with_name('window-detail-params.json').read_text())
INSTALLATION = json.loads(Path(__file__).with_name('window-installation.json').read_text())
STRUCTURES = json.loads(Path(__file__).with_name('window-structures.json').read_text())

def primitive(vertices, faces, slot):
    positions=[]; normals=[]; indices=[]
    for face in faces:
        pts=np.array([vertices[i] for i in face])
        normal=np.cross(pts[1]-pts[0],pts[2]-pts[0])
        normal/=np.linalg.norm(normal)
        start=len(positions)//3
        for point in pts:
            positions.extend(point.tolist()); normals.extend(normal.tolist())
        for k in range(1,len(face)-1): indices.extend([start,start+k,start+k+1])
    return dict(positions=positions,normals=normals,indices=indices,slot=slot)

def outline(primitives):
    points=[]; ids={}; edges=Counter()
    front_areas={}
    for prim in primitives:
        if prim['slot']!='window':continue
        verts=np.array(prim['positions']).reshape(-1,3)
        normals=np.array(prim['normals']).reshape(-1,3)
        for tri in np.array(prim['indices']).reshape(-1,3):
            normal=normals[tri].mean(0)
            if normal[2]<.4:continue
            key=tuple(np.round(normal,4))
            front_areas[key]=front_areas.get(key,0)+np.linalg.norm(np.cross(verts[tri[1]]-verts[tri[0]],verts[tri[2]]-verts[tri[0]]))
    front=np.array(max(front_areas,key=front_areas.get));front/=np.linalg.norm(front)
    for prim in primitives:
        if prim['slot']!='window': continue
        verts=np.array(prim['positions']).reshape(-1,3)
        normals=np.array(prim['normals']).reshape(-1,3)
        index=np.array(prim['indices']).reshape(-1,3)
        for tri in index:
            if np.dot(normals[tri].mean(0),front) < .999: continue
            keys=[]
            for v in verts[tri]:
                key=tuple(np.round(v,4))
                if key not in ids: ids[key]=len(points);points.append(v)
                keys.append(ids[key])
            for a,b in zip(keys,keys[1:]+keys[:1]): edges[tuple(sorted((a,b)))]+=1
    boundary=[e for e,count in edges.items() if count==1]
    adjacency={}
    for a,b in boundary:
        adjacency.setdefault(a,[]).append(b);adjacency.setdefault(b,[]).append(a)
    if not adjacency or any(len(n)!=2 for n in adjacency.values()):
        raise ValueError('Window pane has no unambiguous closed front outline')
    start=min(adjacency); current=start; previous=None; loop=[]
    while True:
        loop.append(points[current])
        current,previous=next(n for n in sorted(adjacency[current]) if n!=previous),current
        if current==start: break
        if len(loop)>len(adjacency): raise ValueError('Broken window outline')
    if len(loop)!=len(adjacency): raise ValueError('Multiple independent pane outlines')
    loop=np.array(loop)
    area=sum(np.cross(a[:2],b[:2]) for a,b in zip(loop,np.roll(loop,-1,axis=0)))
    return loop if area>0 else loop[::-1]

def inset(loop,width):
    inner=loop.copy()
    for k,point in enumerate(loop):
        incoming=point[:2]-loop[k-1,:2]; incoming/=np.linalg.norm(incoming)
        outgoing=loop[(k+1)%len(loop),:2]-point[:2]; outgoing/=np.linalg.norm(outgoing)
        a=np.array([-incoming[1],incoming[0]]);b=np.array([-outgoing[1],outgoing[0]])
        miter=a+b; denominator=np.dot(miter,a)
        if denominator<.1: raise ValueError('Window outline is too sharp for a sash')
        inner[k,:2]+=width*miter/denominator
    plane=np.linalg.lstsq(np.c_[loop[:,:2],np.ones(len(loop))],loop[:,2],rcond=None)[0]
    assert np.max(np.abs(np.c_[loop[:,:2],np.ones(len(loop))]@plane-loop[:,2]))<.0005
    inner[:,2]=np.c_[inner[:,:2],np.ones(len(inner))]@plane
    return inner

def surround(loop,width,depth,lift,slot):
    # Inward mitered border preserves the footprint and ground origin.
    inner=inset(loop,width)
    plane=np.linalg.lstsq(np.c_[loop[:,:2],np.ones(len(loop))],loop[:,2],rcond=None)[0]
    normal=np.array([-plane[0],-plane[1],1.]);normal/=np.linalg.norm(normal)
    n=len(loop); vertices=[]
    for polygon,zoffset in [(loop,lift),(inner,lift),(loop,lift-depth),(inner,lift-depth)]:
        for p in polygon: vertices.append(p+normal*zoffset)
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),
                      (2*n+i,2*n+j,j,i),(n+i,n+j,3*n+j,3*n+i)])
    return primitive(vertices,faces,slot)

def box(center,size,slot):
    vertices=[np.array(center)+np.array(size)*np.array([x,y,z])/2
              for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                            (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return primitive(vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],slot)

def inner_loop(points, width):
    result = np.array(points, dtype=float).copy()
    for i, point in enumerate(points):
        incoming = point - points[i-1]
        outgoing = points[(i+1) % len(points)] - point
        incoming /= np.linalg.norm(incoming)
        outgoing /= np.linalg.norm(outgoing)
        a = np.array([-incoming[1], incoming[0]])
        b = np.array([-outgoing[1], outgoing[0]])
        result[i] += width * (a+b) / np.dot(a+b, a)
    polygon = Polygon(result)
    if not polygon.is_valid or polygon.area <= 0 or not Polygon(points).covers(polygon):
        raise ValueError('Window border does not fit its pane outline')
    return result


def polygon_points(polygon):
    assert polygon.geom_type == 'Polygon' and not polygon.interiors
    assert polygon.is_valid and polygon.area > PARAMS['geometry_area_epsilon']
    return np.array(orient(polygon.simplify(PARAMS['geometry_epsilon']), sign=1).exterior.coords[:-1])


def complete(recipe, name):
    recipe = deepcopy(recipe)
    installation = INSTALLATION[name]
    structure = STRUCTURES[name]
    original_sash = next(p for p in recipe['parts'] if p.get('moving'))
    raw_loop = outline(original_sash['primitives'])
    old_low, old_high = raw_loop[:,1].min(), raw_loop[:,1].max()
    low = installation.get('pane_bottom', old_low)
    high = installation.get('pane_top', old_high)
    if (low, high) != (old_low, old_high):
        assert high > low
        for part in recipe['parts']:
            sill = structure['parts'][part['name']] == 'window_sill'
            for prim in part['primitives']:
                vertices = np.array(prim['positions']).reshape(-1,3)
                vertices[:,1] = vertices[:,1] + low-old_low if sill else low+(vertices[:,1]-old_low)/(old_high-old_low)*(high-low)
                prim['positions'] = vertices.flatten().tolist()
    raw_loop = outline(original_sash['primitives'])
    plane = np.linalg.lstsq(np.c_[raw_loop[:,:2], np.ones(len(raw_loop))], raw_loop[:,2], rcond=None)[0]
    normal = np.array([-plane[0], -plane[1], 1.]); normal /= np.linalg.norm(normal)
    right = np.cross([0,1,0], normal); right /= np.linalg.norm(right)
    up = np.cross(normal, right)
    assert abs(up[1]-1) < PARAMS['geometry_epsilon'], 'Window pane must have a vertical up direction'
    # Blind masonry caps meet the original pane back. Keep the new leaf's
    # slightly thicker rim clear of that cap without moving it out of the recess.
    plane_d = float(raw_loop[0] @ normal)+PARAMS['pane_back_clearance']
    outer = raw_loop @ np.array([right, up]).T
    if Polygon(outer).exterior.is_ccw is False: outer = outer[::-1]
    lo, hi = outer.min(0), outer.max(0)
    short_edge = float(min(hi-lo))
    frame_width = float(np.clip(short_edge*PARAMS['frame_ratio'], PARAMS['frame_min'], PARAMS['frame_max']))
    sash_width = float(np.clip(short_edge*PARAMS['sash_ratio'], PARAMS['sash_min'], PARAMS['sash_max']))
    opening = Polygon(inner_loop(outer, frame_width))
    old_vertices = np.concatenate([np.array(p['positions']).reshape(-1,3) for p in original_sash['primitives']])
    glass_depth = float(np.ptp(old_vertices @ normal))
    parts = []; joints = []; grips = []

    def world(uv, d):
        return np.array(uv) @ np.array([right, up]) + normal*d

    def prism(poly, front, depth, slot):
        points = polygon_points(poly); n = len(points)
        vertices = [*world(points, front), *world(points, front-depth)]
        faces = [tuple(range(n)), tuple(range(2*n-1,n-1,-1))]
        faces += [(i,n+i,n+(i+1)%n,(i+1)%n) for i in range(n)]
        return primitive(vertices, faces, slot)

    def ring(points, width, front, depth, slot):
        inner = inner_loop(points, width); n = len(points)
        vertices = []
        for polygon, d in ((points,front),(inner,front),(points,front-depth),(inner,front-depth)):
            vertices.extend(world(polygon,d))
        faces = []
        for i in range(n):
            j=(i+1)%n
            faces += [(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),
                      (2*n+i,2*n+j,j,i),(n+i,n+j,3*n+j,3*n+i)]
        return primitive(vertices,faces,slot)

    def add(part_name, primitives, joint=None):
        assert primitives
        parts.append(dict(name=part_name, primitives=primitives, **({'joint':joint} if joint else {})))

    def grid_geometry(part):
        points = np.concatenate([np.array(p['positions']).reshape(-1,3) for p in part['primitives']])
        uv = points @ np.array([right,up]).T
        return uv.min(0), uv.max(0), part['primitives'][0]['slot']

    vertical=[]; horizontal=[]
    for part in recipe['parts']:
        role = structure['parts'][part['name']]
        if role in ('glass','mullion_vertical','mullion_horizontal'):
            if role != 'glass':
                a,b,slot=grid_geometry(part); axis=0 if role=='mullion_vertical' else 1
                entry=(float((a[axis]+b[axis])/2), min(float(b[axis]-a[axis]),PARAMS['mullion_max']),slot)
                (vertical if axis==0 else horizontal).append(entry)
        else:
            assert role.startswith('structural_frame') or role=='window_sill', (name,part['name'],role)
            part.pop('moving',None)
            parts.append(part)
    add('FixedFrame',[ring(outer,frame_width,plane_d+PARAMS['frame_lift'],PARAMS['frame_depth'],'trim')])
    for fraction in structure.get('vertical_fractions',[]):
        vertical.append((float(lo[0]+fraction*(hi[0]-lo[0])), PARAMS['mullion_width'],'metal_dark'))
    family=structure['family']; centre=float((lo[0]+hi[0])/2)
    fixed_region=None; moving_region=opening; dividers_y=[]
    if family=='fanlight':
        # Straight vertical jambs end at the start of the original arch.
        spring=min(p[1] for p in outer if abs(p[0]-lo[0])<PARAMS['geometry_epsilon'] and p[1]>lo[1]+PARAMS['geometry_epsilon'])
        split=spring
        dividers_y=[(split,PARAMS['mullion_width'],'metal_dark')]
        moving_region=opening.intersection(rectangle(lo[0],lo[1],hi[0],split-PARAMS['mullion_width']/2))
        fixed_region=opening.intersection(rectangle(lo[0],split+PARAMS['mullion_width']/2,hi[0],hi[1]))
    elif family=='display_vent':
        split=float(lo[1]+structure['vent_fraction']*(hi[1]-lo[1]))
        dividers_y=[(split,PARAMS['mullion_width'],'metal_dark')]
        fixed_region=opening.intersection(rectangle(lo[0],lo[1],hi[0],split-PARAMS['mullion_width']/2))
        moving_region=opening.intersection(rectangle(lo[0],split+PARAMS['mullion_width']/2,hi[0],hi[1]))
        # Main display glazing keeps its existing broad, clear silhouette.
        vertical=[]
    elif family in ('awning','mixed_transom'):
        dividers_y=horizontal; horizontal=[]
    elif family not in ('single','casements','centre_pair'):
        raise ValueError('Unknown window family: '+family)
    if fixed_region is not None:
        assert not fixed_region.is_empty
        add('FixedGlass',[prism(fixed_region,plane_d,glass_depth,'window')])
    for i,(value,width,slot) in enumerate(dividers_y):
        poly=opening.intersection(rectangle(lo[0],value-width/2,hi[0],value+width/2))
        add('FixedTransom'+str(i+1),[prism(poly,plane_d+PARAMS['sash_lift'],PARAMS['sash_depth'],slot)])
    for i,(value,width,slot) in enumerate(vertical):
        poly=moving_region.intersection(rectangle(value-width/2,lo[1],value+width/2,hi[1]))
        add('FixedMullion'+str(i+1),[prism(poly,plane_d+PARAMS['sash_lift'],PARAMS['sash_depth'],slot)])
    x_intervals=[]; start=float(lo[0])
    for value,width,slot in sorted(vertical):
        x_intervals.append((start,value-width/2)); start=value+width/2
    x_intervals.append((start,float(hi[0])))
    y_intervals=[]; start=float(lo[1])
    if family in ('awning','mixed_transom'):
        for value,width,slot in sorted(dividers_y):
            y_intervals.append((start,value-width/2)); start=value+width/2
    y_intervals.append((start,float(hi[1])))
    for bottom,top in y_intervals:
        for left,right_edge in x_intervals:
            cell=moving_region.intersection(rectangle(left,bottom,right_edge,top))
            if cell.is_empty: continue
            leaf_points=inner_loop(polygon_points(cell),PARAMS['sash_clearance'])
            leaf=Polygon(leaf_points); glass=Polygon(inner_loop(leaf_points,sash_width))
            a,b=leaf_points.min(0),leaf_points.max(0)
            number=len(joints)+1; joint='SashHinge' if number==1 else 'SashHinge_'+str(number)
            awning=family in ('awning','display_vent') or (family=='mixed_transom' and bottom>lo[1]+PARAMS['geometry_epsilon'])
            if awning:
                pivot_uv=[float((a[0]+b[0])/2),float(b[1])]
                axis=right; end=-PARAMS['awning_degrees']
                handle_uv=[float((a[0]+b[0])/2),float(a[1]+sash_width/2)]
            else:
                centred=family=='centre_pair'
                hinge_right=(centred and b[0]<centre) or (not centred and len(x_intervals)==2 and left>centre)
                pivot_uv=[float(b[0] if hinge_right else a[0]),float(a[1])]
                axis=up; end=PARAMS['casement_degrees']*(1 if hinge_right else -1)
                handle_uv=[float(a[0]+sash_width/2 if hinge_right else b[0]-sash_width/2),float((a[1]+b[1])/2)]
            pivot=world(pivot_uv,plane_d+PARAMS['sash_lift'])
            limit=installation.get('joint_limits',{}).get(joint,abs(end))
            assert 0 < limit <= abs(end), (name,joint,'Invalid physical opening limit')
            end=float(np.sign(end)*limit)
            joints.append(dict(name=joint,position=pivot.tolist(),axis=axis.tolist(),degrees=[0.0,end]))
            add('SashRim'+str(number),[ring(leaf_points,sash_width,plane_d+PARAMS['sash_lift'],PARAMS['sash_depth'],'metal')],joint)
            # Preserve crossbars on the leaf and cut the glazing around them.
            for j,(value,width,slot) in enumerate(horizontal):
                poly=glass.intersection(rectangle(lo[0],value-width/2,hi[0],value+width/2))
                if not poly.is_empty:
                    add('SashCrossbar'+str(number)+'_'+str(j+1),[prism(poly,plane_d+PARAMS['sash_lift'],PARAMS['sash_depth'],slot)],joint)
                    glass=glass.difference(poly)
            panes=list(glass.geoms) if glass.geom_type=='MultiPolygon' else [glass]
            add('Sash'+str(number),[prism(poly,plane_d,glass_depth,'window') for poly in panes],joint)
            handle_d=plane_d+PARAMS['sash_lift']+PARAMS['handle_depth']/2
            handle_center=world(handle_uv,handle_d)
            size=[PARAMS['handle_height'],PARAMS['handle_width'],PARAMS['handle_depth']] if awning else [PARAMS['handle_width'],PARAMS['handle_height'],PARAMS['handle_depth']]
            handle=box([0,0,0],size,'metal_dark')
            basis=np.array([right,up,normal])
            handle['positions']=(np.array(handle['positions']).reshape(-1,3)@basis+handle_center).flatten().tolist()
            handle['normals']=(np.array(handle['normals']).reshape(-1,3)@basis).flatten().tolist()
            add('SashHandle'+str(number),[handle],joint)
            grips.append(world(handle_uv,handle_d+PARAMS['handle_depth']/2)-pivot)
    assert joints, 'Window has no operable leaf: '+name
    origin_lift=installation.get('origin_lift',0.0)
    if origin_lift:
        for part in parts:
            for prim in part['primitives']:
                vertices=np.array(prim['positions']).reshape(-1,3); vertices[:,1]-=origin_lift
                prim['positions']=vertices.flatten().tolist()
        for joint in joints:joint['position'][1]-=origin_lift
    recipe['parts']=parts; recipe['joints']=joints
    recipe['hinge']=joints[0]['position']
    recipe['markers']={'grip_sash':grips[0].tolist()}
    recipe['slots']=sorted({p['slot'] for part in parts for p in part['primitives']})
    return recipe
