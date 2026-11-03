"""Site coordinates: WGS84 lon/lat <-> UTM <-> scene metres (X east, Y up, Z south).

The scene frame is the UTM grid shifted to the site origin, so imagery requested in UTM maps to
scene metres by a plain offset. Krüger series to n^3: sub-millimetre inside a zone.
"""
import json
import math
from pathlib import Path

A_WGS = 6378137.0
F_WGS = 1 / 298.257223563
K0 = 0.9996
_n = F_WGS / (2 - F_WGS)
_A = A_WGS / (1 + _n) * (1 + _n**2 / 4 + _n**4 / 64)
_alpha = (_n / 2 - 2 * _n**2 / 3 + 5 * _n**3 / 16, 13 * _n**2 / 48 - 3 * _n**3 / 5, 61 * _n**3 / 240)
_beta = (_n / 2 - 2 * _n**2 / 3 + 37 * _n**3 / 96, _n**2 / 48 + _n**3 / 15, 17 * _n**3 / 480)
_delta = (2 * _n - 2 * _n**2 / 3 - 2 * _n**3, 7 * _n**2 / 3 - 8 * _n**3 / 5, 56 * _n**3 / 15)
_c = 2 * math.sqrt(_n) / (1 + _n)


def utm_epsg(zone):
    return 32600 + zone


def to_utm(lon, lat, zone):
    lam = math.radians(lon - (zone * 6 - 183))
    s = math.sin(math.radians(lat))
    t = math.sinh(math.atanh(s) - _c * math.atanh(_c * s))
    xi = math.atan2(t, math.cos(lam))
    eta = math.atanh(math.sin(lam) / math.sqrt(1 + t * t))
    e = eta + sum(a * math.cos(2 * j * xi) * math.sinh(2 * j * eta) for j, a in enumerate(_alpha, 1))
    n = xi + sum(a * math.sin(2 * j * xi) * math.cosh(2 * j * eta) for j, a in enumerate(_alpha, 1))
    return 500000 + K0 * _A * e, K0 * _A * n


def from_utm(e, n, zone):
    xi = n / (K0 * _A)
    eta = (e - 500000) / (K0 * _A)
    xp = xi - sum(b * math.sin(2 * j * xi) * math.cosh(2 * j * eta) for j, b in enumerate(_beta, 1))
    ep = eta - sum(b * math.cos(2 * j * xi) * math.sinh(2 * j * eta) for j, b in enumerate(_beta, 1))
    chi = math.asin(math.sin(xp) / math.cosh(ep))
    lat = chi + sum(d * math.sin(2 * j * chi) for j, d in enumerate(_delta, 1))
    lon = (zone * 6 - 183) + math.degrees(math.atan2(math.sinh(ep), math.cos(xp)))
    return lon, math.degrees(lat)


def from_utm_np(e, n, zone):
    """from_utm for NumPy arrays."""
    import numpy as np
    xi = n / (K0 * _A)
    eta = (e - 500000) / (K0 * _A)
    xp = xi - sum(b * np.sin(2 * j * xi) * np.cosh(2 * j * eta) for j, b in enumerate(_beta, 1))
    ep = eta - sum(b * np.cos(2 * j * xi) * np.sinh(2 * j * eta) for j, b in enumerate(_beta, 1))
    chi = np.arcsin(np.sin(xp) / np.cosh(ep))
    lat = chi + sum(d * np.sin(2 * j * chi) for j, d in enumerate(_delta, 1))
    lon = (zone * 6 - 183) + np.degrees(np.arctan2(np.sinh(ep), np.cos(xp)))
    return lon, np.degrees(lat)


class Site:
    """Reads a scene's site.json: UTM zone, origin, extent (scene metres)."""

    def __init__(self, scene_dir):
        self.dir = Path(scene_dir)
        s = json.loads((self.dir / 'site.json').read_text(encoding='utf-8'))
        self.cfg = s
        self.zone = s['utm_zone']
        self.origin_e, self.origin_n = s['origin_utm']
        self.x0, self.x1 = s['extent_m']['x']
        self.z0, self.z1 = s['extent_m']['z']

    def lonlat_to_xz(self, lon, lat):
        e, n = to_utm(lon, lat, self.zone)
        return e - self.origin_e, self.origin_n - n

    def xz_to_lonlat(self, x, z):
        return from_utm(x + self.origin_e, self.origin_n - z, self.zone)

    def xz_to_utm(self, x, z):
        return x + self.origin_e, self.origin_n - z

    def xz_to_lonlat_np(self, x, z):
        return from_utm_np(x + self.origin_e, self.origin_n - z, self.zone)
