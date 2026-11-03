"""Run explicitly selected deterministic builders in one background Blender process."""
import json
import runpy
import sys
from pathlib import Path
import os
import tempfile
from io_scene_gltf2.io.exp import export as gltf_export

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
request=json.loads(Path(sys.argv[sys.argv.index('--')+1]).read_text(encoding='utf-8'))

# Some Windows readers reject opening an existing GLB for truncation. Export to
# a new file, then atomically replace the completed asset; no partial GLB is left.
original_save=gltf_export.save_gltf
def atomic_save(gltf,settings,*args,**kwargs):
    target=Path(settings['gltf_filepath'])
    with tempfile.TemporaryDirectory(dir=target.parent,prefix='.model-build-') as temporary:
        pending=Path(temporary)/target.name
        settings['gltf_filepath']=str(pending)
        try:
            result=original_save(gltf,settings,*args,**kwargs)
            os.replace(pending,target)
            return result
        finally:
            settings['gltf_filepath']=str(target)
gltf_export.save_gltf=atomic_save
try:
    for name in request['blender']:
        assert name.replace('_','').isalnum(),name
        runpy.run_path(str(HERE/f'build_{name}.py'),run_name='__main__')
    print('SUBSET_BUILD_OK',len(request['blender']),flush=True)
except Exception:
    import traceback
    traceback.print_exc()
    sys.exit(1)
