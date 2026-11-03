"""Add physical contact nodes to GLBs; positions live only in model-contacts.json.

Call apply() as the final step of a model builder. Reapplying is byte-identical.
Moving contacts are children of their moving mesh/hinge, in that node's coordinates.
"""
import json
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG = HERE / 'model-contacts.json'


def read(path):
    data = Path(path).read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + size])
    offset = 20 + size
    binary = data[offset + 8:] if offset < len(data) else b''
    return doc, binary


def write(path, doc, binary):
    import os
    import tempfile
    header = json.dumps(doc, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    binary += b'\0' * (-len(binary) % 4)
    chunks = struct.pack('<I4s', len(header), b'JSON') + header
    if binary:
        chunks += struct.pack('<I4s', len(binary), b'BIN\0') + binary
    path=Path(path)
    with tempfile.NamedTemporaryFile(dir=path.parent,suffix='.tmp',delete=False) as temporary:
        temporary.write(struct.pack('<4sII', b'glTF', 2, 12 + len(chunks)) + chunks)
        pending=temporary.name
    os.replace(pending,path)



def motion_definition(motion):
    """Validate model-local rotation metadata before writing an imported GLB."""
    import math
    axis, degrees = motion['axis'], motion['degrees']
    if len(axis) != 3 or len(degrees) != 2:
        raise ValueError('Motion needs a three-component axis and two angle limits')
    if not all(isinstance(value, (int, float)) and math.isfinite(value)
               for value in [*axis, *degrees]):
        raise ValueError('Motion axis and limits must be finite numbers')
    if abs(sum(value * value for value in axis) - 1.0) > 0.000001:
        raise ValueError('Motion axis must have unit length')
    if degrees[0] == degrees[1]:
        raise ValueError('A motion needs distinct angle limits')
    return {'axis': list(axis), 'degrees': list(degrees)}


def contact_metadata(definition):
    """Reject unknown or malformed contact settings before changing a GLB."""
    import math
    allowed = {'at', 'purpose', 'parent', 'rotation', 'geometry_origin'}
    if not isinstance(definition, dict) or set(definition) - allowed:
        raise ValueError('Unknown contact fields or non-object definition')
    def vector(value, count):
        return (isinstance(value, list) and len(value) == count
                and all(type(x) in (int, float) and math.isfinite(x) for x in value))
    if not vector(definition.get('at'), 3):
        raise ValueError('Contact at must contain three finite numbers')
    purpose = definition.get('purpose')
    if not isinstance(purpose, str) or not purpose.strip():
        raise ValueError('Contact purpose must be a nonempty string')
    if 'parent' in definition and (not isinstance(definition['parent'], str)
                                  or not definition['parent']):
        raise ValueError('Contact parent must be a nonempty node name')
    if 'geometry_origin' in definition and type(definition['geometry_origin']) is not bool:
        raise ValueError('Contact geometry_origin must be boolean')
    if 'rotation' in definition:
        rotation = definition['rotation']
        if not vector(rotation, 4) or abs(sum(x*x for x in rotation) - 1) > 0.000001:
            raise ValueError('Contact rotation must be a finite unit quaternion')
    return {'physical_contact': True, 'purpose': purpose}


def apply(path):
    path = Path(path)
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    definitions = config['models'].get(path.stem, {})
    assemblies = config.get('assemblies',{}).get(path.stem,{})
    if not definitions and not assemblies:
        return
    doc, binary = read(path)
    nodes = doc['nodes']
    if assemblies:
        import numpy as np
        from check_model import node_matrix
        worlds = {}
        def walk(index,parent):
            worlds[index] = parent @ np.array(node_matrix(nodes[index])).reshape(4,4,order='F')
            for child in nodes[index].get('children',[]): walk(child,worlds[index])
        for scene in doc['scenes']:
            for index in scene['nodes']: walk(index,np.eye(4))
        for name,assembly in assemblies.items():
            matches=[i for i,n in enumerate(nodes) if n.get('name')==name]
            index=matches[0] if matches else len(nodes)
            if not matches:
                nodes.append({'name':name,'translation':assembly['at'],'children':[]})
                doc['scenes'][doc.get('scene',0)]['nodes'].append(index)
            parent=np.eye(4);parent[:3,3]=assembly['at']
            if 'motion' in assembly:
                nodes[index].setdefault('extras',{})['motion'] = motion_definition(assembly['motion'])
            for part in assembly['parts']:
                found=[i for i,n in enumerate(nodes) if n.get('name')==part]
                if len(found)!=1: raise ValueError(f'{path.stem}: missing moving part {part}')
                child=found[0]
                local=np.linalg.inv(parent)@worlds[child]
                for node in nodes:
                    if child in node.get('children',[]): node['children'].remove(child)
                for scene in doc['scenes']:
                    if child in scene['nodes']: scene['nodes'].remove(child)
                for key in ['translation','rotation','scale']: nodes[child].pop(key,None)
                nodes[child]['matrix']=local.flatten(order='F').tolist()
                nodes[index]['children'].append(child)
    for name, definition in definitions.items():
        metadata = contact_metadata(definition)
        matches = [i for i, n in enumerate(nodes) if n.get('name') == name]
        if len(matches) > 1:
            raise ValueError(f'{path.stem}: duplicate contact {name}')
        index = matches[0] if matches else len(nodes)
        contact = {'name': name, 'translation': definition['at'],
                   'extras': metadata}
        if 'rotation' in definition:
            contact['rotation']=definition['rotation']
        if matches:
            if 'mesh' in nodes[index]:
                if not definition.get('geometry_origin',False):
                    raise ValueError(f'{name} is geometry, not an empty contact node')
                # Some original held models already name the grasp mesh 'grip'
                # and put its origin exactly at the actual grasp. Mark that
                # existing origin explicitly, keeping its geometry and hierarchy.
                nodes[index]['extras'] = contact['extras']
                continue
            nodes[index] = contact
        else:
            nodes.append(contact)
        for n in nodes:
            if index in n.get('children', []):
                n['children'].remove(index)
        for scene in doc['scenes']:
            if index in scene.get('nodes', []):
                scene['nodes'].remove(index)
        parent = definition.get('parent')
        if parent:
            found = [n for n in nodes if n.get('name') == parent]
            if len(found) != 1:
                raise ValueError(f'{path.stem}: missing/ambiguous contact parent {parent}')
            found[0].setdefault('children', []).append(index)
        else:
            doc['scenes'][doc.get('scene', 0)]['nodes'].append(index)
    write(path, doc, binary)


if __name__ == '__main__':
    import sys
    for argument in sys.argv[1:]:
        apply(argument)
