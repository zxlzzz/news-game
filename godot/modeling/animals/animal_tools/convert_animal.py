"""Shared source-preserving Quaternius conversion. Blender 5.2.2 LTS."""
import sys,json,math,hashlib,argparse
from pathlib import Path
sys.dont_write_bytecode=True
import bpy,numpy as np
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
import conversion_core as core

def prepare(source,p):
 bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');obj=next(o for o in bpy.data.objects if o.type=='MESH');scene=bpy.context.scene
 rig.data.pose_position='REST';bpy.context.view_layer.update();A=Matrix.Rotation(math.radians(p['source_rotation_z_deg']),4,'Z')
 raw=[obj.matrix_world@v.co for v in obj.data.vertices];points=[A@v for v in raw]
 center=lambda names:sum((A@rig.matrix_world@rig.data.bones[n].head_local for n in names),Vector())/len(names)
 fore=center(p['front_roots']);rear=center(p['hind_roots']);split=(fore.y+rear.y)/2
 def levels(angle):
  R=Matrix.Rotation(angle,4,'X');return [min((R@x).z for x in points if (x.y<split)==front) for front in [True,False]]
 lo,hi=-.05,.05
 for _ in range(50):
  mid=(lo+hi)/2;f,h=levels(mid)
  if h-f>0:hi=mid
  else:lo=mid
 pitch=(lo+hi)/2;R=Matrix.Rotation(pitch,4,'X');pts=[R@x for x in points];floor=min(x.z for x in pts);front=R@fore
 obj.data.calc_loop_triangles();tree=BVHTree.FromPolygons(pts,[tuple(t.vertices) for t in obj.data.loop_triangles],all_triangles=True)
 hit=tree.ray_cast(Vector((front.x,front.y,100)),Vector((0,0,-1)))[0];assert hit
 factor=p['shoulder_height']/(hit.z-floor);C=Matrix.Scale(factor,4)@Matrix.Translation(Vector((-front.x,-front.y,-floor)))@R@A
 bones={b.name:{'head':rig.matrix_world@b.head_local,'tail':rig.matrix_world@b.tail_local,'parent':b.parent.name if b.parent else None,'matrix':rig.matrix_world@b.matrix_local,'deform':b.use_deform} for b in rig.data.bones}
 removed=[n for n in bones if n.startswith(('IK','PoleTarget'))];kept=[n for n in bones if n not in removed]
 weights=[{obj.vertex_groups[g.group].name:g.weight for g in v.groups if obj.vertex_groups[g.group].name in bones and g.weight>1e-8} for v in obj.data.vertices]
 removal=[{'bone':n,'weighted_vertices':sum(w.get(n,0)>1e-8 for w in weights),'weight_sum':sum(w.get(n,0) for w in weights),'merged_into':p['remapping'].get(n)} for n in removed]
 assert all(not x['weighted_vertices'] or x['merged_into'] for x in removal),'Weighted helper needs explicit target'
 rest=core.transformed(raw,C);faces=[list(f.vertices) for f in obj.data.polygons];smooth=[f.use_smooth for f in obj.data.polygons]
 fps=scene.render.fps/scene.render.fps_base;clips=[];rig.data.pose_position='POSE'
 if not rig.animation_data:rig.animation_data_create()
 for track in rig.animation_data.nla_tracks:track.mute=True
 for action in list(bpy.data.actions):
  rig.animation_data.action=action
  if action.slots:rig.animation_data.action_slot=action.slots[0]
  for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
  first,last=[int(round(x)) for x in action.frame_range];matrices=[];reference=[]
  for f in range(first,last+1):
   scene.frame_set(f);bpy.context.view_layer.update();ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
   matrices.append({n:C@ev.matrix_world@ev.pose.bones[n].matrix@Matrix.Scale(1/factor,4) for n in kept});reference.append(core.transformed(core.vertices(obj),C))
  clips.append(dict(name=action.name,first=first,last=last,fps=fps,matrices=matrices,reference=reference));print('CAPTURED',action.name,last-first+1,flush=True)
 return dict(points=rest,faces=faces,smooth=smooth,bones=bones,kept=kept,weights=weights,removed=removal,clips=clips,fps=fps,C=C,factor=factor,pitch=pitch)

def camera(scene,points,az=35,el=38):
 if not scene.camera:
  cam=bpy.data.objects.new('review_camera',bpy.data.cameras.new('review_camera'));scene.collection.objects.link(cam);scene.camera=cam
 cam=scene.camera;target=Vector((points.min(axis=0)+points.max(axis=0))/2);a,e=math.radians(az),math.radians(el);direction=Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)))
 cam.location=target+direction*5;cam.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=float(max(np.ptp(points,axis=0)))*1.55

def run(profile_path):
 p=json.loads(Path(profile_path).read_text(encoding='utf-8'));parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,default=Path(profile_path).parent);parser.add_argument('--source',type=Path,default=Path(p['source']));parser.add_argument('--preview',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 args.out.mkdir(parents=True,exist_ok=True);core.NAME=p['name'];core.REMAPPING=p['remapping'];core.REPARENT=p['reparent']
 data=prepare(args.source,p);obj,rig,actions,comparisons,mapping,loss=core.build(data)
 from silhouette import apply
 silhouette=apply(obj,rig,p["species"],args.out)
 report={'silhouette':silhouette,'action_comparison_scope':'before authorized silhouette adjustment','source':str(args.source),'source_sha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),'scale_factor':data['factor'],'ground_pitch_degrees':math.degrees(data['pitch']),'shoulder_height_m':p['shoulder_height'],'original_vertices':len(data['points']),'vertices':len(obj.data.vertices),'welded_vertices':len(data['points'])-len(obj.data.vertices),'removed_bones':data['removed'],'reparented':p['reparent'],'max_discarded_weight_fraction':loss,'actions':comparisons,'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':core.game(b.head_local),'tail':core.game(b.tail_local),'length':b.length} for b in rig.data.bones]}
 (args.out/'conversion_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
 path=args.out/(p['name']+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_skins=True,export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_step=1,export_optimize_animation_size=False,export_nla_strips=False,export_all_influences=False,export_texcoords=False,export_normals=True,export_cameras=False,export_lights=False);core.canonicalize_unit_scales(path)
 if args.preview:
  scene=core.render_setup()
  for name,az,el in [('rest_side',90,0),('rest_top',0,90),('rest_game',35,38)]:camera(scene,core.vertices(obj),az,el);core.render(args.out/(name+'.png'))
  for action,clip in zip(actions,data['clips']):
   mid=(clip['first']+clip['last'])//2;rig.animation_data.action=action;scene.frame_set(mid);bpy.context.view_layer.update();reference=clip['reference'][mid-clip['first']];camera(scene,reference,90,0);core.render(args.out/('action_'+clip['name']+'.png'))
   mesh=bpy.data.meshes.new('source');mesh.from_pydata(reference,[],data['faces']);ref=bpy.data.objects.new('source',mesh);scene.collection.objects.link(ref);mesh.materials.append(obj.data.materials[0]);obj.hide_render=True;core.render(args.out/('source_'+clip['name']+'.png'));obj.hide_render=False;bpy.data.objects.remove(ref,do_unlink=True);bpy.data.meshes.remove(mesh)
