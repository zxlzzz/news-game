"""原创程序模型；尺寸单位米；Blender 后台重建，无外部依赖。"""
NAME = 'car_hatchback'
WHEEL_ARCH_CLEARANCE = 0.035
WHEEL_AXLE_RADIUS = 0.035
WHEEL_AXLE_FIT_CLEARANCE = 0.004
CAR_WIDTH = 1.62
CAR_LENGTH = 3.65
WHEEL_RADIUS = 0.30
WHEEL_THICKNESS = 0.18
AXLES = [-1.12,1.12]
BODY_BOTTOM = 0.34
# Short fixed supports bridge the real axle/body gap inboard of the wheel wells.
AXLE_MOUNT_RADIUS = .025
AXLE_MOUNT_BODY_EMBED = .04
AXLE_MOUNT_INBOARD = .12
BELT_HEIGHT = 0.89
CABIN_WIDTH = 1.48
BODY_PROFILE = [(-1.825,0.34),(1.825,0.34),(1.825,0.76),(1.50,0.89),(-1.825,0.89)]
CABIN_PROFILE = [(-1.825,0.88),(-1.48,1.38),(-1.10,1.5),(0.38,1.5),(0.94,0.89)]
SIDE_WINDOWS = [[(-1.63,0.97),(-1.38,1.32),(-1.02,1.4),(-0.48,1.4),(-0.48,0.97)],[(-0.38,0.97),(-0.38,1.4),(0.33,1.4),(0.78,0.97)]]
PANE_THICKNESS = 0.012
GLASS_WIDTH = 1.19
FRONT_GLASS_FRACTIONS = (0.10, 0.88)
REAR_GLASS_FRACTIONS = (0.16, 0.91)
GLASS_SURFACE_INSET = 0.001
LAMP_SIZE = (0.25,0.16,0.04)
BUMPER_SIZE = (1.48,0.12,0.08)
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
    # Explicit UV-sphere triangles keep symmetric quad diagonal choices out of Blender.
    around, bands = 20, 12
    rx, ry, rz = (v / 2 for v in size)
    vertices = [(0, -ry, 0)]
    for j in range(1, bands):
        theta = j * pi / bands
        vertices.extend((rx*sin(theta)*cos(i*2*pi/around), -ry*cos(theta),
                         rz*sin(theta)*sin(i*2*pi/around)) for i in range(around))
    top = len(vertices)
    vertices.append((0, ry, 0))
    faces = []
    for i in range(around):
        nxt = (i + 1) % around
        faces.append((0, 1+i, 1+nxt))
        for j in range(bands-2):
            a, b = 1+j*around+i, 1+j*around+nxt
            c, d = a+around, b+around
            faces.extend(((a,c,d), (a,d,b)))
        last = 1+(bands-2)*around
        faces.append((top, last+nxt, last+i))
    obj = mesh(name, vertices, faces, slot)
    obj.location = xyz(center)
    return obj


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
    # Finish the complete export before replacing an asset the editor may read.
    import os
    import tempfile
    with tempfile.NamedTemporaryFile(dir=output.parent,suffix='.glb',delete=False) as pending:
        temporary=Path(pending.name)
    try:
        bpy.ops.export_scene.gltf(filepath=str(temporary), export_format='GLB', export_yup=True,
            export_normals=True, export_texcoords=False, export_animations=False,
            export_cameras=False, export_lights=False, export_extras=False)
        canonicalize_triangle_order(temporary)
        os.replace(temporary,output)
    finally:
        temporary.unlink(missing_ok=True)
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


def rounded_box(name, size, center, radius, slot):
    obj=box(name,size,center,slot)
    mod=obj.modifiers.new('rounded_corners','BEVEL')
    mod.width=radius
    mod.segments=4
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def ribbon(name, points, width, thickness, slot):
    for i,(a,b) in enumerate(zip(points,points[1:])):
        d=Vector(b)-Vector(a)
        obj=box(name+'_'+str(i),(width,thickness,d.length()+thickness), (Vector(a)+Vector(b))/2,slot)
        obj.rotation_mode='QUATERNION'
        obj.rotation_quaternion=Vector((0,1,0)).rotation_difference(xyz(d).normalized())

def ground_all():
    bpy.context.view_layer.update()
    low=min((o.matrix_world@v.co).z for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices)
    for o in bpy.context.scene.objects:
        if o.parent is None:o.location.z-=low

def build():
    reset()
    def profile(name,outline,width,slot):
        n=len(outline)
        verts=[(x,y,z) for x in (-width/2,width/2) for z,y in outline]
        faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        return mesh(name,verts,faces,slot)
    profile('lower_body',BODY_PROFILE,CAR_WIDTH,'metal')
    profile('hatch_cabin',CABIN_PROFILE,CABIN_WIDTH,'metal')
    for sign in (-1,1):
        for z in AXLES:
            cylinder('tire',WHEEL_RADIUS,WHEEL_THICKNESS,(sign*CAR_WIDTH/2,WHEEL_RADIUS,z),'metal_dark',axis=(1,0,0))
            cylinder('hub',WHEEL_RADIUS/2,WHEEL_THICKNESS+PANE_THICKNESS,(sign*CAR_WIDTH/2,WHEEL_RADIUS,z),'metal',axis=(1,0,0))
        for polygon in SIDE_WINDOWS:
            obj=profile('side_glass',polygon,PANE_THICKNESS,'window')
            obj.location.x=sign*(CABIN_WIDTH/2+PANE_THICKNESS/3)
    def slope_glass(slope, fractions):
        (za,ya),(zb,yb) = slope
        return [(za+(zb-za)*fraction,ya+(yb-ya)*fraction)
                for fraction in fractions]
    for label,points in [('windshield',slope_glass(CABIN_PROFILE[-2:],FRONT_GLASS_FRACTIONS)),
                         ('rear_hatch_glass',slope_glass(CABIN_PROFILE[:2],REAR_GLASS_FRACTIONS))]:
        (z0,y0),(z1,y1)=points
        normal=Vector((0,z1-z0,y0-y1)).normalized()
        # A thin inset makes the opaque glazing a fitted surface layer. Its
        # whole outer face lies outside the actual shell, without an air gap.
        verts=[Vector((x,y,z))+normal*offset
               for offset in (-GLASS_SURFACE_INSET,PANE_THICKNESS-GLASS_SURFACE_INSET)
               for x,y,z in [(-GLASS_WIDTH/2,y0,z0),(GLASS_WIDTH/2,y0,z0),(GLASS_WIDTH/2,y1,z1),(-GLASS_WIDTH/2,y1,z1)]]
        mesh(label,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'window')
    for sign in (-1,1):
        box('bumper',BUMPER_SIZE,(0,BODY_BOTTOM+BUMPER_SIZE[1],sign*CAR_LENGTH/2),'metal_dark')
        for x in (-CAR_WIDTH/3,CAR_WIDTH/3):box('lamp',LAMP_SIZE,(x,BELT_HEIGHT-LAMP_SIZE[1],sign*CAR_LENGTH/2),'accent' if sign>0 else 'trim_dark')
    ground_all()
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from vehicle_geometry import finish_wheeled_vehicle
    finish_wheeled_vehicle(bpy.context.scene.objects, WHEEL_ARCH_CLEARANCE, WHEEL_AXLE_RADIUS, WHEEL_AXLE_FIT_CLEARANCE)
    mount_x = CAR_WIDTH / 2 - WHEEL_THICKNESS / 2 - WHEEL_ARCH_CLEARANCE - AXLE_MOUNT_INBOARD
    for z in AXLES:
        for sign in (-1, 1):
            bar('axle_mount', (sign * mount_x, WHEEL_RADIUS, z),
                (sign * mount_x, BODY_BOTTOM + AXLE_MOUNT_BODY_EMBED, z),
                AXLE_MOUNT_RADIUS, 'metal_dark')
    export(NAME)

if __name__ == "__main__":
    build()


# Independent model articulation is declared alongside the model build data.
if __name__ == "__main__":
    import sys as _motion_sys
    from pathlib import Path as _MotionPath
    _motion_sys.path.insert(0, str(_MotionPath(__file__).resolve().parent))
    from movable_prop_geometry import annotate_model_motion as _annotate_model_motion
    _annotate_model_motion("car_hatchback")
