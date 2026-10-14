"""One continuous receiver housing shared by the held prop and its cradle.

All dimensions and the grip profile belong to the JSON recipe. Joining the rear
grip into the end housings removes internal outlines on their front contact faces.
"""
from model_geometry import bpy, mesh, cylinder


def receiver_shell(name,p):
    body=mesh(name,p['grip_vertices'],p['grip_faces'],p['slot'])
    for center in p['end_centers']:
        end=cylinder(name+'_end',p['end_radius'],p['end_depth'],center,p['slot'],axis=(0,0,1))
        bpy.context.view_layer.objects.active=body
        modifier=body.modifiers.new('continuous_end_housing','BOOLEAN')
        modifier.operation,modifier.solver,modifier.object='UNION','EXACT',end
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(end,do_unlink=True)
    return body
