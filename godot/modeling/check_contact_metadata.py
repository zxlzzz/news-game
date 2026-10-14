"""Check the library contact schema and reject mutations without changing a GLB."""
import copy,json,math,tempfile
from pathlib import Path
import model_contacts as contacts

HERE=Path(__file__).resolve().parent
def main():
    config=json.loads(contacts.CONFIG.read_text(encoding='utf8'))
    count=0
    for definitions in config['models'].values():
        for definition in definitions.values():
            contacts.contact_metadata(definition);count+=1
    base={'at':[0,0,0],'purpose':'physical test'}
    invalid=[None,[],{},dict(base,ignored=True),dict(base,footprint_anchor_fraction=.5),
             dict(base,at=[0,0]),dict(base,at=[True,0,0]),dict(base,at=[0,math.nan,0]),
             dict(base,purpose=4),dict(base,purpose=' '),dict(base,parent=4),
             dict(base,geometry_origin=1),dict(base,rotation=[0,0,0]),
             dict(base,rotation=[0,0,0,math.inf]),dict(base,rotation=[0,0,0,2])]
    source=HERE.parent/'models/outdoor_steps_8.glb';original=source.read_bytes()
    with tempfile.TemporaryDirectory(prefix='contact-schema-',dir=HERE) as temporary:
        folder=Path(temporary).resolve();folder.relative_to(HERE.resolve())
        model=folder/source.name;model.write_bytes(original)
        old_config=contacts.CONFIG;contacts.CONFIG=folder/'contacts.json'
        try:
            for definition in invalid:
                contacts.CONFIG.write_text(json.dumps({'models':{source.stem:{'fixture_contact':definition}}}),encoding='utf8')
                before=model.read_bytes()
                try:contacts.apply(model)
                except ValueError:pass
                else:raise AssertionError('Invalid contact was accepted: '+repr(definition))
                assert model.read_bytes()==before,'Rejected settings modified the GLB'
            valid=copy.deepcopy(config['models'][source.stem])
            contacts.CONFIG.write_text(json.dumps({'models':{source.stem:valid}}),encoding='utf8')
            contacts.apply(model);assert model.read_bytes()==original,'Valid library markers changed'
            contacts.apply(model);assert model.read_bytes()==original,'Valid apply is not idempotent'
        finally:contacts.CONFIG=old_config
    assert source.read_bytes()==original
    print(f'CONTACT_METADATA_OK definitions={count} rejected={len(invalid)}; rejected writes unchanged; valid GLB exact and idempotent')
if __name__=='__main__':main()
