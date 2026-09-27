"""Standalone original model. Python 3 + Shapely 2.1+. Metres, Y up, front +Z."""
NAME = 'bike_shed'
# Named dimensions / explicit placement tables; all editable here.
D = {'round_segments': 24,
 'recess': 0.48,
 'panel_thickness': 0.04,
 'floor_height': 3.2,
 'parapet_thickness': 0.22,
 'parapet_height': 0.7,
 'coping_height': 0.1,
 'roof_slab': 0.18,
 'roof_door_base': 0.05,
 'door_width': 1.1,
 'door_height': 2.3,
 'door_threshold': 0.04,
 'chimney_size': [0.65, 1.2, 0.65],
 'vent_size': [1.2, 0.65, 0.85],
 'vent_depth_ratio': 0.32,
 'step_rise': 0.15,
 'step_run': 0.3,
 'entry_width': 2.2,
 'entry_landing': 0.9,
 'canopy_thickness': 0.16,
 'entry_canopy_depth': 1.5,
 'canopy_headroom': 0.3,
 'balcony_slab': 0.14,
 'rail_thickness': 0.12,
 'rail_height': 1.0,
 'balcony_spandrel': 0.65,
 'balcony_edge': 0.3,
 'balcony_window_margin': 0.15,
 'balcony_glazing_recess': 0.45,
 'ground_window_sill': 0.8,
 'ground_window_height': 1.7,
 'sign_border': 0.22,
 'sign_depth': 0.18,
 'column_width': 0.45,
 'column_setback': 0.6,
 'rack_radius': 0.05,
 'turret_cap_extra': 0.25,
 'turret_cap_height': 0.3,
 'booth_eave': 0.22,
 'turret_segments': 12,
 'turret_window_width': 0.85,
 'turret_window_height': 1.6,
 'turret_sill': 0.85,
 'porch_glazing_sill': 0.2,
 'porch_glazing_top_margin': 0.2,
 'porch_mullion': 0.2}
P = {'kind': 'shed',
 'width': 8.0,
 'depth': 3.2,
 'height': 2.4,
 'post_width': 0.14,
 'post_x': [-3.8, 0, 3.8],
 'roof_rise': 0.45,
 'rack_x': [-3, -2, -1, 0, 1, 2, 3],
 'rack_gap': 0.5,
 'rack_height': 0.65,
 'rack_radius': 0.045}

from pathlib import Path
import json
import math
import struct
from collections import defaultdict


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def unit(a):
    n = math.sqrt(sum(v*v for v in a))
    return tuple(v/n for v in a)


class Model:
    def __init__(self):
        self.parts = defaultdict(lambda: defaultdict(list))

    def tri(self, mesh, slot, a, b, c):
        n = cross(sub(b, a), sub(c, a))
        if sum(v*v for v in n) < 1e-18:
            return
        self.parts[mesh][slot].append((a, b, c))

    def quad(self, mesh, slot, a, b, c, d):
        self.tri(mesh, slot, a, b, c)
        self.tri(mesh, slot, a, c, d)

    def tube(self, name, a, b, radius, segments):
        axis = unit(sub(b, a))
        u = unit(cross(axis, (1, 0, 0) if abs(axis[0]) < .9 else (0, 1, 0)))
        v = cross(axis, u)
        rings = [[tuple(p[k] + radius*(u[k]*math.cos(i*2*math.pi/segments) + v[k]*math.sin(i*2*math.pi/segments))
                        for k in range(3)) for i in range(segments)] for p in (a, b)]
        for i in range(segments):
            j = (i+1) % segments
            self.quad(name, 'metal_dark', rings[0][i], rings[0][j], rings[1][j], rings[1][i])
            self.tri(name, 'metal_dark', a, rings[0][j], rings[0][i])
            self.tri(name, 'metal_dark', b, rings[1][i], rings[1][j])

    def export(self, path):
        binary = bytearray()
        views, accessors, meshes, nodes = [], [], [], []
        slots = sorted({s for group in self.parts.values() for s in group})
        def data(values, kind, component, target, bounds=False):
            flat = [v for row in values for v in row] if kind == 'VEC3' else values
            fmt = 'f' if component == 5126 else 'I'
            binary.extend(b'\0' * (-len(binary) % 4))
            start = len(binary)
            binary.extend(struct.pack('<'+fmt*len(flat), *flat))
            views.append(dict(buffer=0, byteOffset=start, byteLength=len(binary)-start, target=target))
            a = dict(bufferView=len(views)-1, componentType=component, count=len(values), type=kind)
            if bounds:
                a.update(min=[min(v[k] for v in values) for k in range(3)], max=[max(v[k] for v in values) for k in range(3)])
            accessors.append(a)
            return len(accessors)-1
        for mesh, groups in sorted(self.parts.items()):
            primitives = []
            for slot, tris in sorted(groups.items()):
                vertices = [p for tri in tris for p in tri]
                normals = [unit(cross(sub(t[1], t[0]), sub(t[2], t[0]))) for t in tris for _ in t]
                p = data(vertices, 'VEC3', 5126, 34962, True)
                n = data(normals, 'VEC3', 5126, 34962)
                i = data(list(range(len(vertices))), 'SCALAR', 5125, 34963)
                primitives.append(dict(attributes=dict(POSITION=p, NORMAL=n), indices=i, material=slots.index(slot), mode=4))
            meshes.append(dict(name=mesh, primitives=primitives))
            nodes.append(dict(name=mesh, mesh=len(meshes)-1))
        doc = dict(asset=dict(version='2.0', generator='news-game deterministic architecture builder'), scene=0,
                   scenes=[dict(nodes=list(range(len(nodes))))], nodes=nodes, meshes=meshes,
                   materials=[dict(name=s, pbrMetallicRoughness=dict(baseColorFactor=[1,1,1,1], metallicFactor=0, roughnessFactor=1)) for s in slots],
                   buffers=[dict(byteLength=len(binary))], bufferViews=views, accessors=accessors)
        header = json.dumps(doc, separators=(',', ':'), sort_keys=True).encode()
        header += b' ' * (-len(header) % 4)
        blob = struct.pack('<4sII', b'glTF', 2, 28+len(header)+len(binary))
        blob += struct.pack('<I4s', len(header), b'JSON') + header
        blob += struct.pack('<I4s', len(binary), b'BIN\0') + binary
        Path(path).write_bytes(blob)


"""Batch-six architecture. Copied into each standalone builder by assemble.py.
All design dimensions belong to the header dictionaries, not this geometry code.
"""
import shapely
from shapely.geometry import Polygon, box as polygon_box


class Architecture(Model):
    def __init__(self):
        super().__init__()
        self.openings=[]
        self.interactions=[]

    def box(self,name,size,center,slot):
        x,y,z=center;w,h,d=size
        v=[(x+sx*w/2,y+sy*h/2,z+sz*d/2) for sx,sy,sz in
           [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        for ids in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)]:
            self.quad(name,slot,*[v[i] for i in ids])

    def prism(self,name,outline,depth,center,slot):
        # CCW XY outline, extruded along Z, with triangulated closed caps.
        poly=shapely.orient_polygons(Polygon(outline));outline=list(poly.exterior.coords)[:-1]
        def at(p,z):return (p[0]+center[0],p[1]+center[1],z+center[2])
        for tri in shapely.constrained_delaunay_triangles(poly).geoms:
            pts=list(shapely.orient_polygons(tri).exterior.coords)[:3]
            self.tri(name,slot,*[at(p,depth/2) for p in pts])
            self.tri(name,slot,*[at(p,-depth/2) for p in pts[::-1]])
        for a,b in zip(outline,outline[1:]+outline[:1]):
            self.quad(name,slot,at(a,-depth/2),at(b,-depth/2),at(b,depth/2),at(a,depth/2))

    def cylinder(self,name,r,h,center,slot):
        n=D['round_segments'];x,y,z=center
        lo=[(x+r*math.cos(i*2*math.pi/n),y-h/2,z+r*math.sin(i*2*math.pi/n)) for i in range(n)]
        hi=[(a,y+h/2,c) for a,_,c in lo]
        for i in range(n):
            j=(i+1)%n
            self.quad(name,slot,lo[i],hi[i],hi[j],lo[j])
            self.tri(name,slot,(x,y-h/2,z),lo[i],lo[j])
            self.tri(name,slot,(x,y+h/2,z),hi[j],hi[i])

    def block(self,name,w,d,h,center,slot,holes=None):
        # One closed masonry shell; every opening is a blind recess with closed
        # jambs, sill, head and back. No boolean cuts, internal cavities or decals.
        cx,base,cz=center;holes=holes or {}
        transforms={
            'front':(w,lambda u,y,q:(cx+u,base+y,cz+d/2-q)),
            'right':(d,lambda u,y,q:(cx+w/2-q,base+y,cz-u)),
            'back':(w,lambda u,y,q:(cx-u,base+y,cz-d/2+q)),
            'left':(d,lambda u,y,q:(cx-w/2+q,base+y,cz+u))}
        for side,(span,xf) in transforms.items():
            apertures=holes.get(side,[])
            polygons=[polygon_box(o['u']-o['w']/2,o['y'],o['u']+o['w']/2,o['y']+o['h']) for o in apertures]
            face=Polygon([(-span/2,0),(span/2,0),(span/2,h),(-span/2,h)],holes=[list(p.exterior.coords) for p in polygons])
            if not face.is_valid:raise ValueError(f'{name}/{side}: overlapping or out-of-wall openings')
            for t in shapely.constrained_delaunay_triangles(face).geoms:
                pts=list(shapely.orient_polygons(t).exterior.coords)[:3]
                self.tri(name,slot,*[xf(u,y,0) for u,y in pts])
            for i,(o,poly) in enumerate(zip(apertures,polygons)):
                ring=list(shapely.orient_polygons(poly).exterior.coords)[:-1]
                depth=o.get('depth',D['recess'])
                for a,b in zip(ring,ring[1:]+ring[:1]):
                    self.quad(name,slot,xf(*a,0),xf(*a,depth),xf(*b,depth),xf(*b,0))
                self.quad(name,slot,*[xf(*p,depth) for p in ring])
                panel=o.get('slot','window')
                if panel:
                    t=D['panel_thickness'];mid=xf(o['u'],o['y']+o['h']/2,depth-t/2)
                    size=(o['w'],o['h'],t) if side in ['front','back'] else (t,o['h'],o['w'])
                    self.box(f'{name}_{side}_pane_{i}',size,mid,panel)
                self.openings.append(dict(body=name,side=side,width=o['w'],height=o['h'],recess=depth,slot=panel,center=xf(o['u'],o['y']+o['h']/2,depth),facade_area=span*h))
        self.quad(name,slot,(cx-w/2,base,cz-d/2),(cx+w/2,base,cz-d/2),(cx+w/2,base,cz+d/2),(cx-w/2,base,cz+d/2))
        self.quad(name,slot,(cx-w/2,base+h,cz+d/2),(cx+w/2,base+h,cz+d/2),(cx+w/2,base+h,cz-d/2),(cx-w/2,base+h,cz-d/2))

    def tower(self,p,h):
        a=p['turret'];r=a['radius'];cx,cz=a['center'];n=D['turret_segments']
        # A closed polygonal round tower; exposed facets carry real blind windows.
        for i in range(n):
            angle=2*math.pi*i/n;half=math.pi/n;span=2*r*math.sin(half)
            nx,nz=math.cos(angle),math.sin(angle);mx=cx+r*math.cos(half)*nx;mz=cz+r*math.cos(half)*nz
            def xf(u,y,q):return (mx+u*nz-q*nx,y,mz-u*nx-q*nz)
            holes=[]
            exposed=all(v[0]>p['width']/2 or v[2]>0 for v in [xf(-span/2,0,0),xf(span/2,0,0)])
            if exposed:
                holes=[opening(0,(p['ground_height']+(level-1)*D['floor_height'] if level else 0)+D['turret_sill'],D['turret_window_width'],D['turret_window_height']) for level in range(p['floors'])]
            polys=[polygon_box(o['u']-o['w']/2,o['y'],o['u']+o['w']/2,o['y']+o['h']) for o in holes]
            face=Polygon([(-span/2,0),(span/2,0),(span/2,h),(-span/2,h)],holes=[list(poly.exterior.coords) for poly in polys])
            for tri in shapely.constrained_delaunay_triangles(face).geoms:
                self.tri('rounded_corner_tower','wall_stone',*[xf(u,y,0) for u,y in list(shapely.orient_polygons(tri).exterior.coords)[:3]])
            for j,poly in enumerate(polys):
                ring=list(shapely.orient_polygons(poly).exterior.coords)[:-1];depth=D['recess'];t=D['panel_thickness']
                for aa,bb in zip(ring,ring[1:]+ring[:1]):self.quad('rounded_corner_tower','wall_stone',xf(*aa,0),xf(*aa,depth),xf(*bb,depth),xf(*bb,0))
                self.quad('rounded_corner_tower','wall_stone',*[xf(*v,depth) for v in ring])
                # Glazing cuboid is oriented to the facet and remains a closed solid.
                name=f'turret_pane_{i}_{j}';o=holes[j]
                self.box(name,(o['w'],o['h'],t),(0,o['y']+o['h']/2,depth-t/2),'window')
                self.parts[name]={s:[tuple(xf(v[0],v[1],v[2]) for v in tri[::-1]) for tri in tris] for s,tris in self.parts[name].items()}
                # xf reflects local depth, so reverse winding above.
            left,right=xf(-span/2,0,0),xf(span/2,0,0)
            self.tri('rounded_corner_tower','wall_stone',(cx,0,cz),right,left)
            self.tri('rounded_corner_tower','wall_stone',(cx,h,cz),(left[0],h,left[2]),(right[0],h,right[2]))


def opening(u,y,w,h,slot='window',depth=None):
    return dict(u=u,y=y,w=w,h=h,slot=slot,depth=D['recess'] if depth is None else depth)


def parapet(m,name,w,d,h,center):
    x,z=center;t=D['parapet_thickness'];ph=D['parapet_height'];cap=D['coping_height']
    # Butt joints do not overlap and remain separate solid architectural parts.
    for s in [-1,1]:
        m.box(name+f'_parapet_z{s}',(w,ph,t),(x,h+ph/2,z+s*(d-t)/2),'wall')
        m.box(name+f'_cap_z{s}',(w,cap,t),(x,h+ph+cap/2,z+s*(d-t)/2),'concrete')
        m.box(name+f'_parapet_x{s}',(t,ph,d-2*t),(x+s*(w-t)/2,h+ph/2,z),'wall')
        m.box(name+f'_cap_x{s}',(t,cap,d-2*t),(x+s*(w-t)/2,h+ph+cap/2,z),'concrete')


def roof(m,p,h):
    w,d=p['width'],p['depth'];kind=p['roof'];rz=-d/2
    if kind=='gable':
        m.prism('pitched_attic',[(-w/2,0),(w/2,0),(0,p['roof_rise'])],d,(0,h,rz),'concrete')
        for x in p['roof_vents']:
            m.box('roof_chimney_'+str(x),D['chimney_size'],(x,h+p['roof_rise'],rz),'wall_brick')
    else:
        parapet(m,'roof',w,d,h,(0,rz))
        rw,rh,rd=p['roof_room'];rx,rz=p['roof_room_xz']
        m.block('roof_equipment_room',rw,rd,rh,(rx,h,rz),p['wall'],{'front':[opening(0,D['roof_door_base'],D['door_width'],D['door_height'],'door')]})
        m.box('roof_room_lid',(rw,D['roof_slab'],rd),(rx,h+rh+D['roof_slab']/2,rz),'concrete')
        for i,x in enumerate(p['roof_vents']):
            m.box('roof_vent_'+str(i),D['vent_size'],(x,h+D['vent_size'][1]/2,-d*D['vent_depth_ratio']),'metal_dark')


def entrance(m,x,steps,canopy=True):
    rise=D['step_rise'];run=D['step_run'];w=D['entry_width'];land=D['entry_landing']
    # A closed stair profile, not overlapping stack boxes.
    profile=[(0,0),(land+steps*run,0)]
    for i in range(steps):profile.extend([(land+(steps-i)*run,(i+1)*rise),(land+(steps-i-1)*run,(i+1)*rise)])
    profile.extend([(0,steps*rise)])
    before=set(m.parts)
    if steps:m.prism('entry_stair_'+str(x),profile,w,(0,0,0),'concrete')
    # Prism local X is world +Z, its depth becomes world X; rotation preserves handedness.
    key='entry_stair_'+str(x)
    if steps:m.parts[key]={s:[tuple((x-v[2],v[1],v[0]) for v in tri) for tri in tris] for s,tris in m.parts[key].items()}
    if canopy:
        m.box('entry_canopy_'+str(x),(w,D['canopy_thickness'],D['entry_canopy_depth']),(x,steps*rise+D['door_height']+D['canopy_headroom'],D['entry_canopy_depth']/2),'concrete')
    m.interactions.append(dict(kind='entrance',position=[x,steps*rise,-D['recess']],approach=[x,0,land+steps*run]))


def balcony(m,x,y,p,i):
    kind=p['balcony'];bw=p['balcony_width'];bd=p['balcony_depth'];t=D['balcony_slab'];rt=D['rail_thickness'];rh=D['rail_height']
    if kind=='none':return
    if kind=='recessed':
        # Deep loggia already carved in the wall, with railing inside the mouth.
        m.box(f'loggia_rail_{i}',(bw,rh,rt),(x,y+rh/2,-rt/2),'concrete')
    else:
        m.box(f'balcony_deck_{i}',(bw,t,bd),(x,y-t/2,bd/2),'concrete')
        if kind=='enclosed':
            m.block(f'enclosed_balcony_{i}',bw,bd,p['window_height']+D['balcony_spandrel'],(x,y,bd/2),p['wall'],{'front':[opening(0,D['balcony_spandrel'],bw-D['balcony_edge']*2,p['window_height']-D['balcony_window_margin'],depth=D['balcony_glazing_recess'])]})
        else:
            m.box(f'balcony_front_{i}',(bw,rh,rt),(x,y+rh/2,bd-rt/2),'metal_dark')
            for s in [-1,1]:m.box(f'balcony_side_{i}_{s}',(rt,rh,bd-rt),(x+s*(bw-rt)/2,y+rh/2,(bd-rt)/2),'metal_dark')


def building(m,p):
    w,d=p['width'],p['depth'];gh=p['ground_height'];fh=D['floor_height'];h=gh+(p['floors']-1)*fh
    holes={s:[] for s in ['front','back','left','right']}
    for s in holes:
        xs=p['window_x'] if s in ['front','back'] else p['side_u']
        for level in range(p['floors']):
            for i,x in enumerate(xs):
                if level==0 and s=='front':continue
                y=(gh+(level-1)*fh if level else 0)+p['window_sill']
                ww=p['window_width'];hh=p['window_height'];dep=D['recess']
                if s=='front' and p['balcony']=='recessed' and x in p['balcony_x']:
                    ww=p['balcony_width'];dep=p['balcony_depth']
                holes[s].append(opening(x,y,ww,hh,depth=dep))
    for x in p['doors']:
        holes['front'].append(opening(x,max(D['door_threshold'],p['steps']*D['step_rise']),D['door_width'],D['door_height'],'door'))
        entrance(m,x,p['steps'])
    for x in p['ground_windows']:holes['front'].append(opening(x,D['ground_window_sill'],p['ground_window_width'],D['ground_window_height']))
    if p.get('porch'):
        a=p['porch'];holes['front']=[o for o in holes['front'] if abs(o['u']-a['x'])>a['width']/2+o['w']/2]
        holes['front'].append(opening(a['x'],a['base'],a['width'],a['height'],None,a['depth']))
        # Door panels lie at the back of the open, fully enclosed porch recess.
        for i,x in enumerate(a['door_x']):
            m.box(f'porch_door_{i}',(D['door_width'],D['door_height'],D['panel_thickness']),(x,a['base']+D['door_height']/2,-a['depth']+D['panel_thickness']/2),'door')
            m.interactions.append(dict(kind='entrance',position=[x,a['base'],-a['depth']],approach=[x,0,D['entry_landing']]))
        boundaries=[a['x']-a['width']/2]+[v for x in sorted(a['door_x']) for v in [x-D['door_width']/2,x+D['door_width']/2]]+[a['x']+a['width']/2]
        for i in range(0,len(boundaries)-1,2):
            left,right=boundaries[i:i+2];width=right-left-D['porch_mullion']
            if width<=0:continue
            height=a['height']-D['porch_glazing_sill']-D['porch_glazing_top_margin']
            m.box(f'porch_glazing_{i}',(width,height,D['panel_thickness']),((left+right)/2,a['base']+D['porch_glazing_sill']+height/2,-a['depth']+D['panel_thickness']/2),'window')
    m.block('masonry',w,d,h,(0,0,-d/2),p['wall'],holes)
    for level in range(1,p['floors']):
        y=gh+(level-1)*fh+p['window_sill']
        for x in p['balcony_x']:balcony(m,x,y,p,f'{level}_{x}')
    roof(m,p,h)
    if p.get('blank_sign'):
        a=p['blank_sign'];t=D['sign_border'];x,y,z=a['center'];ww,hh=a['size']
        m.box('blank_sign_inset',(ww,hh,D['sign_depth']),(x,y,z),'trim_dark')
        for s in [-1,1]:
            m.box('sign_edge_h'+str(s),(ww+2*t,t,D['sign_depth']),(x,y+s*(hh+t)/2,z),'concrete')
            m.box('sign_edge_v'+str(s),(t,hh,D['sign_depth']),(x+s*(ww+t)/2,y,z),'concrete')
    if p.get('large_canopy'):
        a=p['large_canopy'];m.box('grand_entrance_canopy',a['size'],a['center'],'concrete')
        for x in a['column_x']:m.box('canopy_column_'+str(x),(D['column_width'],a['center'][1],D['column_width']),(x,a['center'][1]/2,a['center'][2]+a['size'][2]/2-D['column_setback']),'wall_stone')
    if p.get('dropoff'):
        a=p['dropoff'];m.box('dropoff_platform',a['size'],a['center'],'concrete')
    if p.get('cart_bay'):
        a=p['cart_bay'];m.box('cart_bay_slab',a['size'],a['center'],'concrete')
        for x in a['rack_x']:
            m.tube('cart_rail_'+str(x),(x,D['rack_radius'],a['z0']),(x,D['rack_radius'],a['z1']),D['rack_radius'],D['round_segments'])
        m.interactions.append(dict(kind='cart_storage',position=a['center']))
    if p.get('turret'):
        a=p['turret'];m.tower(p,h+a['extra_height'])
        m.cylinder('turret_crown',a['radius']+D['turret_cap_extra'],D['turret_cap_height'],[a['center'][0],h+a['extra_height']+D['turret_cap_height']/2,a['center'][1]],'concrete')


def site_piece(m,p):
    kind=p['kind']
    if kind=='wall':
        w,h,t=p['width'],p['height'],p['depth'];base=p['base_height']
        m.box('wall_base',(w,base,t),(0,base/2,0),p['wall'])
        if p['railing']:
            for i in range(p['bars']):
                x=-w/2+(i+.5)*w/p['bars'];m.box('railing_'+str(i),(p['bar_width'],h-base,p['bar_width']),(x,(base+h)/2,0),'metal_dark')
            m.box('top_rail',(w,p['bar_width'],p['bar_width']),(0,h-p['bar_width']/2,0),'metal_dark')
        else:m.box('wall_coping',(w,D['coping_height'],t),(0,h-D['coping_height']/2,0),'concrete')
    elif kind=='gate':
        for i,x in enumerate(p['pillar_x']):m.box('gate_pillar_'+str(i),(p['pillar_width'],p['height'],p['depth']),(x,p['height']/2,0),'wall_stone')
        m.box('gate_lintel',p['lintel_size'],p['lintel_center'],'concrete')
        m.block('guard_booth',*p['booth_size'],p['booth_center'],'wall_plaster',{'front':[opening(0,p['booth_sill'],p['booth_window_width'],p['booth_window_height'])],'right':[opening(0,p['booth_door_base'],D['door_width'],D['door_height'],'door')]})
        bw,bd,bh=p['booth_size'];cx,by,cz=p['booth_center'];m.box('guard_roof',(bw+D['booth_eave']*2,D['roof_slab'],bd+D['booth_eave']*2),(cx,by+bh+D['roof_slab']/2,cz),'concrete')
        m.interactions.extend([dict(kind='vehicle_clearance',width=p['vehicle_clear'],position=[p['vehicle_center'],0,0]),dict(kind='pedestrian_clearance',width=p['pedestrian_clear'],position=[p['pedestrian_center'],0,0])])
    elif kind in ['shed','garbage']:
        w,d,h=p['width'],p['depth'],p['height']
        for i,x in enumerate(p['post_x']):
            for s in [-1,1]:m.box(f'post_{i}_{s}',(p['post_width'],h,p['post_width']),(x,h/2,s*(d/2-p['post_width']/2)),'metal_dark')
        # Sloping canopy is a solid quadrilateral prism, with visible thickness.
        t=D['roof_slab'];r=p['roof_rise']
        m.prism('shed_roof',[(-d/2,h+r),(d/2,h),(d/2,h+t),(-d/2,h+r+t)],w,(0,0,0),'concrete')
        m.parts['shed_roof']={s:[tuple((v[2],v[1],-v[0]) for v in tri) for tri in tris] for s,tris in m.parts['shed_roof'].items()}
        if kind=='shed':
            for i,x in enumerate(p['rack_x']):
                for dz in [-p['rack_gap']/2,p['rack_gap']/2]:
                    m.tube(f'rack_leg_{i}_{dz}',(x,p['rack_radius'],dz),(x,p['rack_height'],dz),p['rack_radius'],D['round_segments'])
                m.tube(f'rack_top_{i}',(x,p['rack_height'],-p['rack_gap']/2),(x,p['rack_height'],p['rack_gap']/2),p['rack_radius'],D['round_segments'])
        else:
            m.box('back_screen',(w,p['screen_height'],p['screen_thickness']),(0,p['screen_height']/2,-d/2+p['screen_thickness']/2),'wall_brick')
            for i,x in enumerate(p['bin_x']):
                bw,bh,bd=p['bin_size'];m.box(f'bin_{i}',p['bin_size'],(x,bh/2,p['bin_z']),'metal_dark' if i%2 else 'metal')
                m.box(f'bin_lid_{i}',(bw+p['lid_extra'],p['lid_height'],bd+p['lid_extra']),(x,bh+p['lid_height']/2,p['bin_z']),'trim_dark')
                m.box(f'bin_label_{i}',p['label_size'],(x,bh*p['label_height_ratio'],p['bin_z']+bd/2+p['label_size'][2]/2),'accent')
                m.interactions.append(dict(kind='bin',position=[x,0,p['bin_z']+bd/2+p['bin_approach']]))
    elif kind in ['paving','plaza']:
        w,d,h=p['width'],p['depth'],p['height'];m.box('pavement',(w,h,d),(0,h/2,0),'concrete')
        t=p['curb_width'];ch=p['curb_height']
        for s in [-1,1]:
            m.box('curb_side_'+str(s),(t,ch,d),(s*(w-t)/2,h+ch/2,0),'concrete')
            if kind=='paving':m.box('curb_end_'+str(s),(w-2*t,ch,t),(0,h+ch/2,s*(d-t)/2),'concrete')
        if kind=='plaza':
            m.box('curb_back',(w-2*t,ch,t),(0,h+ch/2,-(d-t)/2),'concrete')
            # Front stair starts at sidewalk datum; its underside continues to y=0.
            for i in range(p['steps']):
                sh=p['sidewalk_height']+(i+1)*D['step_rise'];sd=D['step_run'];z=d/2+(p['steps']-i-.5)*sd
                m.box('plaza_step_'+str(i),(w,sh,sd),(0,sh/2,z),'concrete')
            m.interactions.append(dict(kind='open_square',position=[0,h,0]))
    elif kind=='drying':
        for i,x in enumerate(p['post_x']):
            m.box('foot_'+str(i),p['foot_size'],(x,p['foot_size'][1]/2,0),'concrete')
            m.tube('upright_'+str(i),(x,0,0),(x,p['height'],0),p['radius'],D['round_segments'])
            m.tube('crossbar_'+str(i),(x,p['height'],-p['crossbar_depth']/2),(x,p['height'],p['crossbar_depth']/2),p['radius'],D['round_segments'])
        for z in p['line_z']:m.tube('drying_line_'+str(z),(p['post_x'][0],p['height'],z),(p['post_x'][1],p['height'],z),p['line_radius'],D['round_segments'])
        for i,(x,z,w,h) in enumerate(p['cloths']):m.box('cloth_'+str(i),(w,h,p['cloth_thickness']),(x,p['height']-h/2,z),'fabric' if i%2 else 'trim_dark')


def garage(m,p):
    w,d=p['width'],p['depth'];fh=p['floor_height'];slab=p['slab'];t=p['parapet_thickness'];rh=D['rail_height']
    for level in range(p['floors']):
        y=level*fh
        m.box(f'floor_{level}',(w,slab,d),(0,y+slab/2,-d/2),'concrete')
        for x in p['column_x']:
            for z in p['column_z']:m.box(f'column_{level}_{x}_{z}',(p['column_width'],fh-slab,p['column_width']),(x,y+slab+(fh-slab)/2,z),'wall_stone')
        if level:
            # Entry gap is retained on both end facades for the external ramps.
            for s in [-1,1]:m.box(f'end_guard_{level}_{s}',(w-p['ramp_width'],rh,t),(-p['ramp_width']/2,y+slab+rh/2,-d/2+s*(d-t)/2),'concrete')
        for s in [-1,1]:m.box(f'side_guard_{level}_{s}',(t,rh,d),(s*(w-t)/2,y+slab+rh/2,-d/2),'concrete')
    top=p['floors']*fh
    m.box('roof_slab',(w,slab,d),(0,top+slab/2,-d/2),'concrete')
    parapet(m,'garage_roof',w,d,top+slab,(0,-d/2))
    # Longitudinal external ramp, connected to each level by end turning landings.
    rw=p['ramp_width']
    for level in range(p['floors']-1):
        rx=w/2+rw/2+(level%2)*rw
        y=level*fh;direction=1 if level%2==0 else -1
        profile=[(-d/2,y+(fh if direction<0 else 0)),(d/2,y+(fh if direction>0 else 0)),(d/2,y+(fh if direction>0 else 0)+slab),(-d/2,y+(fh if direction<0 else 0)+slab)]
        name=f'car_ramp_{level}';m.prism(name,profile,rw,(0,0,0),'concrete')
        m.parts[name]={s:[tuple((rx-v[2],v[1],v[0]-d/2) for v in tri) for tri in tris] for s,tris in m.parts[name].items()}
        # Solid side upstands follow the slope, open driving surface in between.
        for side in [-1,1]:
            name=f'ramp_guard_{level}_{side}';m.prism(name,[(a,b+slab) for a,b in profile[:2]]+[(a,b+slab+rh) for a,b in profile[:2][::-1]],t,(0,0,0),'concrete')
            m.parts[name]={s:[tuple((rx+side*(rw-t)/2-v[2],v[1],v[0]-d/2) for v in tri) for tri in tris] for s,tris in m.parts[name].items()}
    for level in range(p['floors']):
        for sign in [-1,1]:
            z=-d/2+sign*(d/2+p['landing_depth']/2)
            m.box(f'turn_landing_{level}_{sign}',(rw*3,slab,p['landing_depth']),(w/2+rw/2,level*fh+slab/2,z),'concrete')


def build():
    m=Architecture()
    if P['kind']=='rowhouse':
        for i,house in enumerate(P['houses']):
            child=Architecture();building(child,house);offset=P['house_centers'][i]
            for name,slots in child.parts.items():m.parts[f'house_{i}_{name}']={s:[tuple((v[0]+offset,v[1],v[2]) for v in tri) for tri in tris] for s,tris in slots.items()}
            for o in child.openings:o['body']=f'house_{i}_'+o['body'];o['center']=list(o['center']);o['center'][0]+=offset;m.openings.append(o)
            for a in child.interactions:a['position'][0]+=offset;a['approach'][0]+=offset;m.interactions.append(a)
    elif P['kind']=='building':building(m,P)
    elif P['kind']=='garage':garage(m,P)
    else:site_piece(m,P)
    return m


if __name__=='__main__':
    model=build();model.export(Path(__file__).resolve().parents[1] / 'models' / (NAME+'.glb'))
    print('MODEL_WRITTEN',NAME)
