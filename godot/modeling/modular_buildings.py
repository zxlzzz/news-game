"""Split facade/furnishing components out of a building, deduplicating geometry.

Building builders assemble the saved layout after rebuilding the shell. Independent
component recipes remain reusable without the parent building. Instance transforms keep
the existing facade placement; no nonuniform scales are introduced.
"""
import hashlib
import json
import re
from pathlib import Path
import numpy as np
from check_model import accessor,node_matrix
from model_contacts import read,write
from build_component import build

HERE=Path(__file__).resolve().parent


def assemble(name):
    """Write instances from the layout; never construct component geometry."""
    layout=json.loads((HERE/'building-layouts.json').read_text())[name]
    path=HERE.parent/'types'/f'{name}.tscn'
    text=path.read_text(encoding='utf-8-sig')
    for delimiter in ['# BEGIN reusable components','; BEGIN reusable components']:
        if delimiter in text:
            text=text[:text.index(delimiter)].rstrip()+'\n'
    text=re.sub(r'\[ext_resource[^\n]+id="part\d+"\]\n','',text)
    # Older scenes can contain generated instances before the section marker.
    # Replacing only the marked tail would duplicate those nodes on rebuild.
    text=re.sub(r'\[node[^\n]*instance=ExtResource\("part\d+"\)[^\n]*\]\n(?:(?!\[).)*',
                '',text,flags=re.DOTALL)
    text=re.sub(r'\n{3,}','\n\n',text).strip()+'\n'
    resources=[];instances=[]
    for index,row in enumerate(layout):
        resource=f'part{index}'
        resources.append(f'[ext_resource type="PackedScene" path="res://types/{row["type"]}.tscn" id="{resource}"]')
        xyz=', '.join(str(x) for x in row['position'])
        instance=f'[node name="{row["type"]}_{index}" parent="." instance=ExtResource("{resource}")]\nposition = Vector3({xyz})'
        if row.get('yaw'):instance+=f'\nrotation = Vector3(0, {row["yaw"]}, 0)'
        instances.append(instance)
    pos=text.index('[node ')
    text=text[:pos]+'\n'.join(resources)+'\n\n'+text[pos:]
    text=re.sub(r'load_steps=\d+',f'load_steps={2+len(layout)}',text,count=1)
    text+='\n; BEGIN reusable components\n'+'\n\n'.join(instances)+'\n'
    import os,tempfile
    with tempfile.NamedTemporaryFile(mode='w',dir=path.parent,suffix='.tmp',encoding='utf-8',delete=False) as pending:
        pending.write(text)
    os.replace(pending.name,path)


def modularize(path):
    path=Path(path)
    type_path=HERE.parent/'types'/f'{path.stem}.tscn'
    if not type_path.exists():
        type_path.write_text('[gd_scene load_steps=2 format=3]\n\n[ext_resource type="PackedScene" path="res://models/'+path.stem+'.glb" id="1"]\n\n[node name="'+path.stem+'" type="Node3D" groups=["building"]]\n\n[node name="model" parent="." instance=ExtResource("1")]\n',encoding='utf-8')
    doc,binary=read(path)
    components=[]
    nodes=doc['nodes']
    meshes={}
    for i,node in enumerate(nodes):
        if 'mesh' not in node: continue
        matrix=np.array(node_matrix(node)).reshape(4,4,order='F')
        prims=[]
        points=[]
        for p in doc['meshes'][node['mesh']]['primitives']:
            a=p['attributes'];pos=np.array(accessor(doc,binary,a['POSITION']))
            normals=np.array(accessor(doc,binary,a['NORMAL']))
            world=(np.column_stack((pos,np.ones(len(pos))))@matrix.T)[:,:3]
            norm=normals@np.linalg.inv(matrix[:3,:3])
            norm/=np.linalg.norm(norm,axis=1)[:,None]
            points.extend(world)
            prims.append({'positions':world,'normals':norm,
                'indices':[int(x[0]) for x in accessor(doc,binary,p['indices'])],
                'slot':doc['materials'][p['material']]['name']})
        points=np.array(points)
        meshes[i]={'name':node['name'],'primitives':prims,'min':points.min(0),'max':points.max(0)}
    windows=[i for i,m in meshes.items() if any(p['slot']=='window' for p in m['primitives'])
        and not any(t in m['name'].lower() for t in ('door','washer','machine'))]
    groups={i:[i] for i in windows}
    removed=set(windows)
    # Associate each sill/frame/mullion with the closest actual pane.
    for i,m in meshes.items():
        name=m['name'].lower()
        if i in removed or not any(t in name for t in ('sill','mullion','transom','_jamb','_head','_frame')): continue
        if any(t in name for t in ('entry','door','roof')) or not windows: continue
        center=(m['min']+m['max'])/2
        distances={w:float(np.linalg.norm(np.maximum(np.maximum(meshes[w]['min']-center,center-meshes[w]['max']),0))) for w in windows}
        closest=min(distances,key=distances.get)
        if distances[closest] < .5:
            groups[closest].append(i);removed.add(i)
    for group in groups.values(): components.append(('window',group))
    doors=[]
    for i,m in meshes.items():
        if i in removed: continue
        name=m['name'].lower()
        if any(p['slot']=='door' for p in m['primitives']) and not any(t in name for t in ('frame','jamb','lintel')):
            doors.append(i);removed.add(i)
        elif any(t in name for t in ('canopy','awning','sign','washer','bread','crate','box','air_condition','roof_vent','roof_tank')):
            category='awning' if any(t in name for t in ('canopy','awning')) else 'sign' if 'sign' in name else 'furnishing'
            components.append((category,[i]));removed.add(i)
    layout=[]
    directory=HERE/'components';directory.mkdir(exist_ok=True)
    for kind,group in components:
        low=np.minimum.reduce([meshes[i]['min'] for i in group])
        high=np.maximum.reduce([meshes[i]['max'] for i in group])
        origin=(low+high)/2;origin[1]=low[1]
        recipe={'slots':sorted({p['slot'] for i in group for p in meshes[i]['primitives']}),'parts':[]}
        for part_number,i in enumerate(group):
            m=meshes[i];prims=[]
            for p in m['primitives']:
                prims.append({'positions':np.round(p['positions']-origin,6).flatten().tolist(),
                    'normals':np.round(p['normals'],6).flatten().tolist(),'indices':p['indices'],'slot':p['slot']})
            recipe['parts'].append({'name':('Sash' if kind=='window' and i==group[0] else f'Part{part_number}'),
                'moving':kind=='window' and i==group[0],'primitives':prims})
        if kind=='window':
            pane=meshes[group[0]]
            hinge=np.array([pane['min'][0],pane['min'][1],(pane['min'][2]+pane['max'][2])/2])-origin
            recipe['hinge']=np.round(hinge,6).tolist()
            recipe['markers']={'grip_sash':np.round(np.array([pane['max'][0],(pane['min'][1]+pane['max'][1])/2,pane['max'][2]])-origin-hinge,6).tolist()}
        fingerprint=hashlib.sha256(json.dumps(recipe,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:10]
        name=f'{kind}_{fingerprint}'
        definition=directory/f'{name}.json'
        if not definition.exists():
            definition.write_text(json.dumps(recipe,separators=(',',':')),encoding='utf-8')
            build(name)
            (HERE/f'build_{name}.py').write_text('"""Reusable '+kind+'; dimensions/geometry live in components/'+name+'.json."""\nfrom build_component import build\nNAME = "'+name+'"\nif __name__ == "__main__":\n    build(NAME)\n',encoding='utf-8')
            (HERE.parent/'types'/f'{name}.tscn').write_text('[gd_scene load_steps=2 format=3]\n\n[ext_resource type="PackedScene" path="res://models/'+name+'.glb" id="1"]\n\n[node name="'+name+'" type="Node3D" groups=["facade_item"]]\n\n[node name="model" parent="." instance=ExtResource("1")]\n',encoding='utf-8')
        layout.append({'type':name,'position':np.round(origin,6).tolist()})
    for i in doors:
        m=meshes[i];center=(m['min']+m['max'])/2
        position=[center[0],m['min'][1],m['max'][2]]
        layout.append({'type':'door_single','position':np.round(position,6).tolist()})
    if not removed: return
    # Remove the component geometry itself, not just references in the scene.
    keep=[i for i in range(len(nodes)) if i not in removed]
    remap={old:new for new,old in enumerate(keep)}
    retained=[nodes[i] for i in keep]
    for node in retained:
        if 'children' in node: node['children']=[remap[i] for i in node['children'] if i in remap]
    for scene in doc['scenes']: scene['nodes']=[remap[i] for i in scene['nodes'] if i in remap]
    doc['nodes']=retained
    used=sorted({n['mesh'] for n in retained if 'mesh' in n})
    mesh_map={old:new for new,old in enumerate(used)}
    for node in retained:
        if 'mesh' in node: node['mesh']=mesh_map[node['mesh']]
    doc['meshes']=[doc['meshes'][i] for i in used]
    write(path,doc,binary)
    type_path=HERE.parent/'types'/f'{path.stem}.tscn'
    text=type_path.read_text(encoding='utf-8-sig')
    if '# BEGIN reusable components' in text:
        text=text[:text.index('# BEGIN reusable components')].rstrip()+'\n'
    text=re.sub(r'\[ext_resource[^\n]+id="part\d+"\]\n','',text)
    resources=[];instances=[]
    for index,row in enumerate(layout):
        id=f'part{index}'
        resources.append(f'[ext_resource type="PackedScene" path="res://types/{row["type"]}.tscn" id="{id}"]')
        xyz=', '.join(str(x) for x in row['position'])
        instances.append(f'[node name="{row["type"]}_{index}" parent="." instance=ExtResource("{id}")]\nposition = Vector3({xyz})')
    # Resource declarations must precede nodes.
    pos=text.index('[node ')
    text=text[:pos]+'\n'.join(resources)+'\n\n'+text[pos:]
    text=re.sub(r'load_steps=\d+',f'load_steps={2+len(layout)}',text, count=1)
    text+='\n# BEGIN reusable components\n'+'\n\n'.join(instances)+'\n'
    type_path.write_text(text,encoding='utf-8')
    layout_path=HERE/'building-layouts.json'
    layouts=json.loads(layout_path.read_text()) if layout_path.exists() else {}
    layouts[path.stem]=layout
    layout_path.write_text(json.dumps(layouts,indent=2),encoding='utf-8')
    print('MODULAR_BUILDING',path.stem,len(layout),'instances')


if __name__=='__main__':
    import sys
    for argument in sys.argv[1:]: modularize(argument)
