"""Building shell; reusable facade parts are assembled in types/building_parking_garage.tscn.
Geometry lives in modeling/shells/building_parking_garage.json; placement in building-layouts.json.
Run with ordinary Python, without rebuilding any facade component.
"""
from build_modular_shell import rebuild
NAME = "building_parking_garage"
if __name__ == "__main__":
    rebuild(NAME)
