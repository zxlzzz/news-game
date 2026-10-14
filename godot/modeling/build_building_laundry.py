"""Building shell; reusable facade parts are assembled in types/building_laundry.tscn.
Geometry lives in modeling/shells/building_laundry.json; placement in building-layouts.json.
Run with ordinary Python, without rebuilding any facade component.
"""
from build_modular_shell import rebuild
NAME = "building_laundry"
if __name__ == "__main__":
    rebuild(NAME)
