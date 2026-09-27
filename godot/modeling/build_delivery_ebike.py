"""带外卖箱的电动车；原创程序模型，内嵌项目基础几何。"""
NAME = 'delivery_ebike'
KIND = 'delivery'
P = {'body_center': (0, 0.46, -0.31),
 'body_size': (0.4, 0.42, 0.58),
 'fairing_center': (0, 0.75, 0.43),
 'fairing_size': (0.4, 0.55, 0.14),
 'footrest_size': (0.2, 0.05, 0.32),
 'footrest_x': 0.1,
 'footrest_y': 0.3,
 'footrest_z': 0.14,
 'frame_r': 0.04,
 'frame_segments': [((0, 0.25, -0.675), (0, 0.45, -0.2)),
                    ((0, 0.45, -0.2), (0, 0.42, 0.32)),
                    ((0, 0.42, 0.32), (0, 1.02, 0.45)),
                    ((0, 1.02, 0.45), (0, 0.25, 0.675))],
 'handle_r': 0.035,
 'handle_w': 0.58,
 'handle_y': 1.16,
 'handle_z': 0.52,
 'headlamp_center': (0, 1.03, 0.53),
 'headlamp_r': 0.09,
 'headlamp_t': 0.04,
 'hub_r': 0.07,
 'motor': True,
 'seat_center': (0, 0.79, -0.27),
 'seat_size': (0.4, 0.13, 0.67),
 'spoke_r': 0.025,
 'tire_t': 0.12,
 'tire_wall': 0.075,
 'wheel_r': 0.25,
 'wheelbase': 1.35}
TRACK = 0.96
OFFSETS = [-1.125, -0.375, 0.375, 1.125]
FALL_ANGLE = 1.5707963267948966
EXTRAS = [['box', 'rear_rack', (0.65, 0.06, 0.62), (0, 0.77, -0.83), 'metal_dark'],
 ['box', 'delivery_box', (0.6, 0.52, 0.57), (0, 1.06, -0.85), 'fabric'],
 ['box', 'box_lid', (0.64, 0.06, 0.61), (0, 1.35, -0.85), 'metal_dark']]
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

from mathutils import Matrix
"""Vehicle construction, dimensions supplied by each asset's build script."""



def side_prism(name, profile, thickness, x, slot):
    n=len(profile)
    vertices=[(x+dx,y,z) for dx in (-thickness/2,thickness/2) for z,y in profile]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vertices,faces,slot)


def loft(name, sections, slot):
    """Each station: z and an identical-length clockwise XY section."""
    n=len(sections[0][1])
    verts=[(x,y,z) for z,section in sections for x,y in section]
    faces=[tuple(range(n-1,-1,-1)),tuple(range((len(sections)-1)*n,len(sections)*n))]
    for j in range(len(sections)-1):
        for i in range(n):
            k=(i+1)%n
            faces.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
    return mesh(name,verts,faces,slot)


def build_car(p):
    w,l=p['width'],p['length']
    def rect(width,bottom,top):
        return [(-width/2,bottom),(width/2,bottom),(width/2,top),(-width/2,top)]
    loft('body',[(z,rect(bw,p['body_bottom'],top)) for z,bw,top in p['body_stations']],'metal')
    sections=[]
    for z,cw,top in p['cabin_stations']:
        r=min(p['roof_round'],(top-p['belt_y'])/2)
        sections.append((z,[(-cw/2,p['belt_y']),(cw/2,p['belt_y']),
            (cw/2,top-r),(cw/2-r*.134,top-r*.5),(cw/2-r*.5,top-r*.134),(cw/2-r,top),
            (-cw/2+r,top),(-cw/2+r*.5,top-r*.134),(-cw/2+r*.134,top-r*.5),(-cw/2,top-r)]))
    loft('cabin',sections,'metal')
    for x in (-w/2,w/2):
        for z in p['axles_z']:
            cylinder('tire',p['wheel_r'],p['wheel_t'],(x,p['wheel_r'],z),'metal_dark',axis=(1,0,0))
            cylinder('hub',p['hub_r'],p['wheel_t']+p['hub_out'],(x,p['wheel_r'],z),'metal',axis=(1,0,0))
        for profile in p['side_windows']:
            side_prism('side_window',profile,p['pane_t'],x*p['cabin_stations'][1][1]/w,'window')
    # Derive panes from the actual cabin slope, so they cannot float like spoilers.
    for name,i,j in [('windshield',2,3),('rear_window',0,1)]:
        za,_,ya=p['cabin_stations'][i]
        zb,_,yb=p['cabin_stations'][j]
        ta,tb=p['glass_inset_fractions']
        z0,z1=za+(zb-za)*ta,za+(zb-za)*tb
        y0,y1=ya+(yb-ya)*ta,ya+(yb-ya)*tb
        normal=Vector((0,z1-z0,y0-y1)).normalized()
        w=p['glass_width']/2
        surface=[(-w,y0,z0),(w,y0,z0),(w,y1,z1),(-w,y1,z1)]
        vertices=[Vector(v)+normal*offset for offset in (p['glass_lift'],p['glass_lift']+p['pane_t']) for v in surface]
        mesh(name,vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'window')
    for z in (-l/2,l/2):
        box('bumper',(w*.88,p['bumper_h'],p['bumper_t']),(0,p['bumper_y'],z),'metal_dark')
        for x in (-w*.32,w*.32):
            box('head_or_tail_lamp',p['lamp_size'],(x,p['lamp_y'],z),'accent' if z>0 else 'trim_dark')
    if p['taxi']:
        box('taxi_roof_sign',p['taxi_sign'],(0,p['height']+p['taxi_sign'][1]/2,p['taxi_sign_z']),'accent')


def build_two_wheeler(p):
    def group(name, center, objects):
        node=bpy.data.objects.new(name,None)
        bpy.context.collection.objects.link(node)
        node.location=xyz(center)
        bpy.context.view_layer.update()
        for obj in sorted(objects, key=lambda item: item.name):
            world=obj.matrix_world.copy()
            obj.parent=node
            obj.matrix_world=world
        return node
    for z in (-p['wheelbase']/2,p['wheelbase']/2):
        before=set(bpy.context.scene.objects)
        ring('tire',p['wheel_r'],p['wheel_r']-p['tire_wall'],p['tire_t'],(0,p['wheel_r'],z),'metal_dark',axis=(1,0,0))
        cylinder('hub',p['hub_r'],p['tire_t'],(0,p['wheel_r'],z),'metal',axis=(1,0,0))
        from math import sin,cos,pi
        for angle in (0,pi/3,2*pi/3):
            a=(0,p['wheel_r']+cos(angle)*(p['wheel_r']-p['tire_wall']),z+sin(angle)*(p['wheel_r']-p['tire_wall']))
            b=(0,p['wheel_r']-cos(angle)*(p['wheel_r']-p['tire_wall']),z-sin(angle)*(p['wheel_r']-p['tire_wall']))
            bar('wheel_spoke',a,b,p['spoke_r'],'metal')
        group('wheel_front' if z>0 else 'wheel_rear',(0,p['wheel_r'],z),set(bpy.context.scene.objects)-before)
    for a,b in p['frame_segments']:
        bar('frame',a,b,p['frame_r'],'metal')
    box('saddle',p['seat_size'],p['seat_center'],'metal_dark')
    bar('handlebar',(-p['handle_w']/2,p['handle_y'],p['handle_z']),
        (p['handle_w']/2,p['handle_y'],p['handle_z']),p['handle_r'],'metal_dark')
    if p['motor']:
        box('battery_body',p['body_size'],p['body_center'],'metal')
        box('front_fairing',p['fairing_size'],p['fairing_center'],'metal')
        cylinder('headlamp',p['headlamp_r'],p['headlamp_t'],p['headlamp_center'],'accent',axis=(0,0,1))
        # Steering stem reaches the revised grip position; feet have real supports.
        bar('handle_stem',(0,p['frame_segments'][-2][1][1],p['frame_segments'][-2][1][2]),
            (0,p['handle_y'],p['handle_z']),p['frame_r'],'metal')
        for sign in (-1,1):
            box('footrest_left' if sign>0 else 'footrest_right',p['footrest_size'],
                (sign*p['footrest_x'],p['footrest_y'],p['footrest_z']),'metal_dark')
    else:
        parts=[bar('crank_axle',(-p['crank_w']/2,p['crank_y'],0),(p['crank_w']/2,p['crank_y'],0),p['frame_r'],'metal_dark')]
        for sign in (-1,1):
            center=(sign*p['crank_w']/2,p['crank_y']+sign*p['crank_radius'],0)
            parts.append(bar('crank_arm',(center[0],p['crank_y'],0),center,p['frame_r'],'metal_dark'))
            pedal=box('pedal',p['pedal_size'],center,'metal_dark')
            parts.append(group('pedal_left' if sign>0 else 'pedal_right',center,[pedal]))
        group('crank_set',(0,p['crank_y'],0),parts)


def build():
    reset()
    if KIND == 'row':
        for x in OFFSETS:
            before=set(bpy.context.scene.objects)
            build_two_wheeler(P)
            bpy.context.view_layer.update()
            for o in set(bpy.context.scene.objects)-before:
                if o.parent is None: o.location.x += x
    else:
        build_two_wheeler(P)
        if KIND == 'cargo':
            rear=bpy.data.objects['wheel_rear']
            parts=list(rear.children)
            for o in parts:
                o.location.x -= TRACK/2
                other=o.copy();other.data=o.data.copy();bpy.context.collection.objects.link(other)
                other.location.x += TRACK
        elif KIND == 'fallen':
            bpy.context.view_layer.update()
            transform=Matrix.Rotation(FALL_ANGLE,4,'Y')
            for o in bpy.context.scene.objects:
                if o.parent is None:o.matrix_world=transform @ o.matrix_world
    for kind,*args in EXTRAS:globals()[kind](*args)
    bpy.context.view_layer.update()
    low=min((o.matrix_world @ Vector(v)).z for o in bpy.context.scene.objects if o.type=='MESH' for v in o.bound_box)
    for o in bpy.context.scene.objects:
        if o.parent is None:o.location.z -= low
    export(NAME)
if __name__=='__main__':build()
