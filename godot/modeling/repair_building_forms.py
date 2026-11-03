"""Apply the confirmed roof finish and structural support corrections to cached shells.

The cached shell JSON remains each building's rebuild authority. Dimensions live
in building-form-repairs.json. This tool edits only named finish, chimney and coat
parts and its own ramp_support_* parts. Masonry, facade placements and existing
vehicle paths remain unchanged. Repeated runs produce identical cached sources.
"""
import copy
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent


def box(bounds, slot, shear=0.0, origin_z=0.0):
    lo, hi = zip(*bounds)
    verts = [(x, y + shear * (z-origin_z), z)
             for x in bounds[0] for y in bounds[1] for z in bounds[2]]
    # Outward-wound triangles; coordinates are duplicated to keep hard edges.
    faces = [(0,1,3,2), (4,6,7,5), (0,4,5,1),
             (2,3,7,6), (0,2,6,4), (1,5,7,3)]
    pos, norms = [], []
    for face in faces:
        for ids in [(face[0],face[1],face[2]), (face[0],face[2],face[3])]:
            a,b,c = [verts[i] for i in ids]
            u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
            n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            length=math.sqrt(sum(x*x for x in n))
            assert length > 0, bounds
            n=[x/length for x in n]
            for p in [a,b,c]: pos.extend(p);norms.extend(n)
    return {'positions':pos,'normals':norms,'indices':list(range(len(pos)//3)), 'slot':slot}


def bounds(part):
    values=[v for q in part['primitives'] for v in q['positions']]
    return [(min(values[a::3]),max(values[a::3])) for a in range(3)]


def coping_ring(bounds, width, slot):
    x,y,z=bounds
    outer=[(x[0],z[0]),(x[1],z[0]),(x[1],z[1]),(x[0],z[1])]
    inner=[(x[0]+width,z[0]+width),(x[1]-width,z[0]+width),
           (x[1]-width,z[1]-width),(x[0]+width,z[1]-width)]
    pos,norms=[],[]
    def point(p,height): return (p[0],height,p[1])
    def quad(points):
        for ids in [(0,1,2),(0,2,3)]:
            a,b,c=[points[i] for i in ids]
            u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
            n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            length=math.sqrt(sum(t*t for t in n));n=[t/length for t in n]
            for p in [a,b,c]:pos.extend(p);norms.extend(n)
    for i in range(4):
        j=(i+1)%4
        quad([point(outer[i],y[1]),point(inner[i],y[1]),point(inner[j],y[1]),point(outer[j],y[1])])
        quad([point(outer[i],y[0]),point(outer[j],y[0]),point(inner[j],y[0]),point(inner[i],y[0])])
        quad([point(outer[i],y[0]),point(outer[i],y[1]),point(outer[j],y[1]),point(outer[j],y[0])])
        quad([point(inner[i],y[0]),point(inner[j],y[0]),point(inner[j],y[1]),point(inner[i],y[1])])
    return {'positions':pos,'normals':norms,'indices':list(range(len(pos)//3)),'slot':slot}


def polygon_prism(points, z_range, slot):
    """Extrude one counterclockwise, simple silhouette with closed hard edges."""
    def turn(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    remaining=list(range(len(points)));triangles=[]
    while len(remaining)>3:
        for k,b in enumerate(remaining):
            a,c=remaining[k-1],remaining[(k+1)%len(remaining)]
            if turn(points[a],points[b],points[c])<=1e-12:continue
            if any(all(turn(points[i],points[j],points[t])>=-1e-12 for i,j in [(a,b),(b,c),(c,a)])
                   for t in remaining if t not in [a,b,c]):continue
            triangles.append((a,b,c));remaining.pop(k);break
        else:raise ValueError('Invalid garment silhouette')
    triangles.append(tuple(remaining))
    faces=[]
    for a,b,c in triangles:
        faces.append([(points[t][0],points[t][1],z_range[1]) for t in [a,b,c]])
        faces.append([(points[t][0],points[t][1],z_range[0]) for t in [c,b,a]])
    for i,a in enumerate(points):
        b=points[(i+1)%len(points)]
        q=[(a[0],a[1],z_range[0]),(b[0],b[1],z_range[0]),(b[0],b[1],z_range[1]),(a[0],a[1],z_range[1])]
        faces += [[q[t] for t in [0,1,2]],[q[t] for t in [0,2,3]]]
    pos,norms=[],[]
    for a,b,c in faces:
        u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
        n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        length=math.sqrt(sum(t*t for t in n));assert length>0
        n=[t/length for t in n]
        for p in [a,b,c]:pos.extend(p);norms.extend(n)
    return {'positions':pos,'normals':norms,'indices':list(range(len(pos)//3)),'slot':slot}


def hanger_segment(a,b,width,centre_z,slot):
    dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
    offset=(-dy*width/length/2,dx*width/length/2)
    points=[(a[0]+offset[0],a[1]+offset[1]),(a[0]-offset[0],a[1]-offset[1]),
            (b[0]-offset[0],b[1]-offset[1]),(b[0]+offset[0],b[1]+offset[1])]
    return polygon_prism(points,[centre_z-width/2,centre_z+width/2],slot)


def apply(name, config):
    path=HERE/'shells'/f'{name}.json'
    old=json.loads(path.read_text())
    new=copy.deepcopy(old)
    by_name={part['name']:part for part in new['parts']}
    changed=set()
    if 'coping' in config:
        c=config['coping'];x,y,z=c['bounds'];width=c['ring_width']
        prims=[coping_ring(c['bounds'],width,c['slot'])]
        if 'deck_slot' in c:
            top=c['deck_finish_top']
            prims.append(box([[x[0]+width,x[1]-width],
                             [top-c['deck_finish_thickness'],top],
                             [z[0]+width,z[1]-width]],c['deck_slot']))
        by_name[c['part']]['primitives']=prims
        changed.add(c['part'])
    for part_name,bottom in config.get('chimney_bottoms',{}).items():
        part=by_name[part_name];b=bounds(part);b[1]=(bottom,b[1][1])
        slot=part['primitives'][0]['slot']
        part['primitives']=[box(b,slot)]
        changed.add(part_name)
    if 'coats' in config:
        c=config['coats']
        for part_name,centre_x in c['parts'].items():
            points=[(centre_x+x*c['width'],c['bottom']+y*c['height']) for x,y in c['profile']]
            prims=[polygon_prism(points,[c['centre_z']-c['depth']/2,c['centre_z']+c['depth']/2],c['slot'])]
            hanger=[(centre_x,c['hanger_top']),(centre_x-c['hanger_half_width'],c['hanger_bottom']),
                    (centre_x+c['hanger_half_width'],c['hanger_bottom'])]
            prims += [hanger_segment(hanger[i],hanger[(i+1)%3],c['hanger_rod_width'],c['centre_z'],c['hanger_slot']) for i in range(3)]
            by_name[part_name]['primitives']=prims;changed.add(part_name)
    if 'ramp_supports' in config:
        c=config['ramp_supports'];slot=c['slot'];cw=c['column_width'];bw=c['beam_width'];bd=c['beam_depth']
        new['parts']=[p for p in new['parts'] if not p['name'].startswith('ramp_support_')]
        def add(label,b,**kw):
            new['parts'].append({'name':'ramp_support_'+label,'primitives':[box(b,slot,**kw)]})
        for x in c['landing_column_x']:
            for z in c['landing_column_z']:
                add(f'landing_column_{x}_{z}',[[x-cw/2,x+cw/2],[0,c['landing_column_top']],[z-cw/2,z+cw/2]])
        for level in c['landing_levels']:
            for i,zpair in enumerate(c['landing_z']):
                z=c['landing_column_z'][i]
                add(f'landing_crossbeam_{level}_{i}',[c['landing_bounds_x'],[level-bd,level],[z-bw/2,z+bw/2]])
                for x in [c['landing_column_x'][0],c['landing_column_x'][-1]]:
                    add(f'landing_edgebeam_{level}_{i}_{x}',[[x-bw/2,x+bw/2],[level-bd,level],zpair])
        ramps={}
        for r in c['ramp_pairs']:
            part=by_name[r['part']]
            ps=part['primitives'][0]['positions'];pts=[ps[i:i+3] for i in range(0,len(ps),3)]
            zlo,zhi=bounds(part)[2]
            bottom_lo=min(p[1] for p in pts if abs(p[2]-zlo)<1e-6)
            bottom_hi=min(p[1] for p in pts if abs(p[2]-zhi)<1e-6)
            slope=(bottom_hi-bottom_lo)/(zhi-zlo)
            ramps[r['part']]=(bottom_lo,slope,zlo)
            start=max(zlo,r.get('beam_z_min',zlo))
            top=bottom_lo+slope*(start-zlo)
            for x in r['edges']:
                add(f'edgebeam_{r["part"]}_{x}',[[x-bw/2,x+bw/2],[top-bd,top],[start,zhi]],shear=slope,origin_z=start)
        # The shared divider supports the first/top ramp; the outside row supports
        # the middle return ramp. Column tops meet the corresponding underside.
        for x,part_name in zip(c['ramp_column_x'],['car_ramp_2','car_ramp_1']):
            bottom,slope,zlo=ramps[part_name]
            for z in c['ramp_column_z']:
                top=bottom+slope*(z-zlo)
                add(f'ramp_column_{x}_{z}',[[x-cw/2,x+cw/2],[0,top],[z-cw/2,z+cw/2]])
    old_other=[p for p in old['parts'] if p['name'] not in changed and not p['name'].startswith('ramp_support_')]
    new_other=[p for p in new['parts'] if p['name'] not in changed and not p['name'].startswith('ramp_support_')]
    assert old_other == new_other, 'Unrelated shell geometry changed'
    assert old['slots']==new['slots']
    text=json.dumps(new,separators=(',',':'))+'\n'
    path.write_text(text,encoding='utf-8')
    print(name,hashlib.sha256(path.read_bytes()).hexdigest())


if __name__=='__main__':
    configs=json.loads((HERE/'building-form-repairs.json').read_text())
    for name,config in configs.items(): apply(name,config)
