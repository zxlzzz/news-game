"""Render static extreme-pose tests and the same-scale comparison. Blender background."""
import sys,json,math
from pathlib import Path
sys.dont_write_bytecode=True
import bpy,numpy as np
from mathutils import Vector
HERE=Path(__file__).resolve().parent;sys.path.insert(0,str(HERE))
import motion_core as m
ROOT=HERE.parent

def render_pose(r,obj,cam,points,path,az=90,el=0):
 obj.data.vertices.foreach_set('co',points[:,:3].ravel());obj.data.update()
 target=Vector((points[:,:3].min(axis=0)+points[:,:3].max(axis=0))/2);a,e=math.radians(az),math.radians(el);v=Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)))
 cam.location=target+v*5;cam.rotation_euler=(-v).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=max(np.ptp(points[:,:3],axis=0))*1.3
 s=bpy.context.scene;s.render.resolution_x=s.render.resolution_y=800;s.render.filepath=str(path);bpy.ops.render.render(write_still=True)

for species in ['shibainu','cat']:
 folder=ROOT/('models/animal_'+species);m.PROFILE=json.loads((folder/'profile.json').read_text(encoding='utf-8'));r=m.Rig(m.GLB(folder/(m.PROFILE['name']+'.glb')))
 config=json.loads((ROOT/('motions/'+species+'_motion_library/motion_specs.json')).read_text(encoding='utf-8'));specs={x['name']:x for x in config['clips']};obj,cam=m.setup_render(r)
 for label,clip,u in [('sit','NG_Sit_Idle',0),('lie','NG_Lie_Idle',0),('side','NG_Side_Lie_Breathe',0),('hind_lift','NG_Urinate_Left',.5),('sniff_left','NG_Sniff_Ground_Loop',0)]:
  points,_,_=m.sample(r,specs[clip],u,config['tuning'])
  if label=='sniff_left':r.neck(yaw=45);points=r.skin()
  render_pose(r,obj,cam,points,folder/('test_'+label+'.png'),35 if label in ['side','hind_lift','sniff_left'] else 90,38 if label in ['side','hind_lift','sniff_left'] else 0)
 for label,angle in [('tail_up',25),('tail_down',-95)]:
  r.reset();r.turn(r.tail_names[0],'X',angle);render_pose(r,obj,cam,r.skin(),folder/('test_'+label+'.png'))

# Identical coordinate scale; arrange animals along camera screen-right.
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.world=bpy.data.worlds.new('gray');s.world.color=(.68,.68,.68);s.render.engine='BLENDER_WORKBENCH';sh=s.display.shading;sh.light='FLAT';sh.color_type='MATERIAL';sh.show_shadows=False;sh.show_cavity=False;sh.show_specular_highlight=False;sh.background_type='WORLD';s.view_settings.view_transform='Standard'
mat=bpy.data.materials.new('animal_ink');mat.diffuse_color=(0,0,0,1);a,e=math.radians(35),math.radians(38);right=np.array([math.cos(a),math.sin(a),0]);allpoints=[]
for species,offset in [('husky',-.8),('shibainu',0),('cat',.65)]:
 g=m.GLB(ROOT/('models/animal_'+species)/('animal_'+species+'.glb'));p=g.d['meshes'][0]['primitives'][0];pts=(m.Q.T@np.c_[g.accessor(p['attributes']['POSITION']),np.ones(len(g.accessor(p['attributes']['POSITION'])))].T).T[:,:3];pts+=right*offset;allpoints.extend(pts)
 mesh=bpy.data.meshes.new(species);mesh.from_pydata(pts,[],g.accessor(p['indices']).reshape(-1,3).astype(int).tolist());obj=bpy.data.objects.new(species,mesh);s.collection.objects.link(obj);mesh.materials.append(mat)
bpy.ops.mesh.primitive_cube_add(size=1,location=Vector(right*1.15)+Vector((0,0,.87)));bar=bpy.context.object;bar.name='1.74m';bar.dimensions=(.026,.026,1.74);bar.data.materials.append(mat);allpoints.extend([right*1.15,right*1.15+[0,0,1.74]])
pts=np.array(allpoints);target=Vector((pts.min(axis=0)+pts.max(axis=0))/2);v=Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)));cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));s.collection.objects.link(cam);s.camera=cam;cam.location=target+v*5;cam.rotation_euler=(-v).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.1;s.render.resolution_x=1500;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.filepath=str(ROOT/'animals_comparison.png');bpy.ops.render.render(write_still=True)
