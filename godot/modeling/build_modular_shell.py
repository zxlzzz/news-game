"""Rebuild a building shell, then assemble cached component types.

The shell definition contains only walls, floors, reveals and structural geometry.
Doors, windows, signs, awnings and furnishings have independent definitions/builders.
"""
from pathlib import Path
from build_component import build
from model_contacts import apply
from modular_buildings import assemble


def rebuild(name):
    build(name, source='shells')
    apply(Path(__file__).resolve().parents[1]/'models'/f'{name}.glb')
    assemble(name)
