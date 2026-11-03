"""Fetch dated satellite imagery for a site, in its UTM grid, and stitch it into one image.

Usage: python godot/real_place/fetch_imagery.py godot/scenes/<site>
Writes <imagery.dir>/site.jpg (north up, pixel (0,0) = scene (x0, z0)) and site.json with the
metres per pixel and the service's acquisition metadata for the centre.
"""
import io
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from geo import Site, utm_epsg

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parents[2]


def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return r.read()
        except Exception as e:  # network hiccups: retry, then fail loudly
            if k == tries - 1:
                raise
            print('retry', e)
            time.sleep(3)


def fetch(service, sr, site, x0, z0, size_m, px):
    """One square of imagery. Over some areas (open sea) the service refuses the full resolution;
    such a square is fetched at half the pixels and scaled up."""
    e0, n1 = site.xz_to_utm(x0, z0)
    e1, n0 = site.xz_to_utm(x0 + size_m, z0 + size_m)
    q = urllib.parse.urlencode({'bbox': f'{e0},{n0},{e1},{n1}', 'bboxSR': sr, 'imageSR': sr,
                                'size': f'{px},{px}', 'format': 'jpg', 'f': 'json'})
    meta = json.loads(get(service + '?' + q))
    if not meta['href']:
        assert px > 128, f'service refuses even {px} px: {meta}'
        print('  coarse square', round(size_m / px * 2, 2), 'm/px at', round(x0), round(z0))
        return fetch(service, sr, site, x0, z0, size_m, px // 2).resize((px, px), Image.BICUBIC)
    ext = meta['extent']
    assert abs(ext['xmin'] - e0) < 0.5 and abs(ext['ymax'] - n1) < 0.5, f'service moved the extent: {ext}'
    return Image.open(io.BytesIO(get(meta['href']))).convert('RGB')


def main(scene):
    site = Site(scene)
    cfg = site.cfg['imagery']
    out = ROOT / cfg['dir']
    out.mkdir(parents=True, exist_ok=True)
    mpp, tpx = cfg['metres_per_px'], cfg['tile_px']
    tile_m = mpp * tpx
    nx = round((site.x1 - site.x0) / tile_m)
    nz = round((site.z1 - site.z0) / tile_m)
    assert abs(nx * tile_m - (site.x1 - site.x0)) < 1e-6 and abs(nz * tile_m - (site.z1 - site.z0)) < 1e-6, \
        'extent must be a whole number of tiles'
    sr = utm_epsg(site.zone)
    full = Image.new('RGB', (nx * tpx, nz * tpx))
    for j in range(nz):
        for i in range(nx):
            path = out / f'tile_{i}_{j}.jpg'
            if not path.exists():
                fetch(cfg['service'], sr, site, site.x0 + i * tile_m, site.z0 + j * tile_m, tile_m, tpx).save(path, quality=95)
                print('tile', i, j, path.stat().st_size)
            full.paste(Image.open(path).convert('RGB'), (i * tpx, j * tpx))
    full.save(out / 'site.jpg', quality=92)
    # Acquisition metadata at the site centre (the export itself carries none).
    lon, lat = site.xz_to_lonlat((site.x0 + site.x1) / 2, (site.z0 + site.z1) / 2)
    ident = urllib.parse.urlencode({
        'geometry': f'{lon},{lat}', 'geometryType': 'esriGeometryPoint', 'sr': 4326, 'layers': 'all',
        'tolerance': 0, 'mapExtent': f'{lon-0.01},{lat-0.01},{lon+0.01},{lat+0.01}', 'imageDisplay': '1000,1000,96',
        'returnGeometry': 'false', 'f': 'json'})
    info = json.loads(get(cfg['service'].rsplit('/', 1)[0] + '/identify?' + ident))
    rec = {'metres_per_px': mpp, 'size_px': list(full.size), 'origin_xz': [site.x0, site.z0],
           'utm_epsg': sr, 'centre_identify': [r.get('attributes') for r in info.get('results', [])]}
    (out / 'site.json').write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding='utf-8')
    print('IMAGERY_OK', full.size)


if __name__ == '__main__':
    main(sys.argv[1])
