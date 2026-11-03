"""Convert the unmodified CC0 Husky.blend; Blender 5.2.2 background.
Visual-key baking is sampled before deleting IK. No remeshing or subdivision.
"""
import argparse,hashlib,json,math,sys,itertools,struct
sys.dont_write_bytecode=True
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix,Vector,Quaternion
from mathutils.bvhtree import BVHTree
SOURCE=Path('D:/Godot/assets/quaternius-ultimate-animals/Blends/Husky.blend')
NAME='animal_husky'
SHOULDER_HEIGHT=.55
MAX_INFLUENCES=4
RESOLUTION=800
BACKGROUND=(.68,.68,.68)
REMAPPING={'IKFrontLeg.L':'FF.L','IKFrontLeg.R':'FF.R','IKBackLeg.L':'FFB.L','IKBackLeg.R':'FFB.R'}
REPARENT={'FF.L':'FrontLowerLeg.L','FF.R':'FrontLowerLeg.R','FFB.L':'BackLowerLeg.L','FFB.R':'BackLowerLeg.R'}

def game(p):return [float(p.x),float(p.z),float(-p.y)]
def black():
 m=bpy.data.materials.new('animal_ink');m.diffuse_color=(0,0,0,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(0,0,0,1);bs.inputs['Roughness'].default_value=1
 return m

def camera(scene,az=90,el=0):
 cam=scene.camera
 if cam is None:
  cam=bpy.data.objects.new('review_camera',bpy.data.cameras.new('review_camera'));scene.collection.objects.link(cam);scene.camera=cam
 target=Vector((0,.23,.37));a,e=math.radians(az),math.radians(el)
 direction=Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)))
 cam.location=target+direction*5;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.35

def render_setup():
 s=bpy.context.scene;s.render.engine='BLENDER_WORKBENCH';s.display.shading.light='FLAT';s.display.shading.color_type='MATERIAL';s.display.shading.show_shadows=False;s.display.shading.show_cavity=False;s.display.shading.show_specular_highlight=False;s.display.shading.background_type='WORLD';s.world.color=BACKGROUND
 s.view_settings.view_transform='Standard';s.render.resolution_x=s.render.resolution_y=RESOLUTION;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.film_transparent=False
 return s

def render(path):
 bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)

def vertices(obj):
 evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();v=np.array([list(evaluated.matrix_world@x.co) for x in mesh.vertices]);evaluated.to_mesh_clear();return v

def transformed(points,C):
 return np.array([list(C@Vector(p)) for p in points],dtype=np.float64)

def canonicalize_unit_scales(path):
 # Remove exporter decomposition noise (< 1e-6), then rebuild inverse binds.
 sys.path.insert(0,str(Path(__file__).resolve().parent))
 from verify_husky import GLB
 g=GLB(path);d=g.d;binary=bytearray(g.binary)
 for node in d['nodes']:
  assert max(abs(np.array(node.get('scale',[1,1,1]))-1))<2e-6
  node.pop('scale',None)
 def write_accessor(index,values):
  a=d['accessors'][index];v=d['bufferViews'][a['bufferView']];assert a['componentType']==5126 and 'byteStride' not in v
  start=v.get('byteOffset',0)+a.get('byteOffset',0);raw=np.asarray(values,dtype='<f4').tobytes();binary[start:start+len(raw)]=raw
  if 'min' in a:a['min']=np.asarray(values).reshape(a['count'],-1).min(axis=0).tolist()
  if 'max' in a:a['max']=np.asarray(values).reshape(a['count'],-1).max(axis=0).tolist()
 for animation in d['animations']:
  for channel in animation['channels']:
   if channel['target']['path']=='scale':
    index=animation['samplers'][channel['sampler']]['output'];values=g.accessor(index);assert abs(values-1).max()<2e-6;write_accessor(index,np.ones_like(values))
 for skin_index,skin in enumerate(d['skins']):
  mesh_index=next(i for i,n in enumerate(d['nodes']) if n.get('skin')==skin_index)
  values=np.array([(np.linalg.inv(g.matrix(i))@g.matrix(mesh_index)).T.reshape(16) for i in skin['joints']]);write_accessor(skin['inverseBindMatrices'],values)
 raw=json.dumps(d,separators=(',',':'),ensure_ascii=False).encode('utf-8');raw+=b' '*((-len(raw))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(raw)+len(binary))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(binary),0x004e4942)+binary)

def prepare_source(source):
 bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');obj=next(o for o in bpy.data.objects if o.type=='MESH');scene=bpy.context.scene
 rig.data.pose_position='REST';bpy.context.view_layer.update()
 points=[obj.matrix_world@v.co for v in obj.data.vertices];fore=(rig.matrix_world@rig.data.bones['FrontShoulder.L'].head_local+rig.matrix_world@rig.data.bones['FrontShoulder.R'].head_local)/2
 # A rigid pitch of about 0.03 degrees aligns the source's slightly unequal sole levels.
 def levels(angle):
  rot=Matrix.Rotation(angle,4,'X');pts=[rot@p for p in points];split=-.2
  return min(p.z for p,q in zip(pts,points) if q.y<split),min(p.z for p,q in zip(pts,points) if q.y>=split)
 lo,hi=-.005,.005
 for _ in range(45):
  mid=(lo+hi)/2;a,b=levels(mid)
  if b-a>0:hi=mid
  else:lo=mid
 angle=(lo+hi)/2;R=Matrix.Rotation(angle,4,'X');pts=[R@p for p in points];floor=min(p.z for p in pts);front=R@fore
 obj.data.calc_loop_triangles();tris=[tuple(t.vertices) for t in obj.data.loop_triangles]
 tree=BVHTree.FromPolygons(pts,tris,all_triangles=True);hit=tree.ray_cast(Vector((front.x,front.y,20)),Vector((0,0,-1)))[0];assert hit
 factor=SHOULDER_HEIGHT/(hit.z-floor);C=Matrix.Scale(factor,4)@Matrix.Translation(Vector((-front.x,-front.y,-floor)))@R
 rests={b.name:rig.matrix_world@b.matrix_local for b in rig.data.bones}
 bone_data={b.name:{'head':rig.matrix_world@b.head_local,'tail':rig.matrix_world@b.tail_local,'parent':b.parent.name if b.parent else None,'matrix':rests[b.name].copy(),'deform':b.use_deform} for b in rig.data.bones}
 removed=[b for b in bone_data if b.startswith(('IK','PoleTarget'))];kept=[b for b in bone_data if b not in removed]
 original_weights=[{obj.vertex_groups[g.group].name:g.weight for g in v.groups if obj.vertex_groups[g.group].name in bone_data and g.weight>1e-8} for v in obj.data.vertices]
 removal=[{'bone':b,'weighted_vertices':sum(w.get(b,0)>1e-8 for w in original_weights),'weight_sum':sum(w.get(b,0) for w in original_weights),'merged_into':REMAPPING.get(b)} for b in removed]
 rest_points=transformed([list(p) for p in points],C);faces=[list(f.vertices) for f in obj.data.polygons];smooth=[f.use_smooth for f in obj.data.polygons]
 fps=scene.render.fps/scene.render.fps_base;clips=[]
 rig.data.pose_position='POSE'
 for track in rig.animation_data.nla_tracks:track.mute=True
 actions=list(bpy.data.actions)
 for action in actions:
  rig.animation_data.action=action
  if action.slots:rig.animation_data.action_slot=action.slots[0]
  for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
  first,last=map(lambda x:int(round(x)),action.frame_range);samples=[];shapes=[]
  for frame in range(first,last+1):
   scene.frame_set(frame);bpy.context.view_layer.update();ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
   samples.append({n:C@ev.matrix_world@ev.pose.bones[n].matrix@Matrix.Scale(1/factor,4) for n in kept})
   shapes.append(transformed(vertices(obj),C))
  clips.append({'name':action.name,'first':first,'last':last,'fps':fps,'matrices':samples,'reference':shapes})
  print('CAPTURED',action.name,len(samples),flush=True)
 return dict(points=rest_points,faces=faces,smooth=smooth,bones=bone_data,kept=kept,weights=original_weights,removed=removal,clips=clips,fps=fps,C=C,factor=factor,pitch=angle)

def fit_four_weights(data,rig,points,weights):
    """Fit four original-region bones to all original motion samples, with sum=1.
    Uses the original animations as deformation targets; no geometry is changed.
    """
    names=data['kept'];indices={n:i for i,n in enumerate(names)}
    rests={n:np.array(rig.data.bones[n].matrix_local.inverted()) for n in names}
    matrices=[];targets=[];importance=[]
    for clip in data['clips']:
        for f in range(0,len(clip['matrices']),2):
            matrices.append([np.array(clip['matrices'][f][n])@rests[n] for n in names])
            targets.append(clip['reference'][f]);importance.append(1/math.sqrt(len(clip['matrices'])))
    matrices=np.array(matrices);targets=np.array(targets);importance=np.array(importance)
    fitted=[]
    for i,(point,w) in enumerate(zip(points,weights)):
        merged={}
        for n,value in w.items():
            n=REMAPPING.get(n,n)
            if n in indices:merged[n]=merged.get(n,0)+value
        candidates=sorted(merged,key=lambda n:-merged[n])[:14]
        if len(candidates)<=4:
            total=sum(merged[n] for n in candidates);fitted.append({n:merged[n]/total for n in candidates});continue
        p=np.array([*point,1.]);pred=np.einsum('fnij,j->fni',matrices[:,[indices[n] for n in candidates]],p)[:,:,:3]
        A=((pred-np.array(point)[None,None,:])*importance[:,None,None]).transpose(0,2,1).reshape(-1,len(candidates))
        y=((targets[:,i]-point)*importance[:,None]).reshape(-1)
        G=A.T@A;rhs=A.T@y
        combos=np.array(list(itertools.combinations(range(len(candidates)),4)))
        blocks=G[combos[:,:,None],combos[:,None,:]]
        K=np.zeros((len(combos),5,5));K[:,:4,:4]=blocks+np.eye(4)[None]*1e-9;K[:,:4,4]=1;K[:,4,:4]=1
        B=np.concatenate([rhs[combos],np.ones((len(combos),1))],axis=1)
        solutions=np.linalg.solve(K,B[...,None])[... ,0][:,:4]
        valid=np.min(solutions,axis=1)>=-1e-7
        error=np.einsum('ni,nij,nj->n',solutions,blocks,solutions)-2*np.sum(solutions*rhs[combos],axis=1)
        error[~valid]=np.inf
        if np.any(valid):
            j=int(np.argmin(error));ww=np.maximum(0,solutions[j]);ww/=ww.sum();fitted.append({candidates[k]:float(v) for k,v in zip(combos[j],ww) if v>1e-8})
        else:
            selected=candidates[:4];total=sum(merged[n] for n in selected);fitted.append({n:merged[n]/total for n in selected})
    return fitted

def build(data):
 bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=round(data['fps']);scene.world=bpy.data.worlds.new('review_world')
 # Weld exact overlaps, retaining a map for per-vertex source comparisons.
 lookup={};points=[];weights=[];old_to_new=[]
 for p,w in zip(data['points'],data['weights']):
  key=tuple(round(float(v),9) for v in p)
  if key not in lookup:lookup[key]=len(points);points.append(p);weights.append(w.copy())
  old_to_new.append(lookup[key])
 faces=[[old_to_new[i] for i in f] for f in data['faces']]
 mesh=bpy.data.meshes.new(NAME);mesh.from_pydata(points,[],faces);mesh.update();obj=bpy.data.objects.new(NAME,mesh);scene.collection.objects.link(obj)
 for p,flag in zip(mesh.polygons,data['smooth']):p.use_smooth=flag
 mesh.materials.append(black())
 rig=bpy.data.objects.new('Armature',bpy.data.armatures.new('Armature'));scene.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 C=data['C'];R=C.to_3x3().normalized()
 for name in data['kept']:
  src=data['bones'][name];b=rig.data.edit_bones.new(name);b.head=C@src['head'];b.tail=C@src['tail'];b.align_roll(R@src['matrix'].to_3x3().col[2]);b.use_deform=src['deform']
 for name in data['kept']:
  parent=REPARENT.get(name,data['bones'][name]['parent'])
  if parent:rig.data.edit_bones[name].parent=rig.data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT')
 for name in data['kept']:
  b=rig.data.bones[name];b['head_game_m']=game(b.head_local);b['tail_game_m']=game(b.tail_local);b['length_m']=b.length
 groups={name:obj.vertex_groups.new(name=name) for name in data['kept']}
 fitted=fit_four_weights(data,rig,points,weights)
 discarded=[]
 for i,w in enumerate(weights):
  merged={}
  for name,weight in w.items():
   target=REMAPPING.get(name,name)
   if target in groups:merged[target]=merged.get(target,0)+weight
  ordered=sorted(merged.items(),key=lambda x:(-x[1],x[0]));kept=ordered[:MAX_INFLUENCES];total=sum(v for _,v in kept);assert total>0
  discarded.append(sum(v for _,v in ordered[MAX_INFLUENCES:])/sum(merged.values()))
  for name,weight in fitted[i].items():groups[name].add([i],weight,'REPLACE')
 mod=obj.modifiers.new('Skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=False
 obj.parent=rig;obj.matrix_parent_inverse=Matrix.Identity(4)
 rig.animation_data_create();baked=[];comparisons=[]
 for clip in data['clips']:
  action=bpy.data.actions.new(clip['name']);rig.animation_data.action=action;prev={};maximum=0;squared=0;count=0
  for offset,poses in enumerate(clip['matrices']):
   frame=clip['first']+offset
   for name in data['kept']:
    pb=rig.pose.bones[name];rest=pb.bone.matrix_local
    if pb.parent:basis=rest.inverted()@pb.parent.bone.matrix_local@poses[pb.parent.name].inverted()@poses[name]
    else:basis=rest.inverted()@poses[name]
    loc,rot,scale=basis.decompose()
    if name in prev and rot.dot(prev[name])<0:rot.negate()
    prev[name]=rot.copy();pb.rotation_mode='QUATERNION';pb.location=loc;pb.rotation_quaternion=rot;pb.scale=tuple(1 if abs(x-1)<2e-5 else x for x in scale)
    pb.keyframe_insert('location',frame=frame,group=name);pb.keyframe_insert('rotation_quaternion',frame=frame,group=name);pb.keyframe_insert('scale',frame=frame,group=name)
   scene.frame_set(frame);bpy.context.view_layer.update();actual=vertices(obj)[old_to_new];err=np.linalg.norm(actual-clip['reference'][offset],axis=1);maximum=max(maximum,float(err.max()));squared+=float(np.sum(err*err));count+=len(err)
  for layer in action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for curve in bag.fcurves:
      for key in curve.keyframe_points:key.interpolation='LINEAR'
  action.use_fake_user=True;baked.append(action);comparisons.append({'name':clip['name'],'frames':clip['last']-clip['first']+1,'fps':clip['fps'],'source_first_frame':clip['first'],'source_last_frame':clip['last'],'vertex_max_error_m':maximum,'vertex_rms_error_m':math.sqrt(squared/count)})
  print('BAKED',clip['name'],'MAX_ERROR_M',maximum,flush=True)
 rig.animation_data.action=None
 for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update()
 return obj,rig,baked,comparisons,old_to_new,max(discarded)

def main():
 argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=SOURCE);parser.add_argument('--out',type=Path,default=Path(__file__).resolve().parent);parser.add_argument('--preview',action='store_true');args=parser.parse_args(argv);args.out.mkdir(parents=True,exist_ok=True)
 data=prepare_source(args.source);obj,rig,actions,comparisons,mapping,loss=build(data)
 sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"animal_tools"))
 from silhouette import apply
 silhouette=apply(obj,rig,"husky",args.out)
 report={'silhouette':silhouette,'action_comparison_scope':'before authorized silhouette adjustment','source':str(args.source),'source_sha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),'scale_factor':data['factor'],'ground_pitch_degrees':math.degrees(data['pitch']),'shoulder_height_m':SHOULDER_HEIGHT,'original_vertices':len(data['points']),'vertices':len(obj.data.vertices),'welded_vertices':len(data['points'])-len(obj.data.vertices),'removed_bones':data['removed'],'reparented':REPARENT,'max_discarded_weight_fraction':loss,'actions':comparisons,'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':game(b.head_local),'tail':game(b.tail_local),'length':b.length} for b in rig.data.bones]}
 (args.out/'conversion_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.ops.export_scene.gltf(filepath=str(args.out/(NAME+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_skins=True,export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_step=1,export_optimize_animation_size=False,export_nla_strips=False,export_all_influences=False,export_texcoords=False,export_normals=True,export_cameras=False,export_lights=False)
 canonicalize_unit_scales(args.out/(NAME+'.glb'))
 if args.preview:
  scene=render_setup()
  for name,az,el in [('rest_side',90,0),('rest_top',0,90),('rest_game',35,38)]:camera(scene,az,el);render(args.out/(name+'.png'))
  for action,clip in zip(actions,data['clips']):
   mid=(clip['first']+clip['last'])//2;rig.animation_data.action=action;scene.frame_set(mid);bpy.context.view_layer.update();camera(scene)
   points=clip['reference'][mid-clip['first']];center=Vector((points.min(axis=0)+points.max(axis=0))/2);scene.camera.location+=center-Vector((0,.23,.37))
   render(args.out/('action_'+clip['name']+'.png'))
   mesh=bpy.data.meshes.new('source_reference');mesh.from_pydata(clip['reference'][mid-clip['first']],[],data['faces']);ref=bpy.data.objects.new('source_reference',mesh);scene.collection.objects.link(ref);mesh.materials.append(obj.data.materials[0]);obj.hide_render=True;render(args.out/('source_'+clip['name']+'.png'));obj.hide_render=False;bpy.data.objects.remove(ref,do_unlink=True);bpy.data.meshes.remove(mesh)
  rig.animation_data.action=None
  for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
  bpy.context.view_layer.update()
  sys.path.insert(0,str(Path(__file__).resolve().parent))
  from review_husky import reviews
  reviews(obj,rig,args.out,camera,render,vertices)
if __name__=='__main__':main()

