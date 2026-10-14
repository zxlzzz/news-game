"""Building shell; reusable facade parts are assembled in types/building_bookstore.tscn.
Geometry lives in modeling/shells/building_bookstore.json; placement in building-layouts.json.
Run with ordinary Python, without rebuilding any facade component.
"""
from build_modular_shell import rebuild
NAME = "building_bookstore"
if __name__ == "__main__":
    rebuild(NAME)
