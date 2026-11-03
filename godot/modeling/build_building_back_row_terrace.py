"""Building shell; reusable facade parts are assembled in types/building_back_row_terrace.tscn.
Geometry lives in modeling/shells/building_back_row_terrace.json; placement in building-layouts.json.
Run with ordinary Python, without rebuilding any facade component.
"""
from build_modular_shell import rebuild
NAME = "building_back_row_terrace"
if __name__ == "__main__":
    rebuild(NAME)
