"""Deterministic interaction props; dimensions are in interaction-props.json."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import model_geometry as geometry


def build(name):
    definitions = json.loads((HERE / 'interaction-props.json').read_text())
    geometry.reset()
    for kind, *args in definitions[name]:
        getattr(geometry, kind)(*args)
    geometry.export(name)


if __name__ == '__main__':
    for name in json.loads((HERE / 'interaction-props.json').read_text()):
        build(name)
