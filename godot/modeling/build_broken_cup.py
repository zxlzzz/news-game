"""碎杯片。原创程序模型；Blender 后台运行；输出在脚本旁。无外部脚本依赖。"""
NAME = 'broken_cup'
# All geometry dimensions and placements in metres, Y up; front +Z.
PARTS = [['mesh',
  'curved_shard',
  [(0.009999999999999995, 0, 0.0),
   (0.0021780046281077436, 0, 0.036698440775361316),
   (-0.019928345674282283, 0, 0.06701788079737735),
   (-0.052476478245953986, 0, 0.08568813074314642),
   (-0.08980880770158842, 0, 0.08946388819782683),
   (-0.12543614941398717, 0, 0.07768884299839864),
   (-0.006000000000000005, 0, 0.0),
   (-0.01243141841688919, 0, 0.030174273526408193),
   (-0.03060775088774321, 0, 0.05510359087784359),
   (-0.05736954878000661, 0, 0.07045468527769817),
   (-0.08806501966575048, 0, 0.07355919696265761),
   (-0.11735861174038946, 0, 0.06387749313201666),
   (0.009999999999999995, 0.14, 0.0),
   (0.0021780046281077436, 0.14, 0.036698440775361316),
   (-0.019928345674282283, 0.14, 0.06701788079737735),
   (-0.052476478245953986, 0.14, 0.08568813074314642),
   (-0.08980880770158842, 0.14, 0.08946388819782683),
   (-0.12543614941398717, 0.14, 0.07768884299839864),
   (-0.006000000000000005, 0.14, 0.0),
   (-0.01243141841688919, 0.14, 0.030174273526408193),
   (-0.03060775088774321, 0.14, 0.05510359087784359),
   (-0.05736954878000661, 0.14, 0.07045468527769817),
   (-0.08806501966575048, 0.14, 0.07355919696265761),
   (-0.11735861174038946, 0.14, 0.06387749313201666)],
  [(0, 1, 13, 12),
   (6, 18, 19, 7),
   (0, 6, 7, 1),
   (12, 13, 19, 18),
   (1, 2, 14, 13),
   (7, 19, 20, 8),
   (1, 7, 8, 2),
   (13, 14, 20, 19),
   (2, 3, 15, 14),
   (8, 20, 21, 9),
   (2, 8, 9, 3),
   (14, 15, 21, 20),
   (3, 4, 16, 15),
   (9, 21, 22, 10),
   (3, 9, 10, 4),
   (15, 16, 22, 21),
   (4, 5, 17, 16),
   (10, 22, 23, 11),
   (4, 10, 11, 5),
   (16, 17, 23, 22),
   (0, 12, 18, 6),
   (5, 11, 23, 17)],
  'trim'],
 ['mesh',
  'curved_shard',
  [(0.06746855596228479, 0, 0.0803361929831885),
   (0.06701927906784515, 0, 0.04158261816707273),
   (0.08382127956226325, 0, 0.006657925038260022),
   (0.11438150546959977, 0, -0.017177217152394467),
   (0.15234663847360796, 0, -0.02496760140120577),
   (0.18982391706053206, 0, -0.015093645736213024),
   (0.08300388660467824, 0, 0.07650820371576479),
   (0.0826391794786037, 0, 0.0450494194532708),
   (0.09627845046819017, 0, 0.016698786207528724),
   (0.12108616326355745, 0, -0.002649740982531984),
   (0.15190491829034058, 0, -0.008973699960978798),
   (0.18232765031972603, 0, -0.0009583712446905729),
   (0.06746855596228479, 0.075, 0.0803361929831885),
   (0.06701927906784515, 0.075, 0.04158261816707273),
   (0.08382127956226325, 0.075, 0.006657925038260022),
   (0.11438150546959977, 0.075, -0.017177217152394467),
   (0.15234663847360796, 0.075, -0.02496760140120577),
   (0.18982391706053206, 0.075, -0.015093645736213024),
   (0.08300388660467824, 0.075, 0.07650820371576479),
   (0.0826391794786037, 0.075, 0.0450494194532708),
   (0.09627845046819017, 0.075, 0.016698786207528724),
   (0.12108616326355745, 0.075, -0.002649740982531984),
   (0.15190491829034058, 0.075, -0.008973699960978798),
   (0.18232765031972603, 0.075, -0.0009583712446905729)],
  [(0, 1, 13, 12),
   (6, 18, 19, 7),
   (0, 6, 7, 1),
   (12, 13, 19, 18),
   (1, 2, 14, 13),
   (7, 19, 20, 8),
   (1, 7, 8, 2),
   (13, 14, 20, 19),
   (2, 3, 15, 14),
   (8, 20, 21, 9),
   (2, 8, 9, 3),
   (14, 15, 21, 20),
   (3, 4, 16, 15),
   (9, 21, 22, 10),
   (3, 9, 10, 4),
   (15, 16, 22, 21),
   (4, 5, 17, 16),
   (10, 22, 23, 11),
   (4, 10, 11, 5),
   (16, 17, 23, 22),
   (0, 12, 18, 6),
   (5, 11, 23, 17)],
  'trim'],
 ['mesh',
  'curved_shard',
  [(0.044625312395851935, 0, 0.20748750624851212),
   (0.037856374741497265, 0, 0.23194545987994997),
   (0.023318515350920804, 0, 0.2527459564400308),
   (0.002676183470753407, 0, 0.2675075331632379),
   (-0.02170726651349478, 0, 0.2745401272558734),
   (-0.04704015710198153, 0, 0.27303857231586465),
   (0.02870524575140352, 0, 0.20589017158216288),
   (0.023380348129977843, 0, 0.22513042843889397),
   (0.01194389874272437, 0, 0.2414934857328242),
   (-0.004294735669673987, 0, 0.2531059260884138),
   (-0.023476382990615892, 0, 0.25863823344128706),
   (-0.04340492358689214, 0, 0.2574570102218135),
   (0.044625312395851935, 0.055, 0.20748750624851212),
   (0.037856374741497265, 0.055, 0.23194545987994997),
   (0.023318515350920804, 0.055, 0.2527459564400308),
   (0.002676183470753407, 0.055, 0.2675075331632379),
   (-0.02170726651349478, 0.055, 0.2745401272558734),
   (-0.04704015710198153, 0.055, 0.27303857231586465),
   (0.02870524575140352, 0.055, 0.20589017158216288),
   (0.023380348129977843, 0.055, 0.22513042843889397),
   (0.01194389874272437, 0.055, 0.2414934857328242),
   (-0.004294735669673987, 0.055, 0.2531059260884138),
   (-0.023476382990615892, 0.055, 0.25863823344128706),
   (-0.04340492358689214, 0.055, 0.2574570102218135)],
  [(0, 1, 13, 12),
   (6, 18, 19, 7),
   (0, 6, 7, 1),
   (12, 13, 19, 18),
   (1, 2, 14, 13),
   (7, 19, 20, 8),
   (1, 7, 8, 2),
   (13, 14, 20, 19),
   (2, 3, 15, 14),
   (8, 20, 21, 9),
   (2, 8, 9, 3),
   (14, 15, 21, 20),
   (3, 4, 16, 15),
   (9, 21, 22, 10),
   (3, 9, 10, 4),
   (15, 16, 22, 21),
   (4, 5, 17, 16),
   (10, 22, 23, 11),
   (4, 10, 11, 5),
   (16, 17, 23, 22),
   (0, 12, 18, 6),
   (5, 11, 23, 17)],
  'trim'],
 ['cylinder', 'cup_bottom', 0.072, 0.014, (-0.22, 0.007, 0.17), 'trim', (0, 1, 0), None],
 ['ring', 'detached_handle', 0.058, 0.038, 0.02, (-0.23, 0.015, -0.13), 'trim', (0, 1, 0)]]
GRIPS = {}

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
    export(NAME)

if __name__=='__main__':
    build()
