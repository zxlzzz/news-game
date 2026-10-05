"""Sun position (NOAA solar calculator equations) at the site on the imagery date.

Usage: python sun.py [azimuth_deg ...]   # prints the time and elevation when the sun has that azimuth
Without arguments prints the sun's path over the day.
"""
import math
import sys
from datetime import datetime, timedelta, timezone

LAT, LON = 37.531, 122.055   # campus centre
DATE = (2025, 5, 19)
TZ = timezone(timedelta(hours=8))


def sun(dt):
    """(azimuth from true north clockwise, elevation) in degrees; dt aware."""
    u = dt.astimezone(timezone.utc)
    jd = (u - datetime(2000, 1, 1, 12, tzinfo=timezone.utc)).total_seconds() / 86400 + 2451545.0
    t = (jd - 2451545.0) / 36525
    l0 = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360
    m = 357.52911 + t * (35999.05029 - 0.0001537 * t)
    e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    mr = math.radians(m)
    c = math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + math.sin(2 * mr) * (0.019993 - 0.000101 * t) + math.sin(3 * mr) * 0.000289
    lam = l0 + c - 0.00569 - 0.00478 * math.sin(math.radians(125.04 - 1934.136 * t))
    eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    eps = eps0 + 0.00256 * math.cos(math.radians(125.04 - 1934.136 * t))
    decl = math.asin(math.sin(math.radians(eps)) * math.sin(math.radians(lam)))
    y = math.tan(math.radians(eps / 2)) ** 2
    l0r = math.radians(l0)
    eqt = 4 * math.degrees(y * math.sin(2 * l0r) - 2 * e * math.sin(mr) + 4 * e * y * math.sin(mr) * math.cos(2 * l0r)
                           - 0.5 * y * y * math.sin(4 * l0r) - 1.25 * e * e * math.sin(2 * mr))
    minutes = u.hour * 60 + u.minute + u.second / 60
    tst = (minutes + eqt + 4 * LON) % 1440
    ha = math.radians(tst / 4 - 180)
    lat = math.radians(LAT)
    cz = math.sin(lat) * math.sin(decl) + math.cos(lat) * math.cos(decl) * math.cos(ha)
    zen = math.acos(max(-1, min(1, cz)))
    az = math.degrees(math.atan2(math.sin(ha), math.cos(ha) * math.sin(lat) - math.tan(decl) * math.cos(lat))) + 180
    return az % 360, 90 - math.degrees(zen)


def day():
    t0 = datetime(*DATE, 5, 0, tzinfo=TZ)
    return [t0 + timedelta(minutes=i) for i in range(0, 15 * 60)]


if __name__ == '__main__':
    if len(sys.argv) == 1:
        for t in day()[::30]:
            a, el = sun(t)
            print(t.strftime('%H:%M'), f'az {a:6.1f}  el {el:5.1f}')
    for s in sys.argv[1:]:
        want = float(s)
        t = min((t for t in day() if sun(t)[1] > 0), key=lambda t: abs(sun(t)[0] - want))
        a, el = sun(t)
        print(f'azimuth {want}: {t:%H:%M} Beijing time, azimuth {a:.1f}, elevation {el:.1f}, tan {math.tan(math.radians(el)):.3f}')
