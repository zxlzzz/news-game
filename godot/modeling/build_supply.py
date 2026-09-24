"""Rebuild the original model supply. Blender --background --python this_file [-- name ...]."""
import json
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
names = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [
    entry['name'] for entry in json.loads((ROOT/'supply_catalog.json').read_text(encoding='utf-8'))]
for name in names:
    if not name.replace('_', '').isalnum():
        raise ValueError(name)
    runpy.run_path(str(ROOT/('build_'+name+'.py')), run_name='__main__')
print('SUPPLY_BUILD_OK', len(names))
