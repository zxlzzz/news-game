"""原创程序模型；米，Y向上、正面+Z；Blender后台独立重建。"""
NAME = 'building_under_construction'
COLUMN_X = [-5,0,5]
COLUMN_Z = [0,-4,-8]
HEIGHT = 13.2
COLUMN_WIDTH = 0.38
FLOOR_Y = [0.10,3.30,6.50,9.70,12.90]
FLOOR_SIZE = (10.4,0.20,8.4)
FRONT_X = [-5.6,-3.36,-1.12,1.12,3.36,5.6]
SIDE_Z = [1.1,-1.3,-3.7,-6.1,-8.5]
DECK_Y = [2.6,5.2,7.8,10.4,13.0]
TUBE_RADIUS = 0.045
BRACE_RADIUS = 0.025
FRONT_INNER_Z = 0.38
FRONT_OUTER_Z = 1.1
SIDE_INNER_X = 5.25
SIDE_OUTER_X = 6.0
DECK_THICKNESS = 0.08
NET_THICKNESS = 0.025
NET_GAP = 0.42
NET_TOP_Y = 7.8
NET_VERTICAL_GAP = 0.36
NET_INSET = 0.18
ROOF_Y = 13.0
MATERIAL_STACK_CENTER = (-2.1,-4.2)
STACK_BEAM_SIZE = (3.1,0.18,0.22)
STACK_BEAM_SPACING = 0.32
STACK_LAYERS = 4
STACK_WIDTH_COUNT = 5
CRANE_BASE = (2.4,13.20,-3.8)
CRANE_BASE_SIZE = (1.35,0.40,1.35)
CRANE_MAST_HEIGHT = 2.35
CRANE_MAST_WIDTH = 0.22
CRANE_ARM_LENGTH = 4.3
CRANE_ARM_RISE = 1.5
CRANE_ARM_RADIUS = 0.075
CRANE_CABLE_RADIUS = 0.025
CRANE_HOOK_DROP = 1.9
CRANE_HOOK_SIZE = (0.22,0.26,0.18)
NET_LEVEL_HEIGHT = 2.6
FENCE_HEIGHT = 1.9
FENCE_Z = 1.4
FENCE_THICKNESS = 0.08

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
    for x in COLUMN_X:
        for z in COLUMN_Z:
            box('concrete_column',(COLUMN_WIDTH,HEIGHT,COLUMN_WIDTH),(x,HEIGHT/2,z),'concrete')
    for y in FLOOR_Y:
        box('floor_slab',FLOOR_SIZE,(0,y,-4),'concrete')
    for x in FRONT_X:
        for z in (FRONT_INNER_Z,FRONT_OUTER_Z):
            bar('front_upright',(x,0,z),(x,HEIGHT,z),TUBE_RADIUS,'metal')
    for z in SIDE_Z:
        for x in (SIDE_INNER_X,SIDE_OUTER_X):
            bar('side_upright',(x,0,z),(x,HEIGHT,z),TUBE_RADIUS,'metal')
    for y in DECK_Y:
        box('front_walkway',(FRONT_X[-1]-FRONT_X[0],DECK_THICKNESS,FRONT_OUTER_Z-FRONT_INNER_Z),(0,y,(FRONT_INNER_Z+FRONT_OUTER_Z)/2),'wood')
        box('side_walkway',(SIDE_OUTER_X-SIDE_INNER_X,DECK_THICKNESS,SIDE_Z[0]-SIDE_Z[-1]),((SIDE_OUTER_X+SIDE_INNER_X)/2,y,(SIDE_Z[0]+SIDE_Z[-1])/2),'wood')
        for z in (FRONT_INNER_Z,FRONT_OUTER_Z):
            bar('front_horizontal',(FRONT_X[0],y,z),(FRONT_X[-1],y,z),TUBE_RADIUS,'metal')
        for x in (SIDE_INNER_X,SIDE_OUTER_X):
            bar('side_horizontal',(x,y,SIDE_Z[-1]),(x,y,SIDE_Z[0]),TUBE_RADIUS,'metal')
        for a,b in zip(FRONT_X,FRONT_X[1:]):
            if y <= NET_TOP_Y:
                box('front_safety_net',(b-a-NET_GAP,NET_LEVEL_HEIGHT-NET_VERTICAL_GAP,NET_THICKNESS),((a+b)/2,y-NET_LEVEL_HEIGHT/2,FRONT_OUTER_Z-NET_INSET),'fabric')
            bar('front_diagonal',(a,y-NET_LEVEL_HEIGHT,FRONT_OUTER_Z),(b,y,FRONT_OUTER_Z),BRACE_RADIUS,'metal_dark')
        for a,b in zip(SIDE_Z,SIDE_Z[1:]):
            if y <= NET_TOP_Y:
                box('side_safety_net',(NET_THICKNESS,NET_LEVEL_HEIGHT-NET_VERTICAL_GAP,a-b-NET_GAP),(SIDE_OUTER_X-NET_INSET,y-NET_LEVEL_HEIGHT/2,(a+b)/2),'fabric')
            bar('side_diagonal',(SIDE_OUTER_X,y-NET_LEVEL_HEIGHT,a),(SIDE_OUTER_X,y,b),BRACE_RADIUS,'metal_dark')
    for a,b in zip(FRONT_X,FRONT_X[1:]):
        box('continuous_street_fence',(b-a,FENCE_HEIGHT,FENCE_THICKNESS),((a+b)/2,FENCE_HEIGHT/2,FENCE_Z),'metal_dark')
        bar('fence_post',(a,0,FENCE_Z),(a,FENCE_HEIGHT,FENCE_Z),TUBE_RADIUS,'metal')
    for layer in range(STACK_LAYERS):
        for col in range(STACK_WIDTH_COUNT):
            box('stacked_roof_lumber',STACK_BEAM_SIZE,(MATERIAL_STACK_CENTER[0],ROOF_Y+(layer+0.5)*STACK_BEAM_SIZE[1],MATERIAL_STACK_CENTER[1]+(col-(STACK_WIDTH_COUNT-1)/2)*STACK_BEAM_SPACING),'wood')
    base=Vector(CRANE_BASE)
    box('roof_hoist_base',CRANE_BASE_SIZE,base,'metal_dark')
    mast_bottom=base+Vector((0,CRANE_BASE_SIZE[1]/2,0))
    mast_top=mast_bottom+Vector((0,CRANE_MAST_HEIGHT,0))
    box('hoist_mast',(CRANE_MAST_WIDTH,CRANE_MAST_HEIGHT,CRANE_MAST_WIDTH),(mast_bottom+mast_top)/2,'metal')
    tip=mast_top+Vector((CRANE_ARM_LENGTH,CRANE_ARM_RISE,0))
    bar('lifting_arm',mast_top,tip,CRANE_ARM_RADIUS,'metal')
    bar('arm_brace',mast_bottom+Vector((0,CRANE_MAST_HEIGHT/2,0)),tip,CRANE_ARM_RADIUS,'metal')
    hook=tip-Vector((0,CRANE_HOOK_DROP,0))
    bar('hanging_cable',tip,hook,CRANE_CABLE_RADIUS,'metal_dark')
    box('hook_block',CRANE_HOOK_SIZE,hook,'metal_dark')
    ground_all()
    export(NAME)

if __name__ == "__main__":
    build()
