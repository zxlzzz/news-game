"""原创程序模型；米，Y向上、正面+Z；Blender后台独立重建。"""
NAME = 'park_gazebo'
SIDES = 6
BASE_RADIUS = 2.45
BASE_HEIGHT = 0.18
COLUMN_RADIUS = 0.095
COLUMN_RING = 2.0
COLUMN_HEIGHT = 2.35
EAVE_RADIUS = 2.65
EAVE_Y = 2.55
ROOF_PEAK_Y = 3.80
ROOF_THICKNESS = 0.10
BENCH_HEIGHT = 0.48
BENCH_WIDTH = 0.34
BENCH_THICKNESS = 0.10
RAIL_HEIGHT = 0.85
RAIL_RADIUS = 0.045
ENTRY_EDGE = 1

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
        obj=box(name+'_'+str(i),(width,thickness,d.length+thickness), (Vector(a)+Vector(b))/2,slot)
        obj.rotation_mode='QUATERNION'
        obj.rotation_quaternion=Vector((0,1,0)).rotation_difference(xyz(d).normalized())

def ground_all():
    bpy.context.view_layer.update()
    low=min((o.matrix_world@v.co).z for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices)
    for o in bpy.context.scene.objects:
        if o.parent is None:o.location.z-=low


def build():
    reset()
    global CIRCLE_SEGMENTS
    CIRCLE_SEGMENTS = SIDES
    cylinder('hexagonal_base',BASE_RADIUS,BASE_HEIGHT,(0,BASE_HEIGHT/2,0),'concrete')
    corners=[Vector((COLUMN_RING*cos(i*2*pi/SIDES),BASE_HEIGHT,COLUMN_RING*sin(i*2*pi/SIDES))) for i in range(SIDES)]
    CIRCLE_SEGMENTS = 16
    for p in corners:
        cylinder('column',COLUMN_RADIUS,COLUMN_HEIGHT,p+Vector((0,COLUMN_HEIGHT/2,0)),'wood')
    # Two complete hexagonal pyramids form a closed sloped roof with a solid eave.
    vertices=[(EAVE_RADIUS*cos(i*2*pi/SIDES),EAVE_Y+y,EAVE_RADIUS*sin(i*2*pi/SIDES)) for y in (0,ROOF_THICKNESS) for i in range(SIDES)]
    vertices += [(0,ROOF_PEAK_Y,0),(0,ROOF_PEAK_Y+ROOF_THICKNESS,0)]
    faces=[]
    for i in range(SIDES):
        j=(i+1)%SIDES
        faces += [(i,j,j+SIDES,i+SIDES),(i,2*SIDES,j),(i+SIDES,j+SIDES,2*SIDES+1)]
    mesh('pitched_hexagonal_roof',vertices,faces,'wood')
    for i,a in enumerate(corners):
        b=corners[(i+1)%SIDES]
        bar('eave_beam',a+Vector((0,COLUMN_HEIGHT,0)),b+Vector((0,COLUMN_HEIGHT,0)),RAIL_RADIUS,'wood')
        if i==ENTRY_EDGE:
            continue
        mid=(a+b)/2
        length=(b-a).length
        bench=box('bench',(length,BENCH_THICKNESS,BENCH_WIDTH),(mid.x,BENCH_HEIGHT,mid.z),'wood')
        rotate(bench,-__import__('math').degrees(__import__('math').atan2((b-a).z,(b-a).x)))
        bar('low_railing',(a.x,RAIL_HEIGHT,a.z),(b.x,RAIL_HEIGHT,b.z),RAIL_RADIUS,'wood')
        for t in (0.25,0.5,0.75):
            p=a.lerp(b,t)
            bar('railing_spindle',(p.x,BASE_HEIGHT,p.z),(p.x,RAIL_HEIGHT,p.z),RAIL_RADIUS/2,'wood')
    export(NAME)

if __name__ == "__main__":
    build()
