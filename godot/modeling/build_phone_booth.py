"""电话亭. Original procedural model; metres, +Y up, +Z front.
Run with Blender --background --factory-startup --python this_file.
Keep model_geometry.py (and building_geometry.py for buildings) beside this file.
"""
import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_geometry import *

# All design dimensions/placements are collected here (metres unless named otherwise).
P = {'width': 1.15,
 'depth': 1.05,
 'height': 2.35,
 'post': 0.09,
 'cap_h': 0.22,
 'panel_h': 1.65,
 'panel_bottom': 0.25,
 'panel_t': 0.03,
 'phone': (0.27, 0.42, 0.15),
 'phone_y': 1.3,
 'cradle_width':.09,'cradle_shelf_t':.015,'cradle_front_clearance':.025,
 'cradle_embed':.005,'cradle_back_clearance':.010,'cradle_back_t':.012,
 'cradle_lip_t':.008,'cradle_lip_h':.030,'cradle_top_strut_h':.012,
 'cradle_fork_steps':(3,4,5),
 'key_size':(.019,.021,.008),'key_x':(.005,.040,.075),'key_y':(-.075,-.03,.015,.06),
 'display_size':(.10,.045,.008),'display_y':.15,'cord_radius':.004,'cord_drop':.28,
 'socket_outer':.013,'socket_inner':.005,'socket_depth':.020,'socket_offset':.005,'cord_entry_depth':.028}

def build():
    reset()
    post_h=P['height']-P['cap_h']
    for x in (-P['width']/2,P['width']/2):
        for z in (-P['depth']/2,P['depth']/2):
            box('corner_post',(P['post'],post_h,P['post']),(x,post_h/2,z),'metal')
    box('roof',(P['width']+P['post'],P['cap_h'],P['depth']+P['post']),(0,P['height']-P['cap_h']/2,0),'metal_dark')
    box('back_panel',(P['width']-P['post'],P['panel_h'],P['panel_t']),(0,P['panel_bottom']+P['panel_h']/2,-P['depth']/2),'window')
    for x in (-P['width']/2,P['width']/2):
        box('side_panel',(P['panel_t'],P['panel_h'],P['depth']-P['post']),(x,P['panel_bottom']+P['panel_h']/2,0),'window')
    center_z=-P['depth']/2+P['panel_t']/2+P['phone'][2]/2
    box('telephone',P['phone'],(0,P['phone_y'],center_z),'metal')
    face_z=center_z+P['phone'][2]/2
    # The removable receiver uses the exact held prop, with one physical grasp
    # frame. Runtime transfers replace this entire group instead of duplicating
    # a second fixed receiver and cord on the cradle.
    here=Path(__file__).resolve().parent
    contact=json.loads((here/'model-contacts.json').read_text(encoding='utf-8'))['models']['phone_booth']
    receiver_at=contact['receiver_rest']['at']
    definitions=json.loads((here/'interaction-props.json').read_text(encoding='utf-8'))['held_telephone_receiver']
    receiver=[]
    import model_geometry as geometry
    for kind,*args in definitions:
        if kind=='receiver_shell':
            from receiver_geometry import receiver_shell
            part=receiver_shell(*args)
        else:
            part=getattr(geometry,kind)(*args)
        part.location+=xyz(receiver_at)
        receiver.append(part)
    bpy.context.view_layer.update()
    vertices=[part.matrix_world@Vector(v) for part in receiver for v in part.bound_box]
    low_y=min(v.z for v in vertices)
    high_y=max(v.z for v in vertices)
    back_z=min(-v.y for v in vertices)
    front_z=max(-v.y for v in vertices)
    # Suspend the unchanged receiver by the upper cup. The two forks follow
    # its actual 32-sided lower contour and connect to a rear mounting plate;
    # the lower cup and handle remain accessible from below during pickup.
    shell=next(args[1] for kind,*args in definitions if kind=='receiver_shell')
    upper=max(shell['end_centers'],key=lambda point:point[1])
    cup_x=receiver_at[0]+upper[0]
    cup_y=receiver_at[1]+upper[1]
    radius=shell['end_radius']
    cup_front=receiver_at[2]+upper[2]+shell['end_depth']/2
    base_y=cup_y-radius-P['cradle_top_strut_h']
    guide_front=back_z-P['cradle_back_clearance']
    mount_back=face_z-P['cradle_embed']
    box('receiver_cradle_mount',(P['cradle_width'],P['cradle_top_strut_h'],guide_front-mount_back),
        (receiver_at[0],base_y-P['cradle_top_strut_h']/2,(guide_front+mount_back)/2),'metal_dark')
    box('receiver_cradle_back',(P['cradle_width'],high_y-base_y,P['cradle_back_t']),
        (receiver_at[0],(high_y+base_y)/2,guide_front-P['cradle_back_t']/2),'metal_dark')
    steps=P['cradle_fork_steps']
    fork_depth=cup_front-guide_front
    for side,label in ((-1,'left'),(1,'right')):
        contour=[(side*radius*sin(2*pi*step/CIRCLE_SEGMENTS),
                  cup_y-radius*cos(2*pi*step/CIRCLE_SEGMENTS)) for step in steps]
        for index,(first,last) in enumerate(zip(contour,contour[1:])):
            outline=[first,last,(last[0],base_y),(first[0],base_y)]
            prism('receiver_cradle_fork_'+label+'_'+str(index),outline,fork_depth,
                  (cup_x,0,(cup_front+guide_front)/2),'metal_dark')
        lip_x=(contour[0][0]+contour[-1][0])/2
        lip_width=abs(contour[-1][0]-contour[0][0])
        lip_front=front_z+P['cradle_front_clearance']
        # A connected forward stop only beside the upper cup, above the grip.
        lip_depth=lip_front-cup_front
        box('receiver_cradle_lip_'+label,(lip_width,P['cradle_lip_h'],lip_depth),
            (cup_x+lip_x,base_y+P['cradle_lip_h']/2,(cup_front+lip_front)/2),'metal_dark')
    for x in P['key_x']:
        for y in P['key_y']:box('dial_key',P['key_size'],(x,P['phone_y']+y,face_z+P['key_size'][2]/2),'metal_dark')
    box('phone_display',P['display_size'],(P['key_x'][1],P['phone_y']+P['display_y'],face_z+P['display_size'][2]/2),'window')
    cord_local=json.loads((here/'model-contacts.json').read_text(encoding='utf-8'))['models']['held_telephone_receiver']['cord_end']['at']
    bottom=tuple(a+b for a,b in zip(receiver_at,cord_local))
    socket=contact['cord_socket']['at']
    ring('cord_socket_surround',P['socket_outer'],P['socket_inner'],P['socket_depth'],
        (socket[0],socket[1],socket[2]+P['socket_offset']),'metal_dark',axis=(0,0,1))
    plug_tip=(socket[0],socket[1],socket[2]+P['cord_entry_depth'])
    # The exposed side plug keeps the hanging cord beside the lower-cup palm.
    hanging=(bottom[0],P['phone_y']-P['cord_drop'],bottom[2])
    receiver.append(bar('receiver_cord',bottom,hanging,P['cord_radius'],'metal_dark'))
    receiver.append(bar('cord_return',hanging,plug_tip,P['cord_radius'],'metal_dark'))
    receiver.append(bar('cord_entry',plug_tip,socket,P['cord_radius'],'metal_dark'))
    group=bpy.data.objects.new('receiver_on_cradle',None)
    bpy.context.collection.objects.link(group)
    group.location=xyz(receiver_at)
    bpy.context.view_layer.update()
    for part in receiver:
        world=part.matrix_world.copy()
        part.parent=group
        part.matrix_world=world
    export('phone_booth')

if __name__ == '__main__':
    build()


# Physical contact nodes share the model build data.
if __name__ == "__main__":
    import sys as _contact_sys
    from pathlib import Path as _ContactPath
    _contact_sys.path.insert(0, str(_ContactPath(__file__).resolve().parent))
    from model_contacts import apply as _apply_contacts
    _apply_contacts(_ContactPath(__file__).resolve().parents[1] / "models" / "phone_booth.glb")
