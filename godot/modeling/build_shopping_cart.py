"""购物车。原创程序模型；Blender 后台运行；输出在脚本旁。无外部脚本依赖。"""
NAME = 'shopping_cart'
STAND_X, STAND_BASE_Y, STAND_BASE_Z = 0.26, 0.245, -0.34
STAND_TOP_Y, STAND_TOP_Z = 1.02, -0.50
WHEEL_X, WHEEL_Y, WHEEL_THICKNESS = 0.30, 0.10, 0.07
# All geometry dimensions and placements in metres, Y up; front +Z.
PARTS = [['cylinder', 'wheel', 0.1, 0.07, (-0.3, 0.1, -0.4), 'metal_dark', (1, 0, 0), None],
 ['cylinder', 'wheel', 0.1, 0.07, (-0.3, 0.1, 0.4), 'metal_dark', (1, 0, 0), None],
 ['cylinder', 'wheel', 0.1, 0.07, (0.3, 0.1, -0.4), 'metal_dark', (1, 0, 0), None],
 ['cylinder', 'wheel', 0.1, 0.07, (0.3, 0.1, 0.4), 'metal_dark', (1, 0, 0), None],
 ['box', 'lower_frame', (0.56, 0.06, 0.8), (0, 0.23, 0), 'metal'],
 ['box', 'basket_floor', (0.58, 0.06, 0.75), (0, 0.62, 0), 'metal'],
 ['bar', 'basket_corner', (-0.29, 0.64, -0.37), (-0.29, 0.95, -0.37), 0.025, 'metal'],
 ['bar', 'basket_corner', (-0.29, 0.64, 0.37), (-0.29, 0.95, 0.37), 0.025, 'metal'],
 ['bar', 'basket_corner', (0.29, 0.64, -0.37), (0.29, 0.95, -0.37), 0.025, 'metal'],
 ['bar', 'basket_corner', (0.29, 0.64, 0.37), (0.29, 0.95, 0.37), 0.025, 'metal'],
 ['bar', 'side_top', (-0.29, 0.95, -0.37), (-0.29, 0.95, 0.37), 0.028, 'metal'],
 ['bar', 'side_top', (0.29, 0.95, -0.37), (0.29, 0.95, 0.37), 0.028, 'metal'],
 ['bar', 'cross_top', (-0.29, 0.95, -0.37), (0.29, 0.95, -0.37), 0.028, 'metal'],
 ['bar', 'cross_top', (-0.29, 0.95, 0.37), (0.29, 0.95, 0.37), 0.028, 'metal'],
 ['bar', 'wire', (-0.2, 0.64, 0.37), (-0.2, 0.95, 0.37), 0.012, 'metal'],
 ['bar', 'wire', (0, 0.64, 0.37), (0, 0.95, 0.37), 0.012, 'metal'],
 ['bar', 'wire', (0.2, 0.64, 0.37), (0.2, 0.95, 0.37), 0.012, 'metal'],
 ['bar', 'stand', (-STAND_X, STAND_BASE_Y, STAND_BASE_Z), (-STAND_X, STAND_TOP_Y, STAND_TOP_Z), 0.03, 'metal'],
 ['bar', 'stand', (STAND_X, STAND_BASE_Y, STAND_BASE_Z), (STAND_X, STAND_TOP_Y, STAND_TOP_Z), 0.03, 'metal'],
 ['bar', 'handle', (-0.31, 1.02, -0.5), (0.31, 1.02, -0.5), 0.035, 'metal_dark']]
# Sparse complete basket boundaries, with the same rod scale as the front.
BASKET_SIDE_X = (-0.29, 0.29)
BASKET_SIDE_Z = (-0.24, 0.0, 0.24)
BASKET_BACK_X = (-0.20, 0.0, 0.20)
BASKET_BOTTOM_Y, BASKET_TOP_Y, BASKET_MIDDLE_Y = 0.64, 0.95, 0.795
BASKET_END_Z, BASKET_WIRE_R = 0.37, 0.012
for x in BASKET_SIDE_X:
    for z in BASKET_SIDE_Z:
        PARTS.append(['bar', 'side_wire', (x, BASKET_BOTTOM_Y, z), (x, BASKET_TOP_Y, z), BASKET_WIRE_R, 'metal'])
    PARTS.append(['bar', 'side_middle', (x, BASKET_MIDDLE_Y, -BASKET_END_Z), (x, BASKET_MIDDLE_Y, BASKET_END_Z), BASKET_WIRE_R, 'metal'])
for x in BASKET_BACK_X:
    PARTS.append(['bar', 'back_wire', (x, BASKET_BOTTOM_Y, -BASKET_END_Z), (x, BASKET_TOP_Y, -BASKET_END_Z), BASKET_WIRE_R, 'metal'])
for z in (-BASKET_END_Z, BASKET_END_Z):
    PARTS.append(['bar', 'end_middle', (BASKET_SIDE_X[0], BASKET_MIDDLE_Y, z), (BASKET_SIDE_X[1], BASKET_MIDDLE_Y, z), BASKET_WIRE_R, 'metal'])
GRIPS = {'grip_left': [0.24, 1.02, -0.5], 'grip_right': [-0.24, 1.02, -0.5]}
# Load path: basket floor -> diagonal cradle / rear posts -> chassis -> forks.
# The cradle and short rear brackets stop below the storage floor.
BASKET_SUPPORT_X = (-0.23, 0.23)
BASKET_SUPPORT_R = 0.025
BASKET_SUPPORT_BASE_YZ = (0.255, 0.20)
BASKET_SUPPORT_TOP_YZ = (0.595, -0.28)
BASKET_REAR_CONNECT_YZ = (0.62, -0.375)
FORK_INNER_X, FORK_RADIUS, FORK_TOP_Y = 0.236, 0.016, 0.245
AXLE_RADIUS, BEARING_CLEARANCE, AXLE_END_X = 0.016, 0.004, 0.318
FRAME_WHEEL_CLEARANCE = 0.006

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


def build():
    reset()
    for kind,*args in PARTS:
        globals()[kind](*args)
    for x in BASKET_SUPPORT_X:
        bar('basket_cradle', (x, *BASKET_SUPPORT_BASE_YZ),
            (x, *BASKET_SUPPORT_TOP_YZ), BASKET_SUPPORT_R, 'metal')
    for sign in (-1, 1):
        y,z = BASKET_REAR_CONNECT_YZ
        # Same affine centreline as the handle upright, not a guessed endpoint.
        stand_z = STAND_BASE_Z + (y-STAND_BASE_Y)/(STAND_TOP_Y-STAND_BASE_Y)*(STAND_TOP_Z-STAND_BASE_Z)
        bar('basket_rear_bracket', (sign*STAND_X,y,stand_z),
            (sign*STAND_X,y,z), BASKET_SUPPORT_R, 'metal')
    wheels = [o for o in bpy.context.scene.objects
              if o.type == 'MESH' and o.name.split('.')[0] == 'wheel']
    chassis = bpy.data.objects['lower_frame']
    for wheel in wheels:
        center = (wheel.location.x, wheel.location.z, -wheel.location.y)
        sign = 1 if center[0] > 0 else -1
        # The chassis must not rest directly on the rotating tire's crown.
        cutter = cylinder('wheel_crown_cut', WHEEL_Y+FRAME_WHEEL_CLEARANCE,
                          WHEEL_THICKNESS+2*FRAME_WHEEL_CLEARANCE, center, None, axis=(1,0,0))
        subtract(chassis,cutter,'wheel_clearance')
        # A blind bearing retains the visible outer cap of each wheel.
        inner = WHEEL_X-WHEEL_THICKNESS/2-FRAME_WHEEL_CLEARANCE
        outer = AXLE_END_X+BEARING_CLEARANCE
        cutter = cylinder('bearing_cut', AXLE_RADIUS+BEARING_CLEARANCE,
                          outer-inner, (sign*(inner+outer)/2,WHEEL_Y,center[2]),
                          None, axis=(1,0,0))
        subtract(wheel,cutter,'wheel_bearing')
        bar('wheel_fork', (sign*FORK_INNER_X,WHEEL_Y,center[2]),
            (sign*FORK_INNER_X,FORK_TOP_Y,center[2]), FORK_RADIUS,'metal')
        bar('wheel_spindle', (sign*FORK_INNER_X,WHEEL_Y,center[2]),
            (sign*AXLE_END_X,WHEEL_Y,center[2]), AXLE_RADIUS,'metal')
    for name,position in GRIPS.items():
        node=bpy.data.objects.new(name,None)
        bpy.context.collection.objects.link(node)
        node.location=xyz(position)
    if not NAME.startswith('held_'):
        bpy.context.view_layer.update()
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        low=min((o.matrix_world @ Vector(v)).z for o in meshes for v in o.bound_box)
        for o in bpy.context.scene.objects:
            o.location.z -= low
    export(NAME)

if __name__=='__main__':
    build()
