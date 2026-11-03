"""Ground cover from the site imagery: one class per cell (imagery pixel x downsample).

Usage: python godot/real_place/classify_cover.py godot/scenes/<site>
Reads <imagery.dir>/site.jpg and the scene's cover_samples.json (rectangles of known cover, scene
metres), trains a classifier on multi-scale colour/texture features and labels every cell.
Writes <imagery.dir>/cover.npz and cover_preview.png. Classes are ground only: roofs are 'paving'
(buildings cover them in stage 2); roads, lakes, sports grounds and hand corrections are laid over
this from vectors later. Settings in the scene's cover_params.json.
"""
import json
import sys
import warnings
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).parent))
from geo import Site

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parents[2]
PREVIEW = {'paving': (205, 200, 190), 'grass': (150, 195, 100), 'woodland': (40, 95, 50),
           'dirt': (200, 160, 105), 'water': (60, 110, 175)}


def features(rgb, scales):
    r, g, b = (rgb[..., k] for k in range(3))
    s = r + g + b + 1e-3
    v = s / 3
    exg = (2 * g - r - b) / s
    rb = (r - b) / s
    sat = (rgb.max(-1) - rgb.min(-1)) / s
    out = [r, g, b, exg, rb, sat]
    for w in scales:
        mv = ndi.uniform_filter(v, w)
        out += [mv, np.sqrt(np.maximum(ndi.uniform_filter(v * v, w) - mv * mv, 0)),
                ndi.uniform_filter(exg, w), ndi.uniform_filter(rb, w), ndi.uniform_filter(sat, w)]
    return np.stack(out, -1).astype(np.float32)


def main(scene):
    site = Site(scene)
    scene = Path(scene)
    p = json.loads((scene / 'cover_params.json').read_text(encoding='utf-8'))
    samples = json.loads((scene / 'cover_samples.json').read_text(encoding='utf-8'))
    classes = [c for c in PREVIEW if c in samples]
    d = ROOT / site.cfg['imagery']['dir']
    meta = json.loads((d / 'site.json').read_text(encoding='utf-8'))
    im = Image.open(d / 'site.jpg').convert('RGB')
    f = p['downsample']
    im = im.resize((im.width // f, im.height // f), Image.BOX)
    mpp = meta['metres_per_px'] * f
    ox, oz = meta['origin_xz']
    feat = features(np.asarray(im, dtype=np.float32), p['feature_windows_px'])
    xs, ys = [], []
    rng = np.random.default_rng(0)
    for k, c in enumerate(classes):
        for x0, z0, x1, z1 in samples[c]:
            a = feat[round((z0 - oz) / mpp):round((z1 - oz) / mpp), round((x0 - ox) / mpp):round((x1 - ox) / mpp)].reshape(-1, feat.shape[-1])
            if len(a) == 0:
                raise SystemExit(f'empty sample rectangle {c} {[x0, z0, x1, z1]}')
            a = a[rng.choice(len(a), min(len(a), p['max_samples_per_rect']), replace=False)]
            xs.append(a)
            ys.append(np.full(len(a), k))
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        from sklearn.ensemble import HistGradientBoostingClassifier
    model = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.1, random_state=0)
    model.fit(np.concatenate(xs), np.concatenate(ys))
    h, w, n = feat.shape
    prob = np.zeros((len(classes), h, w), np.float32)
    for r0 in range(0, h, 256):
        blk = feat[r0:r0 + 256].reshape(-1, n)
        prob[:, r0:r0 + 256] = model.predict_proba(blk).T.reshape(len(classes), -1, w)
    # Smooth the class probabilities, not the labels: edges follow the imagery but lose speckle.
    for k in range(len(classes)):
        prob[k] = ndi.gaussian_filter(prob[k], p['smooth_sigma_px'])
    cls = prob.argmax(0).astype(np.uint8)
    # Building shadows look like water; real water comes in large pieces. Small pieces take their
    # next most likely class.
    if 'water' in classes:
        wk = classes.index('water')
        lab, n = ndi.label(cls == wk)
        area = np.bincount(lab.ravel()) * mpp * mpp
        small = (lab > 0) & (area[lab] < p['min_water_m2'])
        prob[wk][small] = -1
        cls[small] = prob[:, small].argmax(0)
    np.savez_compressed(d / 'cover.npz', classes=cls, names=np.array(classes), metres_per_px=mpp,
                        origin_xz=np.array([ox, oz]))
    lut = np.array([PREVIEW[c] for c in classes], np.uint8)
    Image.fromarray(lut[cls]).save(d / 'cover_preview.png')
    counts = np.bincount(cls.ravel(), minlength=len(classes)) / cls.size
    print('COVER_OK', cls.shape, {c: round(float(x), 3) for c, x in zip(classes, counts)})


if __name__ == '__main__':
    main(sys.argv[1])
