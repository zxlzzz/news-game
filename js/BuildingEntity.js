/**
 * BuildingEntity — 俯视角"老街区"沿街楼，6 种原型
 */

import { Entity } from './Entity.js';
import { LINE_FAR_COLOR, LINE_FAR_WIDTH } from './SceneConfig.js';

const ARCH = {
  resi: {
    wall: 0xc6c6c6, roof: 0xb6b6b6, floorH: 15, groundFrac: 0.24, groundMax: 26,
    style: 'windows', balcony: true, grille: false, glass: false,
    dirty: 0.0, laundry: 0.4, acFreq: 0.45, ground: 'shop', shops: ['convenience', 'fork'],
  },
  oldmix: {
    wall: 0x9c9c9c, roof: 0x8c8c8c, floorH: 16, groundFrac: 0.30, groundMax: 30,
    style: 'grille', balcony: false, grille: true, glass: false,
    dirty: 0.55, laundry: 0.5, acFreq: 0.6, ground: 'roller', shops: ['fork', 'dots'],
  },
  modern: {
    wall: 0xdadada, roof: 0xcacaca, floorH: 16, groundFrac: 0.26, groundMax: 26,
    style: 'glass', balcony: false, grille: false, glass: true,
    dirty: 0.0, laundry: 0.0, acFreq: 0.1, ground: 'glassshop', shops: ['cup', 'book', 'dumbbell'],
  },
  clinic: {
    wall: 0xe2e2e2, roof: 0xd2d2d2, floorH: 15, groundFrac: 0.34, groundMax: 24,
    style: 'windows', balcony: false, grille: false, glass: false,
    dirty: 0.0, laundry: 0.0, acFreq: 0.15, ground: 'clinic', shops: ['cross'],
  },
  convenience: {
    wall: 0xcfcfcf, roof: 0xc0c0c0, floorH: 14, groundFrac: 0.58, groundMax: 28,
    style: 'windows', balcony: false, grille: false, glass: false,
    dirty: 0.1, laundry: 0.0, acFreq: 0.3, ground: 'cvs', shops: ['dots'],
  },
  bookstore: {
    wall: 0xbcbcbc, roof: 0xacacac, floorH: 15, groundFrac: 0.40, groundMax: 26,
    style: 'windows', balcony: false, grille: false, glass: false,
    dirty: 0.25, laundry: 0.0, acFreq: 0.2, ground: 'bookshop', shops: ['book'],
  },
  default: {
    wall: 0xc6c6c6, roof: 0xb6b6b6, floorH: 15, groundFrac: 0.26, groundMax: 26,
    style: 'windows', balcony: true, grille: false, glass: false,
    dirty: 0.1, laundry: 0.3, acFreq: 0.4, ground: 'shop', shops: ['dots'],
  },
};

function seededRand(x, salt = 0) {
  const s = Math.sin(x * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export class BuildingEntity extends Entity {
  constructor(config) {
    super({ ...config, width: config.bWidth ?? 100, height: config.bDepth ?? 70, static: true });
    this.bWidth     = config.bWidth     ?? 100;
    this.bDepth     = config.bDepth     ?? 70;
    this.waterTower = config.waterTower ?? false;
    this.solar      = config.solar      ?? false;
    this.billboard  = config.billboard  ?? false;

    const t = (this.tags ?? []).find(tag => tag in ARCH) || 'default';
    this.arch = t;
    this.A    = ARCH[t];
    this.facadeH = config.facadeH ?? 90;
  }

  get _sortY() { return this.y + this.facadeH; }

  getBounds() {
    return { x: this.x, y: this.y - this.bDepth, width: this.bWidth, height: this.bDepth };
  }

  draw(g) {
    if (!this.visible) return;
    const { x, bWidth: w, bDepth: d, A } = this;
    const base = this.y + this.facadeH;
    const top  = this.y - d;

    // roof
    g.beginFill(A.roof, 1); g.drawRect(x, top, w, d); g.endFill();
    g.beginFill(0xffffff, 0.10); g.drawRect(x, top, w, Math.floor(d * 0.32)); g.endFill();
    g.beginFill(0x000000, 0.10); g.drawRect(x, top + d * 0.68, w, d * 0.32); g.endFill();
    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 0.95); g.drawRect(x, top, w, d);
    this._roofDetails(g, top, d);
    if (this.solar)      this._solarPanels(g, top, d);
    if (this.waterTower) this._waterTower(g, top, d);
    if (this.billboard)  this._billboard(g, top);

    g.lineStyle(1.2, 0x303030, 0.45); g.moveTo(x, base); g.lineTo(x + w, base);

    this._facade(g, x, w);

    if (this.alleyLeft) {
      g.beginFill(0x555555, 0.5); g.drawRect(x - 1, top, 8, base - top + 1); g.endFill();
      g.beginFill(0xffffff, 0.08); g.drawRect(x + 7, top, 1.5, base - top + 1); g.endFill();
    }
  }

  _facade(g, x, w) {
    const H = this.facadeH, y = this.y, A = this.A;
    g.beginFill(A.wall, 1); g.drawRect(x, y, w, H); g.endFill();
    g.beginFill(0x000000, 0.16); g.drawRect(x, y, 3, H); g.endFill();
    g.beginFill(0x000000, 0.20); g.drawRect(x, y, w, 3); g.endFill();

    const groundH = Math.min(A.groundMax, Math.round(H * A.groundFrac));
    const resH    = H - groundH;

    if (A.dirty > 0) this._dirty(g, x, y, w, H, A.dirty);

    if (A.style === 'glass')       this._upperGlass(g, x, y, w, resH);
    else if (A.style === 'grille') this._upperGrille(g, x, y, w, resH);
    else                           this._upperWindows(g, x, y, w, resH);

    this._ground(g, x, y + resH, w, groundH);

    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 0.95); g.drawRect(x, y, w, H);
  }

  _upperWindows(g, x, y, w, resH) {
    if (resH < 8) return;
    const A = this.A;
    const n  = Math.max(1, Math.round(resH / A.floorH));
    const fh = resH / n;
    const colW = 10, gap = 7;
    const nCol = Math.max(1, Math.floor((w - 6) / (colW + gap)));
    const sx = x + (w - (nCol * (colW + gap) - gap)) / 2;

    for (let f = 0; f < n; f++) {
      const fy = y + f * fh;
      g.lineStyle(0.6, 0x2c2c2c, 0.45); g.moveTo(x + 2, fy); g.lineTo(x + w - 2, fy);
      for (let c = 0; c < nCol; c++) {
        const wx = sx + c * (colW + gap), wy = fy + 2, wh = fh - 6;
        if (wh < 3) continue;
        const v = seededRand(x + wx * 1.3, f * 3 + c);
        const shade = v > 0.78 ? 0x9a9a9a : (v < 0.2 ? 0x2a2a2a : 0x383838);
        g.beginFill(shade, 0.85); g.drawRect(wx, wy, colW, wh); g.endFill();
        g.lineStyle(0.4, 0xb8b8b8, 0.45); g.moveTo(wx + colW / 2, wy); g.lineTo(wx + colW / 2, wy + wh);
        g.lineStyle(0.5, 0x101010, 0.8); g.drawRect(wx, wy, colW, wh);
        if (A.balcony) {
          const ry = fy + fh - 3;
          g.lineStyle(0.6, 0x555555, 0.85); g.moveTo(wx - 1, ry); g.lineTo(wx + colW + 1, ry);
          for (let bx = wx; bx <= wx + colW; bx += 3) { g.moveTo(bx, ry); g.lineTo(bx, ry + 2.5); }
        }
        const dec = seededRand(x + wx, f * 7 + c * 5);
        if (A.acFreq && dec < A.acFreq && wx + colW + 6 < x + w) this._ac(g, wx + colW + 1, wy + 1);
        else if (A.laundry && dec > 1 - A.laundry) this._laundry(g, wx, colW, wy);
        else if (A.balcony && dec > 0.6 && dec < 0.72) this._green(g, wx + colW / 2, fy + fh - 3);
      }
    }
  }

  _upperGrille(g, x, y, w, resH) {
    if (resH < 8) return;
    const A = this.A;
    const n  = Math.max(1, Math.round(resH / A.floorH));
    const fh = resH / n;
    const colW = 9, gap = 5;
    const nCol = Math.max(1, Math.floor((w - 4) / (colW + gap)));
    const sx = x + (w - (nCol * (colW + gap) - gap)) / 2;
    for (let f = 0; f < n; f++) {
      const fy = y + f * fh;
      g.lineStyle(0.6, 0x202020, 0.5); g.moveTo(x + 2, fy); g.lineTo(x + w - 2, fy);
      for (let c = 0; c < nCol; c++) {
        const jitter = (seededRand(x + c * 9, f) - 0.5) * 2;
        const wx = sx + c * (colW + gap), wy = fy + 2 + jitter, wh = fh - 6;
        if (wh < 3) continue;
        g.beginFill(0x303030, 0.85); g.drawRect(wx, wy, colW, wh); g.endFill();
        g.lineStyle(0.5, 0x101010, 0.85); g.drawRect(wx, wy, colW, wh);
        g.lineStyle(0.4, 0xbcbcbc, 0.7);
        g.drawRect(wx - 1, wy - 1, colW + 2, wh + 2);
        for (let gx = wx + 2; gx < wx + colW; gx += 3) { g.moveTo(gx, wy - 1); g.lineTo(gx, wy + wh + 1); }
        for (let gyv = wy + 2; gyv < wy + wh; gyv += 3) { g.moveTo(wx - 1, gyv); g.lineTo(wx + colW + 1, gyv); }
        const dec = seededRand(x + wx, f * 4 + c);
        if (dec < A.acFreq && wx + colW + 6 < x + w) this._ac(g, wx + colW + 1, wy + 1);
        else if (dec > 1 - A.laundry) this._laundry(g, wx, colW, wy);
      }
    }
  }

  _upperGlass(g, x, y, w, resH) {
    if (resH < 8) return;
    const A = this.A;
    const n  = Math.max(2, Math.round(resH / A.floorH));
    const fh = resH / n;
    for (let f = 0; f < n; f++) {
      const fy = y + f * fh + 1.5;
      const bh = fh - 3;
      if (bh < 2) continue;
      g.beginFill(0x444444, 0.5); g.drawRect(x + 4, fy, w - 8, bh); g.endFill();
      g.beginFill(0xffffff, 0.18); g.drawRect(x + 4, fy, w - 8, bh * 0.45); g.endFill();
      g.lineStyle(0.5, 0x101010, 0.75); g.drawRect(x + 4, fy, w - 8, bh);
      const segs = Math.max(3, Math.floor((w - 8) / 12));
      g.lineStyle(0.4, 0x9a9a9a, 0.5);
      for (let i = 1; i < segs; i++) { const lx = x + 4 + (w - 8) * i / segs; g.moveTo(lx, fy); g.lineTo(lx, fy + bh); }
    }
  }

  _dirty(g, x, y, w, H, amount) {
    const k = Math.floor(amount * 5);
    for (let i = 0; i < k; i++) {
      const dx = x + 3 + seededRand(x, 100 + i) * (w - 8);
      const dw = 1 + seededRand(x, 110 + i) * 2.5;
      g.beginFill(0x000000, 0.07 + seededRand(x, 120 + i) * 0.06);
      g.drawRect(dx, y + 2, dw, H * (0.4 + seededRand(x, 130 + i) * 0.5));
      g.endFill();
    }
  }

  _ground(g, x, gy, w, gh) {
    switch (this.A.ground) {
      case 'roller':    this._gRoller(g, x, gy, w, gh); break;
      case 'glassshop': this._gGlassShop(g, x, gy, w, gh); break;
      case 'clinic':    this._gClinic(g, x, gy, w, gh); break;
      case 'cvs':       this._gCvs(g, x, gy, w, gh); break;
      case 'bookshop':  this._gBookshop(g, x, gy, w, gh); break;
      case 'shop':
      default:          this._gShop(g, x, gy, w, gh); break;
    }
  }

  _shopKind() { const s = this.A.shops; return s[Math.floor(seededRand(this.x, 7) * s.length)]; }
  _signH(min, max) { return Math.round(min + seededRand(this.x, 3) * (max - min)); }

  _gShop(g, x, gy, w, gh) {
    const sh = this._signH(5, 8);
    g.beginFill(0x8a8a8a, 1); g.drawRect(x + 3, gy + 1, w - 6, 3); g.endFill();
    g.lineStyle(0.5, 0x101010, 0.8); g.drawRect(x + 3, gy + 1, w - 6, 3);
    g.beginFill(0x2a2a2a, 1); g.drawRect(x + 4, gy + 4, w - 8, sh); g.endFill();
    this._icon(g, x + w / 2, gy + 4 + sh / 2, this._shopKind());
    this._shopGlass(g, x, gy + 4 + sh, w, gh - (4 + sh));
  }

  _gRoller(g, x, gy, w, gh) {
    const sh = this._signH(5, 9);
    const off = (seededRand(x, 4) - 0.5) * 4;
    g.beginFill(0x1f1f1f, 1); g.drawRect(x + 4 + off, gy + 2, w - 12, sh); g.endFill();
    g.lineStyle(0.5, 0x000000, 0.9); g.drawRect(x + 4 + off, gy + 2, w - 12, sh);
    this._icon(g, x + w / 2 + off, gy + 2 + sh / 2, this._shopKind());
    const rY = gy + 3 + sh, rH = gh - (3 + sh) - 1;
    if (rH > 2) {
      g.beginFill(0x6e6e6e, 1); g.drawRect(x + 4, rY, w - 8, rH); g.endFill();
      g.lineStyle(0.4, 0x3a3a3a, 0.8);
      for (let ly = rY + 1.5; ly < rY + rH; ly += 2) { g.moveTo(x + 4, ly); g.lineTo(x + w - 4, ly); }
      g.lineStyle(0.5, 0x101010, 0.85); g.drawRect(x + 4, rY, w - 8, rH);
    }
  }

  _gGlassShop(g, x, gy, w, gh) {
    g.beginFill(0x2f2f2f, 1); g.drawRect(x + 4, gy + 1, w - 8, 4); g.endFill();
    this._icon(g, x + w / 2, gy + 3, this._shopKind());
    const glY = gy + 6, glH = gh - 7;
    if (glH > 2) {
      g.beginFill(0x3a3a3a, 0.5); g.drawRect(x + 4, glY, w - 8, glH); g.endFill();
      g.beginFill(0xffffff, 0.2); g.drawRect(x + 5, glY + 1, w - 10, glH / 2); g.endFill();
      g.lineStyle(0.6, 0x101010, 0.8); g.drawRect(x + 4, glY, w - 8, glH);
      const segs = Math.max(2, Math.floor((w - 8) / 16));
      g.lineStyle(0.4, 0x808080, 0.5);
      for (let i = 1; i < segs; i++) { const lx = x + 4 + (w - 8) * i / segs; g.moveTo(lx, glY); g.lineTo(lx, glY + glH); }
    }
  }

  _gClinic(g, x, gy, w, gh) {
    this._shopGlass(g, x, gy + 6, w, gh - 6, true);
    g.beginFill(0x2a2a2a, 1); g.drawRect(x + 4, gy + 1, w - 8, 5); g.endFill();
    this._icon(g, x + w / 2, gy + 3.5, 'cross');
    const eW = Math.min(26, w * 0.4), eX = x + (w - eW) / 2;
    g.beginFill(0x5a5a5a, 1); g.drawRect(eX - 2, gy + 6, eW + 4, 3); g.endFill();
    g.lineStyle(0.5, 0x101010, 0.85); g.drawRect(eX - 2, gy + 6, eW + 4, 3);
    g.lineStyle(0.6, 0x707070, 0.8); g.moveTo(x + 6, gy + gh); g.lineTo(x + w - 6, gy + gh);
  }

  _gCvs(g, x, gy, w, gh) {
    g.beginFill(0x232323, 1); g.drawRect(x + 2, gy + 1, w - 4, 7); g.endFill();
    g.lineStyle(0.5, 0x000000, 0.9); g.drawRect(x + 2, gy + 1, w - 4, 7);
    this._icon(g, x + w / 2, gy + 4.5, 'dots');
    const glY = gy + 9, glH = gh - 10;
    if (glH > 2) {
      g.beginFill(0x383838, 0.55); g.drawRect(x + 4, glY, w - 8, glH); g.endFill();
      g.beginFill(0xffffff, 0.2); g.drawRect(x + 5, glY + 1, w - 10, glH / 2); g.endFill();
      g.lineStyle(0.6, 0x101010, 0.8); g.drawRect(x + 4, glY, w - 8, glH);
      g.beginFill(0x9a9a9a, 1);
      g.drawRect(x + 5, glY + glH - 4, 6, 4); g.drawRect(x + 12, glY + glH - 3, 5, 3);
      g.endFill();
      g.lineStyle(0.4, 0x303030, 0.85);
      g.drawRect(x + 5, glY + glH - 4, 6, 4); g.drawRect(x + 12, glY + glH - 3, 5, 3);
      const vW = 8, vX = x + w - 6 - vW;
      g.beginFill(0x4a4a4a, 1); g.drawRect(vX, glY + 1, vW, glH - 1); g.endFill();
      g.lineStyle(0.4, 0xcacaca, 0.6); g.drawRect(vX + 1, glY + 2, vW - 4, glH - 4);
      g.lineStyle(0.5, 0x101010, 0.85); g.drawRect(vX, glY + 1, vW, glH - 1);
    }
  }

  _gBookshop(g, x, gy, w, gh) {
    g.beginFill(0x4a4a4a, 1); g.drawRect(x + 3, gy + 1, w - 6, 6); g.endFill();
    g.lineStyle(0.6, 0x202020, 0.9); g.drawRect(x + 3, gy + 1, w - 6, 6);
    this._icon(g, x + w / 2, gy + 4, 'book');
    const glY = gy + 8, glH = gh - 9;
    if (glH > 2) {
      g.beginFill(0x383838, 0.5); g.drawRect(x + 4, glY, w - 8, glH); g.endFill();
      g.lineStyle(0.6, 0x101010, 0.8); g.drawRect(x + 4, glY, w - 8, glH);
      let bx = x + 6;
      while (bx < x + w - 10) {
        const bw = 1.5 + seededRand(x + bx, 1) * 2;
        const bhh = glH * (0.4 + seededRand(x + bx, 2) * 0.5);
        const sh = 0x6a6a6a + Math.floor(seededRand(x + bx, 3) * 0x40) * 0x010101;
        g.beginFill(sh, 0.9); g.drawRect(bx, glY + glH - bhh, bw, bhh); g.endFill();
        bx += bw + 1.2;
      }
      g.beginFill(0x1a1a1a, 0.9); g.drawRect(x + w - 5 - 7, glY + 1, 7, glH - 1); g.endFill();
    }
  }

  _shopGlass(g, x, gy, w, gh, lite = false) {
    if (gh <= 2) return;
    g.beginFill(lite ? 0x4a4a4a : 0x383838, lite ? 0.45 : 0.55); g.drawRect(x + 4, gy, w - 8, gh); g.endFill();
    g.beginFill(0xffffff, lite ? 0.22 : 0.18); g.drawRect(x + 5, gy + 1, w - 10, gh / 2); g.endFill();
    g.lineStyle(0.6, 0x101010, 0.8); g.drawRect(x + 4, gy, w - 8, gh);
    const segs = Math.max(2, Math.floor((w - 8) / 18));
    g.lineStyle(0.4, 0x808080, 0.5);
    for (let i = 1; i < segs; i++) { const lx = x + 4 + (w - 8) * i / segs; g.moveTo(lx, gy); g.lineTo(lx, gy + gh); }
    const dW = 9;
    g.beginFill(0x1a1a1a, 0.92); g.drawRect(x + w - 6 - dW, gy + 1, dW, gh - 1); g.endFill();
    g.lineStyle(0.5, 0x000000, 0.9); g.drawRect(x + w - 6 - dW, gy + 1, dW, gh - 1);
  }

  _ac(g, ax, ay) {
    g.beginFill(0x9a9a9a, 1); g.drawRect(ax, ay, 4, 3); g.endFill();
    g.lineStyle(0.4, 0x303030, 0.85); g.drawRect(ax, ay, 4, 3);
    g.moveTo(ax + 0.5, ay + 1.5); g.lineTo(ax + 3.5, ay + 1.5);
  }
  _laundry(g, wx, colW, wy) {
    const ly = wy - 1;
    g.lineStyle(0.4, 0x707070, 0.8); g.moveTo(wx, ly); g.lineTo(wx + colW, ly);
    g.beginFill(0xcacaca, 0.85); g.drawRect(wx + 2, ly, 2, 4); g.drawRect(wx + 6, ly, 2, 3); g.endFill();
  }
  _green(g, cx, ry) {
    g.beginFill(0x666666, 1); g.drawRect(cx - 3, ry - 2, 6, 2); g.endFill();
    g.beginFill(0x9c9c9c, 0.95); g.drawRect(cx - 2.5, ry - 4, 2, 2); g.drawRect(cx + 0.5, ry - 4, 2, 2); g.endFill();
  }

  _icon(g, cx, cy, type) {
    g.lineStyle(0.8, 0xe8e8e8, 0.95);
    switch (type) {
      case 'cart':
        g.moveTo(cx - 4, cy - 2); g.lineTo(cx + 3, cy - 2);
        g.moveTo(cx - 2, cy - 2); g.lineTo(cx - 1, cy + 1);
        g.moveTo(cx - 1, cy + 1); g.lineTo(cx + 3, cy + 1);
        g.beginFill(0xe8e8e8, 0.95); g.drawRect(cx - 1, cy + 2, 1.2, 1.2); g.drawRect(cx + 2, cy + 2, 1.2, 1.2); g.endFill();
        break;
      case 'cup':
        g.moveTo(cx - 3, cy - 2); g.lineTo(cx + 2, cy - 2);
        g.moveTo(cx - 3, cy - 2); g.lineTo(cx - 2, cy + 2);
        g.moveTo(cx + 2, cy - 2); g.lineTo(cx + 1, cy + 2);
        g.moveTo(cx - 2, cy + 2); g.lineTo(cx + 1, cy + 2);
        g.moveTo(cx + 2, cy - 1); g.lineTo(cx + 4, cy);
        break;
      case 'dumbbell':
        g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy);
        g.beginFill(0xe8e8e8, 0.95); g.drawRect(cx - 4, cy - 2, 1.5, 4); g.drawRect(cx + 2.5, cy - 2, 1.5, 4); g.endFill();
        break;
      case 'book':
        g.drawRect(cx - 4, cy - 2.5, 8, 5);
        g.moveTo(cx, cy - 2.5); g.lineTo(cx, cy + 2.5);
        break;
      case 'burger':
        g.moveTo(cx - 4, cy - 2); g.lineTo(cx + 4, cy - 2);
        g.moveTo(cx - 4, cy);     g.lineTo(cx + 4, cy);
        g.moveTo(cx - 4, cy + 2); g.lineTo(cx + 4, cy + 2);
        break;
      case 'cross':
        g.moveTo(cx, cy - 3); g.lineTo(cx, cy + 3);
        g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy);
        break;
      case 'fork':
        g.moveTo(cx - 2, cy - 3); g.lineTo(cx - 2, cy + 3);
        g.moveTo(cx + 2, cy - 3); g.lineTo(cx + 2, cy + 3);
        break;
      case 'dots':
      default:
        g.beginFill(0xe8e8e8, 0.95);
        for (const dx of [-3, 0, 3]) g.drawRect(cx + dx - 0.7, cy - 0.7, 1.4, 1.4);
        g.endFill();
        break;
    }
  }

  _roofDetails(g, roofTop, d) {
    const x = this.x, w = this.bWidth;
    const acCount = Math.floor(this.A.acFreq * 4);
    for (let i = 0; i < acCount; i++) {
      const ax = x + 8 + seededRand(x, 10 + i) * (w - 20);
      const ay = roofTop + 6 + seededRand(x, 20 + i) * (d - 16);
      const aw = 6 + Math.floor(seededRand(x, 30 + i) * 5), ah = 4 + Math.floor(seededRand(x, 40 + i) * 3);
      g.beginFill(0x9a9a9a, 1); g.drawRect(ax, ay, aw, ah); g.endFill();
      g.lineStyle(0.6, 0x303030, 0.85); g.drawRect(ax, ay, aw, ah);
    }
    if (seededRand(x, 50) > 0.5) {
      const ax = x + w * (0.5 + (seededRand(x, 51) - 0.5) * 0.5), ay = roofTop + d * 0.3;
      g.lineStyle(0.7, 0x202020, 0.95);
      g.moveTo(ax, ay); g.lineTo(ax, ay - 12);
      g.moveTo(ax - 3, ay - 4); g.lineTo(ax + 3, ay - 4);
      g.moveTo(ax - 2, ay - 7); g.lineTo(ax + 2, ay - 7);
    }
  }

  _solarPanels(g, roofTop, d) {
    const x = this.x, w = this.bWidth;
    const px = x + w * 0.5, py = roofTop + d * 0.4;
    for (let i = 0; i < 2; i++) {
      const sx = px - 14 + i * 15, sy = py - 3;
      g.beginFill(0x404040, 0.95); g.drawRect(sx, sy, 13, 7); g.endFill();
      g.lineStyle(0.4, 0x9a9a9a, 0.7);
      for (let k = 1; k < 3; k++) { g.moveTo(sx + 13 * k / 3, sy); g.lineTo(sx + 13 * k / 3, sy + 7); }
      g.moveTo(sx, sy + 3.5); g.lineTo(sx + 13, sy + 3.5);
      g.lineStyle(0.5, 0x101010, 0.85); g.drawRect(sx, sy, 13, 7);
    }
  }

  _billboard(g, roofTop) {
    const x = this.x, w = this.bWidth;
    const bw = Math.min(40, w * 0.5), bx = x + (w - bw) / 2, by = roofTop - 16;
    g.lineStyle(0.7, 0x303030, 0.9);
    g.moveTo(bx + 4, roofTop); g.lineTo(bx + 4, by + 10);
    g.moveTo(bx + bw - 4, roofTop); g.lineTo(bx + bw - 4, by + 10);
    g.beginFill(0xcfcfcf, 1); g.drawRect(bx, by, bw, 10); g.endFill();
    g.lineStyle(0.6, 0x202020, 0.9); g.drawRect(bx, by, bw, 10);
    g.lineStyle(0.5, 0x9a9a9a, 0.7);
    g.moveTo(bx + 4, by + 4); g.lineTo(bx + bw - 4, by + 4);
    g.moveTo(bx + 4, by + 6.5); g.lineTo(bx + bw - 10, by + 6.5);
  }

  _waterTower(g, roofTop, d) {
    const wx = this.x + this.bWidth * 0.32, wy = roofTop + d * 0.3, sz = 7;
    g.beginFill(0xb8b8b8, 1); g.drawRect(wx - sz, wy - sz, sz * 2, sz * 2); g.endFill();
    g.lineStyle(0.7, 0x303030, 0.95); g.drawRect(wx - sz, wy - sz, sz * 2, sz * 2);
    g.moveTo(wx - sz, wy - sz); g.lineTo(wx, wy - sz - 5);
    g.moveTo(wx + sz, wy - sz); g.lineTo(wx, wy - sz - 5);
    g.lineStyle(0.6, 0x303030, 0.85);
    g.moveTo(wx - sz + 2, wy + sz); g.lineTo(wx - sz + 2, wy + sz + 5);
    g.moveTo(wx + sz - 2, wy + sz); g.lineTo(wx + sz - 2, wy + sz + 5);
  }
}
