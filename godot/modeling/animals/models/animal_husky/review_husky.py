"""Static, unexported deformation tests and size reference. Called by --preview."""
import json,math
import bpy
import numpy as np
from mathutils import Matrix,Vector

def reviews(obj,rig,out,camera,render,vertices):
 scene=bpy.context.scene
 def reset():
  rig.animation_data.action=None
  for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
  bpy.context.view_layer.update()
 def aim(name,direction):
  pb=rig.pose.bones[name];m=pb.matrix.copy();q=m.to_3x3().col[1].normalized().rotation_difference(Vector(direction).normalized())
  pb.matrix=Matrix.Translation(m.translation)@q.to_matrix().to_4x4()@Matrix.Translation(-m.translation)@m
  bpy.context.view_layer.update()
 def turn(name,axis,degrees):
  pb=rig.pose.bones[name];m=pb.matrix.copy();pb.matrix=Matrix.Translation(m.translation)@Matrix.Rotation(math.radians(degrees),4,axis)@Matrix.Translation(-m.translation)@m
  bpy.context.view_layer.update()
 def shift(z):
  m=rig.pose.bones['Body'].matrix.copy();m.translation.z+=z;rig.pose.bones['Body'].matrix=m;bpy.context.view_layer.update()
 def paws(side,hind=False):aim(('FFB.' if hind else 'FF.')+side,(0,-1,-.04))
 records={}
 for pose in ['sit','sphinx','side_lie','hind_leg_lift','sniff_left45','tail_high','tail_down']:
  reset();az,el=65,16
  if pose=='sit':
   # Use the same corrected seated legs as the delivered animation library.
   import importlib.util
   from pathlib import Path
   folder=Path(__file__).resolve().parents[2]/'motions/husky_motion_library'
   spec=importlib.util.spec_from_file_location('husky_authored_review',folder/'build_motions.py');motion=importlib.util.module_from_spec(spec);spec.loader.exec_module(motion)
   cfg=json.loads((folder/'motion_specs.json').read_text(encoding='utf-8'));rr=motion.Rig(motion.GLB(out/'animal_husky.glb'))
   clip=next(c for c in cfg['clips'] if c['name']=='NG_Sit_Idle');motion.sample(rr,clip,0,cfg['tuning'])
   for name in sorted(rr.names,key=lambda n:len(rig.data.bones[n].parent_recursive)):
    rig.pose.bones[name].matrix=Matrix(rr.world[rr.index[name]].tolist());bpy.context.view_layer.update()
   az,el=90,0
  elif pose=='sphinx':
   shift(-.255);az,el=90,0
   for side,sgn in [('L',1),('R',-1)]:
    aim('FrontUpperLeg.'+side,(sgn*.08,.7,-.5));aim('FrontLowerLeg.'+side,(0,-1,-.02));paws(side)
    aim('BackLeg.'+side,(sgn*.6,-.8,-.7));aim('BackUpperLeg.'+side,(sgn*.12,1,-.04));aim('BackLowerLeg.'+side,(0,-1,-.04));paws(side,True)
  elif pose=='side_lie':
   turn('Body','Y',90);az,el=35,55
  elif pose=='hind_leg_lift':
   aim('BackLeg.L',(1,-.3,.12));aim('BackUpperLeg.L',(.7,.5,-.4));aim('BackLowerLeg.L',(.4,-.7,-.4));paws('L',True);az,el=35,38
  elif pose=='sniff_left45':
   # Start from the authored eating crouch; additional turn is applied manually.
   action=bpy.data.actions['Eating'];rig.animation_data.action=action;scene.frame_set(40);bpy.context.view_layer.update()
   basis={p.name:p.matrix_basis.copy() for p in rig.pose.bones};rig.animation_data.action=None
   for n,m in basis.items():rig.pose.bones[n].matrix_basis=m
   bpy.context.view_layer.update();turn('Neck1','Z',45);az,el=35,38
  elif pose=='tail_high':
   for i in range(1,7):aim('Tail'+str(i),(.2,.15,1))
   az,el=70,15
  elif pose=='tail_down':
   for i in range(1,7):aim('Tail'+str(i),(0,.3,-1))
   az,el=90,0
  shift(-float(vertices(obj)[:,2].min()))
  points=vertices(obj)
  records[pose]={'bounds_min_blender':points.min(axis=0).tolist(),'bounds_max_blender':points.max(axis=0).tolist(),'bone_basis':{p.name:[list(row) for row in p.matrix_basis] for p in rig.pose.bones}}
  camera(scene,az,el)
  center=Vector((points.min(axis=0)+points.max(axis=0))/2);cam=scene.camera
  cam.location+=center-Vector((0,.23,.37))
  render(out/('test_'+pose+'.png'))
 (out/'test_pose_matrices.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
 reset()
 # Individual size reference; shared comparison is in delivery/animals_comparison.png.
 bpy.ops.mesh.primitive_cube_add(size=1,location=(-.5,.23,.87));bar=bpy.context.object;bar.name='height_reference_1_74m';bar.dimensions=(.025,.025,1.74);bar.data.materials.append(obj.data.materials[0])
 camera(scene,35,38);cam=scene.camera;target=Vector((-.15,.22,.80));direction=(cam.location-Vector((0,.23,.37))).normalized();cam.location=target+direction*5;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.15
 render(out/'size_comparison.png');bpy.data.objects.remove(bar,do_unlink=True)
