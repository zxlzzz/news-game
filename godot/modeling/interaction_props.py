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
        if kind == 'car_shell':
            from movable_prop_geometry import build_interactive_car_shell
            build_interactive_car_shell(*args)
        elif kind == 'wheel_fit':
            from vehicle_geometry import finish_wheeled_vehicle
            finish_wheeled_vehicle(geometry.bpy.context.scene.objects,*args)
        elif kind == 'cut_ellipsoid':
            body_name,cut_name,size,center=args
            body=geometry.bpy.data.objects[body_name]
            geometry.subtract(body,geometry.ellipsoid(cut_name,size,center,None),cut_name)
        elif kind == 'receiver_shell':
            from receiver_geometry import receiver_shell
            receiver_shell(*args)
        else:
            getattr(geometry, kind)(*args)
    if name == 'car_interactive':
        from movable_prop_geometry import finish_interactive_car_shell
        finish_interactive_car_shell(definitions[name][0][1])
    geometry.export(name)


if __name__ == '__main__':
    for name in json.loads((HERE / 'interaction-props.json').read_text()):
        build(name)
