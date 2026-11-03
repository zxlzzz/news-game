"""Build hollow props and real pivots, preserving deterministic GLB motion metadata."""
from pathlib import Path
from math import isfinite
from model_geometry import *
from model_contacts import read, write, apply


def hollow_case(name, size, center, wall, slot, open_front=False):
    w,h,d = size
    x,y,z = center
    body = box(name,size,center,slot)
    cavity_size = (w-2*wall,h-2*wall,d) if open_front else (w-2*wall,h,d-2*wall)
    cavity_center = (x,y,z+wall) if open_front else (x,y+wall,z)
    blind_cut(body,name+'_cavity',cavity_size,cavity_center)
    return body


def prepare_motion_groups(definitions):
    bpy.context.view_layer.update()
    for name,definition in definitions.items():
        objects = [bpy.data.objects.get(part) for part in definition['parts']]
        assert all(objects), (name,definition['parts'])
        anchor = bpy.data.objects.get(definition.get('pivot_part',definition['parts'][0]))
        points = [anchor.matrix_world @ Vector(v) for v in anchor.bound_box]
        low = [min(v[i] for v in points) for i in range(3)]
        high = [max(v[i] for v in points) for i in range(3)]
        a = (low[0],low[2],-high[1])
        b = (high[0],high[2],-low[1])
        pivot = [(a[i]+b[i])/2 for i in range(3)]
        if definition['pivot'] == 'left_front': pivot[0],pivot[2] = a[0],b[2]
        elif definition['pivot'] == 'back_top': pivot[1],pivot[2] = b[1],a[2]
        elif definition['pivot'] != 'center': raise ValueError(definition['pivot'])
        # Some physical hinges lie inside an edge, rather than at a box corner.
        if 'pivot_at' in definition:
            pivot = definition['pivot_at']
            assert len(pivot) == 3 and all(isfinite(v) for v in pivot), (name,pivot)
        group = bpy.data.objects.new(name,None)
        bpy.context.collection.objects.link(group)
        group.location = xyz(pivot)
        bpy.context.view_layer.update()
        for obj in objects:
            world = obj.matrix_world.copy()
            obj.parent = group
            obj.matrix_world = world


def export_movable(name,definitions):
    export(name)
    output = Path(__file__).resolve().parents[1]/'models'/f'{name}.glb'
    apply(output)
    doc,binary = read(output)
    for node_name,definition in definitions.items():
        nodes = [n for n in doc['nodes'] if n.get('name') == node_name]
        assert len(nodes)==1, (name,node_name)
        nodes[0].setdefault('extras',{})['motion'] = {
            'axis':definition['axis'],'degrees':definition['degrees']}
    write(output,doc,binary)


def annotate_motion(path, definitions):
    """Write validated motion definitions on existing real pivots, without geometry edits."""
    from model_contacts import motion_definition
    doc, binary = read(path)
    for name, definition in definitions.items():
        nodes = [node for node in doc['nodes'] if node.get('name') == name]
        if len(nodes) != 1:
            raise ValueError(f'{Path(path).stem}: missing/ambiguous moving part {name}')
        nodes[0].setdefault('extras', {})['motion'] = motion_definition(definition)
    write(path, doc, binary)


def annotate_model_motion(name):
    """Apply the independent rotation metadata declared in model-part-motions.json."""
    import json
    here = Path(__file__).resolve().parent
    config = json.loads((here / 'model-part-motions.json').read_text(encoding='utf-8'))
    definitions = {part: config['profiles'][profile]
                   for part, profile in config['models'][name].items()}
    annotate_motion(here.parent / 'models' / f'{name}.glb', definitions)


# The interactive car uses a complete shell around the unchanged driver-door
# pivot and contact surfaces. All shape dimensions live in its JSON recipe.
def build_interactive_car_shell(p):
    from vehicle_geometry import loft, side_prism
    def body_sections(stations):
        return [(z,[(-w/2,p['bottom_y']),(w/2,p['bottom_y']),
                    (w/2,top),(-w/2,top)]) for z,w,top in stations]
    box('floor',p['floor_size'],p['floor_at'],'metal')
    loft('hood',body_sections(p['hood_stations']),'metal')
    loft('boot',body_sections(p['boot_stations']),'metal')
    roof_depth=p['roof_front_z']-p['roof_rear_z']
    box('roof',(p['roof_width'],p['roof_top_y']-p['roof_bottom_y'],roof_depth),
        (0,(p['roof_top_y']+p['roof_bottom_y'])/2,
         (p['roof_front_z']+p['roof_rear_z'])/2),'metal')
    box('passenger_side',p['passenger_side_size'],p['passenger_side_at'],'metal')
    box('rear_driver_side',p['rear_driver_side_size'],p['rear_driver_side_at'],'metal')
    box('driver_sill',p['sill_size'],p['sill_at'],'metal')
    box('rear_driver_post',p['rear_post_size'],(-p['side_pane_x'],p['rear_post_y'],p['rear_post_z']),'metal')
    box('cowl_wall',p['cowl_wall_size'],p['cowl_wall_at'],'metal')
    box('rear_cabin_wall',p['rear_wall_size'],p['rear_wall_at'],'metal')
    for sign in (-1,1):
        x=sign*p['pillar_x']
        side_prism('front_pillar',p['front_pillar_profile'],p['pillar_width'],x,'metal')
        side_prism('rear_pillar',p['rear_pillar_profile'],p['pillar_width'],x,'metal')
        box('center_pillar',p['center_pillar_size'],(x,(p['belt_y']+p['roof_bottom_y'])/2,p['center_pillar_z']),'metal')
        box('cowl_side_post',p['cowl_post_size'],(sign*p['side_pane_x'],p['cowl_post_y'],p['cowl_post_z']),'metal')
    # Sloping front and rear glazing meets real roof rails, pillars and belt.
    def pane(name,surface,outward):
        points=[Vector(v) for v in surface]
        normal=(points[1]-points[0]).cross(points[2]-points[0]).normalized()
        if normal.z*outward<0: normal=-normal
        vertices=[v+normal*offset for offset in (-p['pane_inset'],p['pane_thickness']-p['pane_inset']) for v in points]
        mesh(name,vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'window')
        for index in range(4):
            bar(name+'_surround',points[index],points[(index+1)%4],p['frame_width'],'metal')
    pane('windshield',p['front_window_surface'],1)
    pane('rear_glass',p['rear_window_surface'],-1)
    for sign in (-1,1):
        x=sign*p['side_pane_x']
        side_prism('rear_side_window',p['rear_side_window_profile'],p['pane_thickness'],x,'window')
        profile=p['rear_side_window_profile']
        for index in range(len(profile)):
            a,b=profile[index],profile[(index+1)%len(profile)]
            bar('rear_side_window_surround',(x,a[1],a[0]),(x,b[1],b[0]),p['frame_width'],'metal')
    side_prism('front_quarter_window',p['front_quarter_profile'],p['pane_thickness'],-p['side_pane_x'],'window')
    box('front_quarter_divider',p['front_quarter_divider_size'],p['front_quarter_divider_at'],'metal')
    profile=p['front_quarter_profile']
    for index in range(len(profile)):
        a,b=profile[index],profile[(index+1)%len(profile)]
        bar('front_quarter_surround',(-p['side_pane_x'],a[1],a[0]),(-p['side_pane_x'],b[1],b[0]),p['frame_width'],'metal')
    side_prism('passenger_window',p['passenger_window_profile'],p['pane_thickness'],p['side_pane_x'],'window')
    profile=p['passenger_window_profile']
    for index in range(len(profile)):
        a,b=profile[index],profile[(index+1)%len(profile)]
        bar('passenger_window_surround',(p['side_pane_x'],a[1],a[0]),(p['side_pane_x'],b[1],b[0]),p['frame_width'],'metal')
    # A fixed pin in clearance bearings joins the door to the cowl. The bearing
    # solids are attached to the door mesh in finish_interactive_car_shell.
    hinge=Vector(p['hinge_at'])
    cylinder('driver_hinge_pin',p['hinge_radius'],p['hinge_pin_height'],hinge,'metal_dark')
    for offset in p['bearing_offsets_y']:
        at=hinge+Vector((0,offset,0))
        ring('driver_hinge_bearing',p['bearing_radius'],p['hinge_radius']+p['bearing_clearance'],
             p['bearing_height'],at,'metal')
    for offset in p['fixed_mount_offsets_y']:
        box('driver_hinge_mount',p['hinge_mount_size'],
            (hinge.x,hinge.y+offset,p['hinge_mount_z']),'metal')
    for index,z in enumerate(p['bumper_z']):
        box('bumper',p['bumper_size'],(0,p['bumper_y'],z),'metal_dark')
        for sign in (-1,1):
            box('lamp',p['lamp_size'],(sign*p['lamp_x'],p['lamp_y'],p['lamp_z'][index]),
                'trim_dark' if z<0 else 'accent')
    box('grille',p['grille_size'],(0,p['grille_y'],p['grille_z']),'metal_dark')


def finish_interactive_car_shell(p):
    door=bpy.data.objects['driver_panel']
    hinge=Vector(p['hinge_at'])
    # Give the fixed pin its own bore through the moving door edge, and relieve
    # the fixed cowl around both circular moving bearings through their sweep.
    cut_radius=p['hinge_radius']+p['bearing_clearance']
    cutter=cylinder('driver_pin_bore',cut_radius,p['hinge_pin_height']+p['bearing_clearance'],hinge,None)
    subtract(door,cutter,'hinge_bore')
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith('driver_hinge_bearing'):
            bpy.context.view_layer.update()
            world=obj.matrix_world.copy()
            obj.parent=door
            obj.matrix_world=world
    for offset in p['fixed_mount_offsets_y']:
        cutter=cylinder('driver_mount_relief',p['door_front_envelope_radius'],
                        p['mount_door_relief_height'],hinge+Vector((0,offset,0)),None)
        subtract(door,cutter,'mount_relief')
    for body in list(bpy.context.scene.objects):
        if body.name in {'cowl_side_post','cowl_side_post.001','front_pillar','front_pillar.001'}:
            cutter=cylinder('driver_jamb_relief',p['door_front_envelope_radius'],
                            p['jamb_relief_height'],(hinge.x,p['jamb_relief_y'],hinge.z),None)
            subtract(body,cutter,'hinge_sweep_relief')
