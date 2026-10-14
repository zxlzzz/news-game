"""Deterministic original prop; metres, Y up and +Z front.
Shape parameters are declared below; runtime supplies grayscale/outline style.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
from model_contacts import apply
from movable_prop_geometry import annotate_motion

NAME='held_mop'
P=dict(shaft_radius=.018,shaft_height=1.35,shaft_y=-.05,
       clip_size=(.34,.035,.16),clip_at=(0,-.8225,0),pad_size=(.37,.035,.195),pad_at=(0,-.8575,0),
       joint_radius=.035,joint_y=-.740,socket_inner=.0357,socket_outer=.042,
       socket_rings=8,socket_around=32,stem_radius=.020,stem_embed=.003,
       socket_relief_size=(.044,.028,.110),socket_relief_y=.006,
       joint_degrees=65.0,joint_axis=(1,0,0))

def socket_shell():
    """Closed lower spherical socket, with a real open upper rim for its ball."""
    around=P['socket_around'];rings=P['socket_rings']
    vertices=[]
    for radius in (P['socket_outer'],P['socket_inner']):
        for ring in range(rings):
            angle=pi/2+ring*pi/(2*rings)
            for index in range(around):
                azimuth=index*2*pi/around
                vertices.append((radius*sin(angle)*cos(azimuth),P['joint_y']+radius*cos(angle),radius*sin(angle)*sin(azimuth)))
        vertices.append((0,P['joint_y']-radius,0))
    shell_size=rings*around+1
    faces=[]
    for shell in range(2):
        offset=shell*shell_size
        for ring in range(rings-1):
            for index in range(around):
                nxt=(index+1)%around
                face=(offset+ring*around+index,offset+ring*around+nxt,offset+(ring+1)*around+nxt,offset+(ring+1)*around+index)
                faces.append(face if shell==0 else face[::-1])
        for index in range(around):
            face=(offset+(rings-1)*around+index,offset+(rings-1)*around+(index+1)%around,offset+shell_size-1)
            faces.append(face if shell==0 else face[::-1])
    for index in range(around):
        nxt=(index+1)%around
        faces.append((index,shell_size+index,shell_size+nxt,nxt))
    shell=mesh('head_socket',vertices,faces,'metal')
    # The shaft sweeps through the front/back upper rim at both tilt limits.
    # A real relief slot leaves both side cheeks and the lower cup connected.
    blind_cut(shell,'shaft_sweep_relief',P['socket_relief_size'],
              (0,P['joint_y']+P['socket_relief_y'],0))
    return shell

def build():
    reset()
    cylinder('handle',P['shaft_radius'],P['shaft_height'],(0,P['shaft_y'],0),'wood')
    ellipsoid('shaft_ball',(P['joint_radius']*2,)*3,(0,P['joint_y'],0),'metal')
    parts=[socket_shell()]
    stem_bottom=P['clip_at'][1]+P['clip_size'][1]/2-P['stem_embed']
    stem_top=P['joint_y']-P['socket_outer']+P['stem_embed']
    parts.append(cylinder('head_stem',P['stem_radius'],stem_top-stem_bottom,(0,(stem_top+stem_bottom)/2,0),'metal'))
    parts.append(box('mop_clip',P['clip_size'],P['clip_at'],'metal'))
    parts.append(box('cloth_pad',P['pad_size'],P['pad_at'],'fabric'))
    head=bpy.data.objects.new('MopHead',None)
    bpy.context.collection.objects.link(head)
    head.location=xyz((0,P['joint_y'],0))
    bpy.context.view_layer.update()
    for part in parts:
        world=part.matrix_world.copy()
        part.parent=head
        part.matrix_world=world
    export(NAME)


if __name__=='__main__':
    build()
    output=Path(__file__).resolve().parents[1]/'models'/f'{NAME}.glb'
    apply(output)
    annotate_motion(output,{'MopHead':{'axis':P['joint_axis'],'degrees':(-P['joint_degrees'],P['joint_degrees'])}})
