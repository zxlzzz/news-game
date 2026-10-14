"""快递柜。原创程序模型；Blender 后台运行；输出在脚本旁。无外部脚本依赖。"""
NAME = 'parcel_lockers'
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
# All dimensions and layout in metres, Y up; front +Z.
CABINET_WIDTH, CABINET_HEIGHT, CABINET_DEPTH = 3.2, 2.0, 0.65
SHELL_THICKNESS, SHELF_THICKNESS = 0.04, 0.03
ROW_COUNT, ROW_PITCH, FIRST_ROW_CENTER = 4, 0.5, 0.27
OUTER_DOOR_WIDTH, INNER_DOOR_WIDTH = 0.7, 0.58
OUTER_COLUMN_CENTERS, INNER_COLUMN_CENTERS = (-1.2, 1.2), (-0.46, 0.46)
DOOR_HEIGHT, DOOR_THICKNESS, DOOR_CENTER_Z = 0.46, 0.04, 0.35
OUTER_DIVIDER_X = (-1.58, -0.8, 0.8, 1.58)
CONTROL_SPINE_WIDTH = 0.28
TERMINAL_SIZE, TERMINAL_CENTER = (0.2, 0.32, 0.03), (0, 1.25, 0.34)
# Interleaved fixed lugs and rotating bearings use the unchanged door axes.
HINGE_PIN_RADIUS, HINGE_RADIAL_CLEARANCE = 0.006, 0.002
HINGE_BEARING_RADIUS, HINGE_BEARING_HEIGHT = 0.016, 0.054
HINGE_BEARING_OFFSETS_Y = (-0.145, 0.145)
HINGE_PIN_HEIGHT = 0.40
HINGE_FIXED_LUG_RADIUS, HINGE_FIXED_LUG_HEIGHT = 0.016, 0.024
HINGE_FIXED_OFFSETS_Y = (-0.185, 0.185)
HINGE_MOUNT_RADIUS, HINGE_MOUNT_EMBED = 0.010, 0.014
HINGE_FIXED_RELIEF_RADIUS, HINGE_FIXED_RELIEF_HEIGHT = 0.035, 0.042
PARTS = []
# The two inner compartments leave a continuous fixed central control spine.
for x in (OUTER_COLUMN_CENTERS[0], INNER_COLUMN_CENTERS[0], INNER_COLUMN_CENTERS[1], OUTER_COLUMN_CENTERS[1]):
    width = INNER_DOOR_WIDTH if x in INNER_COLUMN_CENTERS else OUTER_DOOR_WIDTH
    for row in range(ROW_COUNT):
        PARTS.append(['box', 'door', (width, DOOR_HEIGHT, DOOR_THICKNESS),
                      (x, FIRST_ROW_CENTER + row * ROW_PITCH, DOOR_CENTER_Z), 'metal'])
PARTS += [['box', 'terminal', TERMINAL_SIZE, TERMINAL_CENTER, 'glass_dark'],
 ['box', 'back', (CABINET_WIDTH, CABINET_HEIGHT, SHELL_THICKNESS),
  (0, CABINET_HEIGHT/2, -(CABINET_DEPTH-SHELL_THICKNESS)/2), 'metal_dark'],
 ['box', 'top', (CABINET_WIDTH, SHELL_THICKNESS, CABINET_DEPTH),
  (0, CABINET_HEIGHT-SHELL_THICKNESS/2, 0), 'metal_dark'],
 ['box', 'bottom', (CABINET_WIDTH, SHELL_THICKNESS, CABINET_DEPTH),
  (0, SHELL_THICKNESS/2, 0), 'metal_dark'],
 ['box', 'control_spine', (CONTROL_SPINE_WIDTH, CABINET_HEIGHT, CABINET_DEPTH),
  (0, CABINET_HEIGHT/2, 0), 'metal_dark']]
for x in OUTER_DIVIDER_X:
    PARTS.append(['box', 'divider', (SHELL_THICKNESS, CABINET_HEIGHT, CABINET_DEPTH),
                  (x, CABINET_HEIGHT/2, 0), 'metal_dark'])
for row in range(1, ROW_COUNT):
    PARTS.append(['box', 'shelf', (CABINET_WIDTH, SHELF_THICKNESS, CABINET_DEPTH),
                  (0, row * ROW_PITCH, 0), 'metal_dark'])
GRIPS = {}
MOVING = {f'LockerDoor{i:02d}':dict(parts=['door'+('.%03d'%i if i else '')], pivot='left_front',axis=[0,1,0],degrees=[0,-100]) for i in range(16)}


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


def build_hinge_supports():
    """Support each existing left-front axis without occupying its door sweep."""
    column_specs = (
        (OUTER_COLUMN_CENTERS[0], OUTER_DOOR_WIDTH,
         OUTER_DIVIDER_X[0] + SHELL_THICKNESS / 2),
        (INNER_COLUMN_CENTERS[0], INNER_DOOR_WIDTH,
         OUTER_DIVIDER_X[1] + SHELL_THICKNESS / 2),
        (INNER_COLUMN_CENTERS[1], INNER_DOOR_WIDTH,
         CONTROL_SPINE_WIDTH / 2),
        (OUTER_COLUMN_CENTERS[1], OUTER_DOOR_WIDTH,
         OUTER_DIVIDER_X[2] + SHELL_THICKNESS / 2),
    )
    bore_radius = HINGE_PIN_RADIUS + HINGE_RADIAL_CLEARANCE
    for column, (center_x, width, fixed_face_x) in enumerate(column_specs):
        for row in range(ROW_COUNT):
            index = column * ROW_COUNT + row
            door_name = 'door' + ('.%03d' % index if index else '')
            door = bpy.data.objects[door_name]
            pivot = (center_x - width / 2,
                     FIRST_ROW_CENTER + row * ROW_PITCH,
                     DOOR_CENTER_Z + DOOR_THICKNESS / 2)
            # The pin needs a real bore in the corner of the moving leaf.
            cutter = cylinder('locker_pin_bore', bore_radius,
                              HINGE_PIN_HEIGHT + HINGE_RADIAL_CLEARANCE * 2,
                              pivot, None)
            subtract(door, cutter, 'hinge_pin_bore')
            cylinder('locker_pin_%02d' % index, HINGE_PIN_RADIUS,
                     HINGE_PIN_HEIGHT, pivot, 'metal_dark')
            for bearing, offset in enumerate(HINGE_BEARING_OFFSETS_Y):
                at = (pivot[0], pivot[1] + offset, pivot[2])
                name = 'locker_bearing_%02d_%d' % (index, bearing)
                ring(name, HINGE_BEARING_RADIUS, bore_radius,
                     HINGE_BEARING_HEIGHT, at, 'metal')
                MOVING['LockerDoor%02d' % index]['parts'].append(name)
            for lug, offset in enumerate(HINGE_FIXED_OFFSETS_Y):
                at = (pivot[0], pivot[1] + offset, pivot[2])
                # The fixed lugs are separate in height from rotating bearings.
                # Relieve the leaf around the entire lug/bracket envelope.
                cutter = cylinder('locker_mount_relief',
                                  HINGE_FIXED_RELIEF_RADIUS,
                                  HINGE_FIXED_RELIEF_HEIGHT, at, None)
                subtract(door, cutter, 'hinge_fixed_lug_relief')
                cylinder('locker_fixed_lug_%02d_%d' % (index, lug),
                         HINGE_FIXED_LUG_RADIUS, HINGE_FIXED_LUG_HEIGHT,
                         at, 'metal_dark')
                mount_start = (fixed_face_x - HINGE_MOUNT_EMBED, at[1],
                               CABINET_DEPTH / 2 - HINGE_MOUNT_EMBED)
                bar('locker_mount_%02d_%d' % (index, lug), mount_start,
                    at, HINGE_MOUNT_RADIUS, 'metal_dark')


def build():
    reset()
    for kind,*args in PARTS:
        globals()[kind](*args)
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
    build_hinge_supports()
    from movable_prop_geometry import prepare_motion_groups, export_movable
    prepare_motion_groups(MOVING)
    export_movable(NAME,MOVING)

if __name__=='__main__':
    build()


# Physical contact nodes share the model build data.
if __name__ == "__main__":
    import sys as _contact_sys
    from pathlib import Path as _ContactPath
    _contact_sys.path.insert(0, str(_ContactPath(__file__).resolve().parent))
    from model_contacts import apply as _apply_contacts
    _apply_contacts(_ContactPath(__file__).resolve().parents[1] / "models" / "parcel_lockers.glb")
