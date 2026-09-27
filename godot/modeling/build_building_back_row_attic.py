"""后排阁楼。原创程序模型。Blender --background --factory-startup --python 本文件；GLB 输出到本文件旁。无外部脚本依赖。"""
NAME = 'building_back_row_attic'
# Design dimensions and placements, in metres; Y up, front +Z.
P = {'wall_slot': 'wall_brick',
 'window_shape': 'round',
 'shop_shape': 'rect',
 'vertical_bars': 0,
 'transom_ratio': 0,
 'pair_gap': 0.18,
 'arch_rise_ratio': 0.3,
 'arch_segments': 16,
 'corner_clip_ratio': 0.18,
 'width': 11.8,
 'depth': 8.8,
 'ground_h': 3.8,
 'floor_h': 3.2,
 'floors': 4,
 'recess': 0.48,
 'cut_overlap': 0.02,
 'window_base': 0.75,
 'window_w': 1.7,
 'window_h': 1.7,
 'window_x': (-3.8, 0, 3.8),
 'pane_thickness': 0.04,
 'side_window_z': (-2, -5.5),
 'shop_windows': ((-3.1860000000000004, 1.2), (3.1860000000000004, 1.2)),
 'shop_base': 0.4,
 'shop_h': 2.15,
 'door_x': 0,
 'door_w': 1.1,
 'door_h': 2.3,
 'sill_extra': 0.16,
 'sill_h': 0.1,
 'sill_depth': 0.26,
 'mullion_w': 0.08,
 'frame_depth': 0.15,
 'mullions': True,
 'traditional': False,
 'corner': False,
 'parapet_t': 0.22,
 'parapet_h': 0.9,
 'coping_h': 0.12,
 'coping_extra': 0.06,
 'roof_room': (3.7760000000000002, 1.7, 2.64),
 'roof_room_xz': (0, -5.720000000000001),
 'roof_kind': 'gable',
 'roof_rise': 0.65,
 'tank_radius': 0.7,
 'tank_h': 1.2,
 'roof_vents': ((-2, -3),),
 'vent_size': (0.7, 0.6, 0.7),
 'sign_w': 2,
 'sign_h': 0.48,
 'sign_t': 0.12,
 'sign_x': 0,
 'sign_y': 3.12,
 'canopy_w': 0,
 'canopy_depth': 0.85,
 'canopy_y': 2.65,
 'canopy_rise': 0.16,
 'canopy_t': 0.04,
 'fabric_canopy': False,
 'band_h': 0.14,
 'band_depth': 0.2,
 'balconies': (),
 'balcony_w': 1.9,
 'balcony_depth': 0.75,
 'balcony_slab_h': 0.12,
 'rail_h': 1,
 'rail_t': 0.08,
 'door_base': 0,
 'extras': [],
 'niches': [],
 'round_segments': 32,
 'frame_slot': 'concrete',
 'frame_width': 0.17,
 'frame_front': 0.04,
 'shutter_width': 0.42,
 'shutter_depth': 0.09,
 'shutter_gap': 0.08,
 'shutters': False}

"""Shared, deterministic Blender primitives. All public coordinates are metres, Y up.

Build scripts own dimensions/design; this module only constructs and exports geometry.
Run any build script with Blender --background --factory-startup --python <script>.
No third-party meshes, textures, randomness or downloaded assets.
"""
from pathlib import Path
from math import sin, cos, pi
import bpy
import bmesh
from mathutils import Vector

CIRCLE_SEGMENTS = 32
TUBE_SEGMENTS = 16
DECAL_Y = 0.003


def xyz(p):
    return Vector((p[0], -p[2], p[1]))


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def material(slot):
    m = bpy.data.materials.get(slot)
    if m is None:
        m = bpy.data.materials.new(slot)
        m.use_nodes = True
        shader = m.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
        shader.inputs['Roughness'].default_value = 1
    return m


def finish(obj, name, slot):
    obj.name = name
    obj.data.name = name
    if slot:
        obj.data.materials.append(material(slot))
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)
    return obj


def box(name, size, center, slot):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(center))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    return finish(obj, name, slot)


def mesh(name, vertices, faces, slot):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(v) for v in vertices], [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, slot)


def cylinder(name, radius, height, center, slot, axis=(0, 1, 0), radius_top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=CIRCLE_SEGMENTS, radius1=radius,
        radius2=radius if radius_top is None else radius_top, depth=height, location=xyz(center))
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(xyz(axis).normalized())
    return finish(obj, name, slot)


def bar(name, start, end, radius, slot):
    a, b = Vector(start), Vector(end)
    return cylinder(name, radius, (b-a).length, (a+b)/2, slot, b-a)


def ellipsoid(name, size, center, slot):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1, location=xyz(center))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    return finish(obj, name, slot)


def ring(name, outer, inner, height, center, slot, axis=(0, 1, 0)):
    """Closed annular solid; no coincident cylinder caps or open edges."""
    verts = []
    for y, r in [(-height/2, outer), (-height/2, inner), (height/2, outer), (height/2, inner)]:
        verts.extend([(r*cos(i*2*pi/CIRCLE_SEGMENTS), y, r*sin(i*2*pi/CIRCLE_SEGMENTS)) for i in range(CIRCLE_SEGMENTS)])
    faces = []
    n = CIRCLE_SEGMENTS
    for i in range(n):
        j = (i+1) % n
        faces.extend([(i,j,n+j,n+i), (2*n+i,3*n+i,3*n+j,2*n+j),
                      (i,2*n+i,2*n+j,j), (n+i,n+j,3*n+j,3*n+i)])
    q = Vector((0,1,0)).rotation_difference(Vector(axis).normalized())
    return mesh(name, [q @ Vector(v) + Vector(center) for v in verts], faces, slot)


def prism(name, outline, depth, center, slot):
    """Extrude a convex XY profile along Z; closed caps. Center is XYZ."""
    verts = [(x+center[0], y+center[1], z+center[2]) for z in (-depth/2,depth/2) for x,y in outline]
    n = len(outline)
    faces = [tuple(range(n-1,-1,-1)), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name, verts, faces, slot)


def roof_panel(name, width, depth, low_y, rise, thickness, center_z, slot):
    # Single sloped slab, all four edges closed; low edge faces +Z.
    vertices = [(x,y,z+center_z) for yoff in (0,thickness) for x,y,z in
        [(-width/2,low_y+yoff,depth/2),(width/2,low_y+yoff,depth/2),
         (width/2,low_y+rise+yoff,-depth/2),(-width/2,low_y+rise+yoff,-depth/2)]]
    return mesh(name, vertices, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], slot)


def blind_cut(body, name, size, center):
    cutter = box(name+'_cutter', size, center, None)
    subtract(body, cutter, name)


def subtract(body, cutter, name):
    bpy.context.view_layer.objects.active = body
    mod = body.modifiers.new(name, 'BOOLEAN')
    mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def rotate(obj, degrees, axis='Y'):
    direction = {'X':Vector((1,0,0)), 'Y':Vector((0,0,1)), 'Z':Vector((0,-1,0))}[axis]
    from mathutils import Quaternion
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Quaternion(direction, degrees*pi/180) @ obj.rotation_quaternion
    return obj


def export(name):
    output = Path(__file__).resolve().parents[1] / 'models' / (name+'.glb')
    output.parent.mkdir(parents=True, exist_ok=True)
    collisions = [p.name for p in output.parent.iterdir()
                  if p.name.casefold() == output.name.casefold() and p.name != output.name]
    if collisions:
        raise FileExistsError('Case-insensitive model name collision: '+str(collisions))
    # Boolean recesses may leave sub-micron slivers. Weld only well below the renderer's
    # 0.5 mm weld tolerance, triangulate explicitly, then recalculate actual face normals.
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.000001)
        bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=0.0000001)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        # A single open horizontal decal has no enclosed volume to orient against.
        # Force its visible side upward after recalc (Blender Z == game Y).
        if bm.verts and max(v.co.z for v in bm.verts)-min(v.co.z for v in bm.verts)<0.0000001:
            bmesh.ops.reverse_faces(bm, faces=[f for f in bm.faces if f.normal.z < 0])
        bm.to_mesh(obj.data)
        bm.free()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_yup=True,
        export_normals=True, export_texcoords=False, export_animations=False,
        export_cameras=False, export_lights=False, export_extras=False)
    canonicalize_triangle_order(output)
    print('MODEL_WRITTEN', output)


def canonicalize_triangle_order(path):
    """Blender's UV-sphere cleanup may enumerate identical triangles in a different order.
    Canonicalize only the index stream, preserving winding, vertices and exact geometry.
    No mesh compression or glTF extensions are added.
    """
    import json
    import struct
    data=bytearray(path.read_bytes())
    json_length=struct.unpack_from('<I',data,12)[0]
    gltf=json.loads(data[20:20+json_length])
    binary_start=20+json_length+8
    seen=set()
    for m in gltf['meshes']:
        for primitive in m['primitives']:
            index=primitive['indices']
            if index in seen:
                continue
            seen.add(index)
            accessor=gltf['accessors'][index]
            view=gltf['bufferViews'][accessor['bufferView']]
            fmt={5121:'B',5123:'H',5125:'I'}[accessor['componentType']]
            count=accessor['count']
            offset=binary_start+view.get('byteOffset',0)+accessor.get('byteOffset',0)
            values=struct.unpack_from('<'+fmt*count,data,offset)
            triangles=[]
            for i in range(0,count,3):
                t=values[i:i+3]
                triangles.append(min(t,t[1:]+t[:1],t[2:]+t[:2]))
            triangles.sort()
            struct.pack_into('<'+fmt*count,data,offset,*(v for t in triangles for v in t))
    path.write_bytes(data)

"""Architecture construction shared by this supply batch; dimensions come from each build script."""

from math import pi, sin, cos


def window_outline(width, height, shape, p):
    if shape == 'round':
        return [(width/2*cos(i*2*pi/p['round_segments']),height/2+height/2*sin(i*2*pi/p['round_segments'])) for i in range(p['round_segments'])]
    if shape == 'arch':
        rise=min(width/2, height*p['arch_rise_ratio'])
        return [(-width/2,0),(width/2,0)] + [
            (width/2*cos(i*pi/p['arch_segments']), height-rise+rise*sin(i*pi/p['arch_segments']))
            for i in range(p['arch_segments']+1)]
    if shape == 'clipped':
        c=min(width,height)*p['corner_clip_ratio']
        return [(-width/2,0),(width/2,0),(width/2,height-c),(width/2-c,height),(-width/2+c,height),(-width/2,height-c)]
    return [(-width/2,0),(width/2,0),(width/2,height),(-width/2,height)]


def build_building(p):
    w,d,h = p['width'],p['depth'],p['ground_h']+(p['floors']-1)*p['floor_h']
    wall=p['wall_slot']
    body = box('sealed_masonry',(w,h,d),(0,h/2,-d/2),wall)
    openings = []
    for level in range(1,p['floors']):
        bottom = p['ground_h']+(level-1)*p['floor_h']+p['window_base']
        for x in p['window_x']:
            if p['window_shape']=='paired':
                small=(p['window_w']-p['pair_gap'])/2
                for sign in (-1,1):
                    openings.append((x+sign*(small+p['pair_gap'])/2,bottom,small,p['window_h'],'window',False,'rect'))
            else:
                openings.append((x,bottom,p['window_w'],p['window_h'],'window',False,p['window_shape']))
        if p['corner']:
            for z in p['side_window_z']:
                openings.append((z,bottom,p['window_w'],p['window_h'],'window',True,p['window_shape']))
    for x,win_w in p['shop_windows']:
        openings.append((x,p['shop_base'],win_w,p['shop_h'],'window',False,p['shop_shape']))
    openings.append((p['door_x'],p['door_base'],p['door_w'],p['door_h'],'door',False,'rect'))
    if p['corner']:
        for z in p['side_window_z']:
            openings.append((z,p['shop_base'],p['window_w'],p['shop_h'],'window',True,p['shop_shape']))
    for i,(x,b,ow,oh,slot,side,shape) in enumerate(openings):
        r,t = p['recess'],p['pane_thickness']
        outline=window_outline(ow,oh,shape,p)
        for cutter,depth,z in [(True,r+p['cut_overlap'],(p['cut_overlap']-r)/2),(False,t,-r+t/2)]:
            center=(w/2+z,b,x) if side else (x,b,z)
            obj=prism('opening_%02d'%i if cutter else 'opaque_'+slot,outline,depth,(0,0,0),None if cutter else slot)
            if side: rotate(obj,90)
            obj.location=xyz(center)
            if cutter: subtract(body,obj,'recess_%02d'%i)
        # Small sill only, rather than a bright frame outlining every recess.
        if slot == 'window':
            sz,at=(ow+p['sill_extra'],p['sill_h'],p['sill_depth']),(x,b-p['sill_h']/2,0)
            if side:
                sz,at=(p['sill_depth'],p['sill_h'],ow+p['sill_extra']),(w/2,b-p['sill_h']/2,x)
            box('sill',sz,at,'trim' if p['traditional'] else 'concrete')
            upper=b>=p['ground_h']
            count=p['vertical_bars'] if upper else int(p['mullions'])
            bar_h=oh-(min(ow/2,oh*p['arch_rise_ratio']) if shape=='arch' else 0)
            for k in range(count):
                off=ow*((k+1)/(count+1)-.5)
                sz,at=(p['mullion_w'],bar_h,p['frame_depth']),(x+off,b+bar_h/2,-r/2)
                if side: sz,at=(p['frame_depth'],bar_h,p['mullion_w']),(w/2-r/2,b+bar_h/2,x-off)
                box('window_mullion',sz,at,'metal_dark')
            if upper and p['transom_ratio']:
                sz,at=(ow,p['mullion_w'],p['frame_depth']),(x,b+bar_h*p['transom_ratio'],-r/2)
                if side: sz,at=(p['frame_depth'],p['mullion_w'],ow),(w/2-r/2,b+bar_h*p['transom_ratio'],x)
                box('window_transom',sz,at,'metal_dark')
    # Rooftop deck is masonry, with a four-sided coping ring: never a full bright lid.
    pt,ph,ct = p['parapet_t'],p['parapet_h'],p['coping_h']
    for z in (-pt/2,-d+pt/2):
        box('parapet',(w,ph,pt),(0,h+ph/2,z),wall)
        box('coping',(w,ct,pt+p['coping_extra']),(0,h+ph+ct/2,z),'concrete')
    for x in (-(w-pt)/2,(w-pt)/2):
        box('side_parapet',(pt,ph,d-2*pt),(x,h+ph/2,-d/2),wall)
        box('side_coping',(pt+p['coping_extra'],ct,d-2*pt),(x,h+ph+ct/2,-d/2),'concrete')
    rw,rh,rd=p['roof_room']
    rx,rz=p['roof_room_xz']
    box('roof_stair_room',(rw,rh,rd),(rx,h+rh/2,rz),wall)
    if p['roof_kind']=='gable':
        prism('stair_room_gable',[(-rw/2,0),(rw/2,0),(0,p['roof_rise'])],rd,(rx,h+rh,rz),'concrete')
    elif p['roof_kind']=='slope':
        obj=roof_panel('stair_room_slope',rw,rd,h+rh,p['roof_rise'],ct,rz,'concrete')
        obj.location.x += rx
    elif p['roof_kind']=='tank':
        cylinder('roof_tank',p['tank_radius'],p['tank_h'],(rx,h+rh+p['tank_h']/2,rz),'metal')
    else:
        box('roof_room_cap',(rw,ct,rd),(rx,h+rh+ct/2,rz),'concrete')
    for x,z in p['roof_vents']:
        box('roof_vent',p['vent_size'],(x,h+p['vent_size'][1]/2,z),'metal')
    box('blank_shop_sign',(p['sign_w'],p['sign_h'],p['sign_t']),
        (p['sign_x'],p['sign_y'],p['sign_t']/2),'trim_dark')
    if p['canopy_w']:
        roof_panel('shop_canopy',p['canopy_w'],p['canopy_depth'],p['canopy_y'],p['canopy_rise'],p['canopy_t'],p['canopy_depth']/2,'fabric' if p['fabric_canopy'] else 'metal_dark')
    if p['traditional']:
        box('shop_cornice',(w,p['band_h'],p['band_depth']),(0,p['ground_h'],p['band_depth']/2),'concrete')
    for level,x in p['balconies']:
        sy=p['ground_h']+(level-1)*p['floor_h']+p['window_base']-p['balcony_slab_h']
        bw,bd=p['balcony_w'],p['balcony_depth']
        box('balcony_deck',(bw,p['balcony_slab_h'],bd),(x,sy,bd/2),'concrete')
        box('balcony_front',(bw,p['rail_h'],p['rail_t']),(x,sy+p['rail_h']/2,bd-p['rail_t']/2),'metal')
        for side in (-1,1):
            box('balcony_side',(p['rail_t'],p['rail_h'],bd),(x+side*(bw-p['rail_t'])/2,sy+p['rail_h']/2,bd/2),'metal')


def window_surrounds(p):
    # Closed solid frames follow the actual recess shape, with no face over the glass.
    for level in range(1,p['floors']):
        b=p['ground_h']+(level-1)*p['floor_h']+p['window_base']
        for cx in p['window_x']:
            shapes=[(cx,p['window_w'],p['window_shape'])]
            if p['window_shape']=='paired':
                sw=(p['window_w']-p['pair_gap'])/2
                shapes=[(cx+s*(sw+p['pair_gap'])/2,sw,'rect') for s in (-1,1)]
            for x,w,shape in shapes:
                h=p['window_h']; t=p['frame_width']; z=p['frame_front']-p['frame_depth']/2
                if shape=='round':
                    # Circular variants use equal width and height by design.
                    ring('round_window_frame',w/2+t,w/2,p['frame_depth'],(x,b+h/2,z),p['frame_slot'],axis=(0,0,1))
                else:
                    outer=window_outline(w+2*t,h+2*t,shape,p)
                    inner=window_outline(w,h,shape,p)
                    frame=prism('window_surround',outer,p['frame_depth'],(x,b-t,z),p['frame_slot'])
                    cut=prism('frame_cut',inner,p['frame_depth']+p['cut_overlap']*2,(x,b,z),None)
                    subtract(frame,cut,'frame_opening')
                if p['shutters']:
                    for sign in (-1,1):
                        box('wood_shutter',(p['shutter_width'],h,p['shutter_depth']),(x+sign*(w/2+t+p['shutter_gap']+p['shutter_width']/2),b+h/2,p['shutter_depth']/2),'wood')
    if p['shutters'] and p['floors']==1:
        for x,w in p['shop_windows']:
            for sign in (-1,1):
                box('wood_shutter',(p['shutter_width'],p['shop_h'],p['shutter_depth']),(x+sign*(w/2+p['shutter_gap']+p['shutter_width']/2),p['shop_base']+p['shop_h']/2,p['shutter_depth']/2),'wood')


def build():
    reset()
    build_building(P)
    window_surrounds(P)
    body = bpy.data.objects['sealed_masonry']
    for label,x,b,w,h,d in P['niches']:
        blind_cut(body, label, (w,h,d+P['cut_overlap']), (x,b+h/2,(P['cut_overlap']-d)/2))
    for kind,*args in P['extras']:
        globals()[kind](*args)
    if 'old_roof' in P:
        r=P['old_roof']
        # Front-facing gable is a closed triangular attic above the masonry.
        prism('pitched_attic',[(-r['width']/2,0),(r['width']/2,0),(0,r['rise'])],r['depth'],(0,r['eaves'],-P['depth']/2),'concrete')
    export(NAME)

if __name__ == '__main__':
    build()
