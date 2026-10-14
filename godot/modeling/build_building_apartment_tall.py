"""Building shell; reusable facade parts are assembled in types/building_apartment_tall.tscn.
Geometry lives in modeling/shells/building_apartment_tall.json; placement in building-layouts.json.
Run with ordinary Python, without rebuilding any facade component.
"""
from build_modular_shell import rebuild
NAME = "building_apartment_tall"
if __name__ == "__main__":
    rebuild(NAME)
