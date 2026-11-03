"""Build cached reusable parts from their independent geometry definitions."""
import json
import struct
from pathlib import Path
from model_contacts import write, motion_definition

HERE = Path(__file__).resolve().parent


def build(name, source='components'):
    recipe = json.loads((HERE/source/f'{name}.json').read_text())
    if name.startswith('window_') and 'hinge' in recipe:
        from window_details import complete
        recipe = complete(recipe,name)
    binary = bytearray()
    doc = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': []}],
           'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [], 'buffers': [{'byteLength': 0}],
           'materials': [{'name': slot} for slot in recipe['slots']]}

    def array(values, kind):
        width = {'VEC3': 3, 'SCALAR': 1}[kind]
        component = 5126 if kind == 'VEC3' else 5125
        while len(binary)%4: binary.append(0)
        offset=len(binary)
        binary.extend(struct.pack('<'+('f' if component==5126 else 'I')*len(values),*values))
        view=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(binary)-offset})
        accessor={'bufferView':view,'componentType':component,'count':len(values)//width,'type':kind}
        if kind=='VEC3': accessor.update(min=[min(values[i::3]) for i in range(3)],max=[max(values[i::3]) for i in range(3)])
        index=len(doc['accessors']);doc['accessors'].append(accessor)
        return index

    def node(value, parent=None):
        index=len(doc['nodes']);doc['nodes'].append(value)
        (doc['scenes'][0]['nodes'] if parent is None else doc['nodes'][parent].setdefault('children',[])).append(index)
        return index

    hinges = {}
    for joint in recipe.get('joints', []):
        definition = motion_definition({'axis':joint['axis'],'degrees':joint['degrees']})
        hinges[joint['name']] = node({'name':joint['name'],'translation':joint['position'],
            'extras':{'window_motion':definition}})
    hinge = hinges.get('SashHinge') if hinges else node({'name':'SashHinge','translation':recipe['hinge']}) if 'hinge' in recipe else None
    pivots = {joint['name']:joint['position'] for joint in recipe.get('joints', [])}
    for part in recipe['parts']:
        primitives=[]
        for prim in part['primitives']:
            primitives.append({'attributes':{'POSITION':array(prim['positions'],'VEC3'),
                'NORMAL':array(prim['normals'],'VEC3')},'indices':array(prim['indices'],'SCALAR'),
                'material':recipe['slots'].index(prim['slot'])})
        mesh=len(doc['meshes']);doc['meshes'].append({'name':part['name'],'primitives':primitives})
        parent = hinges[part['joint']] if 'joint' in part else hinge if part.get('moving',False) else None
        value={'name':part['name'],'mesh':mesh}
        if parent is not None:
            pivot = pivots[part['joint']] if 'joint' in part else recipe['hinge']
            value['translation']=[-x for x in pivot]
        node(value,parent)
    for name_,at in recipe.get('markers',{}).items():
        node({'name':name_,'translation':at},hinge if name_=='grip_sash' else None)
    doc['buffers'][0]['byteLength']=len(binary)
    write(HERE.parent/'models'/f'{name}.glb',doc,bytes(binary))


if __name__=='__main__':
    import sys
    for name in sys.argv[1:]: build(name)
