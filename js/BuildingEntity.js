/**
 * BuildingEntity — 俯视角"老街区"沿街楼，6 种原型：
 *   resi        普通居民楼（主）：6–8 层，浅灰墙，密集小阳台+外挂空调+晾衣，底层便利店/小餐馆
 *   oldmix      老旧商住楼：4–6 层，偏窄，防盗网+卷帘门+不规则招牌，墙面略脏，拥挤感
 *   modern      小型现代商业楼：3–5 层，玻璃立面，干净，底层咖啡/书店/健身
 *   clinic      社区诊所：2–3 层，白灰，规则窗，门口小雨棚+十字
 *   convenience 街角便利店：矮，横向大招牌，玻璃门，门口堆货箱+自动售货机
 *   bookstore   老式书店：窄门面，木质招牌，橱窗摆书，略旧文艺
 *
 * 纯灰阶。高度可由 scene.json 的 facadeH 覆盖（天际线参差）；可选 waterTower/solar/billboard。
 *
 * 坐标：this.x=左边缘；this.y=立面顶边；底边=this.y+facadeH=BUILDING_BASE_Y；屋顶在 y 之上。
 */

import { Entity } from './Entity.js';
import { LINE_FAR_COLOR, LINE_FAR_WIDTH } from './SceneConfig.js';

// 原型参数表
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

  // 深度排序用「地面接触线」= baseY（立面落地线）= this.y + facadeH。
  // 注意：_spawnBuildings 在构造之后才把 this.y 改成立面顶边（baseY - facadeH），
  // 构造器内 this.y 仍是 BUILDING_BASE_Y，直接赋值会取到旧值；故用 getter 惰性求值，
  // 保证排序时返回最终 baseY（与 draw() 里的 base 计算一致）。
  get _sortY() { return this.y + this.facadeH; }

  getBounds() {
    return { x: this.x, y: this.y - this.bDepth, width: this.bWidth, height: this.bDepth };
  }

  draw(g) {
    if (!this.visible) return;
    const { x, bWidth: w, bDepth: d, A } = this;
    const base = this.y + this.facadeH;
    const top  = this.y - d;

    // ── 屋顶 ──
    g.lineStyle(0); g.beginFill(A.roof, 1); g.drawRect(x, top, w, d); g.endFill();
    g.lineStyle(0); g.beginFill(0xffffff, 0.10); g.drawRect(x, top, w, Math.floor(d * 0.32)); g.endFill();
    g.lineStyle(0); g.beginFill(0x000000, 0.10); g.drawRect(x, top + d * 0.68, w, d * 0.32); g.endFill();
    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 0.95); g.drawRect(x, top, w, d); g.lineStyle(0);
    this._roofDetails(g, top, d);
    if (this.solar)      this._solarPanels(g, top, d);
    if (this.waterTower) this._waterTower(g, top, d);
    if (this.billboard)  this._billboard(g, top);

    // 临街地面线
    g.lineStyle(1.2, 0x303030, 0.45); g.moveTo(x, base); g.lineTo(x + w, base);

    // ── 立面 ──
    this._facade(g, x, w);

    // 巷道暗缝（与左邻楼之间），自屋顶贯通到地面，制造一栋栋分离的纵深
    if (this.alleyLeft) {
      g.lineStyle(0); g.beginFill(0x555555, 0.5); g.drawRect(x - 1, top, 8, base - top + 1); g.endFill();
      g.lineStyle(0); g.beginFill(0xffffff, 0.08); g.drawRect(x + 7, top, 1.5, base - top + 1); g.endFill();  // 右侧细高光，强调缝隙立体
    }
  }

  _facade(g, x, w) {
    const H = this.facadeH, y = this.y, A = this.A;
    g.lineStyle(0); g.beginFill(A.wall, 1); g.drawRect(x, y, w, H); g.endFill();
    g.lineStyle(0); g.beginFill(0x000000, 0.16); g.drawRect(x, y, 3, H); g.endFill();          // 左阴影
    g.lineStyle(0); g.beginFill(0x000000, 0.20); g.drawRect(x, y, w, 3); g.endFill();          // 屋檐投影

    const groundH = Math.min(A.groundMax, Math.round(H * A.groundFrac));
    const resH    = H - groundH;

    // 旧楼脏污竖纹
    if (A.dirty > 0) this._dirty(g, x, y, w, H, A.dirty);

    // 上层
    if (A.style === 'glass')      this._upperGlass(g, x, y, w, resH);
    else if (A.style === 'grille') this._upperGrille(g, x, y, w, resH);
    else                           this._upperWindows(g, x, y, w, resH);

    // 底层
    this._ground(g, x, y + resH, w, groundH);

    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 0.95); g.strokeRect(x, y, w, H);
  }

  // ── 上层：普通窗（resi/clinic/convenience/bookstore） ──
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
      g.lineStyle(0.6, 0x2c2c2c, 0.45); g.lineBetween(x + 2, fy, x + w - 2, fy);
      for (let c = 0; c < nCol; c++) {
        const wx = sx + c * (colW + gap), wy = fy + 2, wh = fh - 6;
        if (wh < 3) continue;
        const v = seededRand(x + wx * 1.3, f * 3 + c);
        // 窗：明暗不一（点亮/拉帘）
        const shade = v > 0.78 ? 0x9a9a9a : (v < 0.2 ? 0x2a2a2a : 0x383838);
        g.fillStyle(shade, 0.85); g.fillRect(wx, wy, colW, wh);
        g.lineStyle(0.4, 0xb8b8b8, 0.45); g.lineBetween(wx + colW / 2, wy, wx + colW / 2, wy + wh);
        g.lineStyle(0.5, 0x101010, 0.8); g.strokeRect(wx, wy, colW, wh);
        // 阳台
        if (A.balcony) {
          const ry = fy + fh - 3;
          g.lineStyle(0.6, 0x555555, 0.85); g.lineBetween(wx - 1, ry, wx + colW + 1, ry);
          for (let bx = wx; bx <= wx + colW; bx += 3) g.lineBetween(bx, ry, bx, ry + 2.5);
        }
        // 点缀
        const dec = seededRand(x + wx, f * 7 + c * 5);
        if (A.acFreq && dec < A.acFreq && wx + colW + 6 < x + w) this._ac(g, wx + colW + 1, wy + 1);
        else if (A.laundry && dec > 1 - A.laundry) this._laundry(g, wx, colW, wy);
        else if (A.balcony && dec > 0.6 && dec < 0.72) this._green(g, wx + colW / 2, fy + fh - 3);
      }
    }
  }

  // ── 上层：防盗网（老旧商住楼），窗尺寸略参差 + 拥挤 ──
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
      g.lineStyle(0.6, 0x202020, 0.5); g.lineBetween(x + 2, fy, x + w - 2, fy);
      for (let c = 0; c < nCol; c++) {
        const jitter = (seededRand(x + c * 9, f) - 0.5) * 2;
        const wx = sx + c * (colW + gap), wy = fy + 2 + jitter, wh = fh - 6;
        if (wh < 3) continue;
        g.fillStyle(0x303030, 0.85); g.fillRect(wx, wy, colW, wh);
        g.lineStyle(0.5, 0x101010, 0.85); g.strokeRect(wx, wy, colW, wh);
        // 防盗网（外凸笼格）
        g.lineStyle(0.4, 0xbcbcbc, 0.7);
        g.strokeRect(wx - 1, wy - 1, colW + 2, wh + 2);
        for (let gx = wx + 2; gx < wx + colW; gx += 3) g.lineBetween(gx, wy - 1, gx, wy + wh + 1);
        for (let gyv = wy + 2; gyv < wy + wh; gyv += 3) g.lineBetween(wx - 1, gyv, wx + colW + 1, gyv);
        // 空调/晾衣
        const dec = seededRand(x + wx, f * 4 + c);
        if (dec < A.acFreq && wx + colW + 6 < x + w) this._ac(g, wx + colW + 1, wy + 1);
        else if (dec > 1 - A.laundry) this._laundry(g, wx, colW, wy);
      }
    }
  }

  // ── 上层：玻璃幕（现代商业），干净反光横带 ──
  _upperGlass(g, x, y, w, resH) {
    if (resH < 8) return;
    const A = this.A;
    const n  = Math.max(2, Math.round(resH / A.floorH));
    const fh = resH / n;
    for (let f = 0; f < n; f++) {
      const fy = y + f * fh + 1.5;
      const bh = fh - 3;
      if (bh < 2) continue;
      g.fillStyle(0x444444, 0.5); g.fillRect(x + 4, fy, w - 8, bh);
      g.fillStyle(0xffffff, 0.18); g.fillRect(x + 4, fy, w - 8, bh * 0.45);    // 反光
      g.lineStyle(0.5, 0x101010, 0.75); g.strokeRect(x + 4, fy, w - 8, bh);
      const segs = Math.max(3, Math.floor((w - 8) / 12));
      g.lineStyle(0.4, 0x9a9a9a, 0.5);
      for (let i = 1; i < segs; i++) { const lx = x + 4 + (w - 8) * i / segs; g.lineBetween(lx, fy, lx, fy + bh); }
    }
  }

  // ── 脏污竖纹 ──
  _dirty(g, x, y, w, H, amount) {
    const k = Math.floor(amount * 5);
    for (let i = 0; i < k; i++) {
      const dx = x + 3 + seededRand(x, 100 + i) * (w - 8);
      const dw = 1 + seededRand(x, 110 + i) * 2.5;
      g.fillStyle(0x000000, 0.07 + seededRand(x, 120 + i) * 0.06);
      g.fillRect(dx, y + 2, dw, H * (0.4 + seededRand(x, 130 + i) * 0.5));
    }
  }

  // ─── 底层门面 ──────────────────────────────────────────────────────────────
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

  // 招牌大小参差：返回招牌高度
  _signH(min, max) { return Math.round(min + seededRand(this.x, 3) * (max - min)); }

  // resi：遮阳棚 + 招牌 + 玻璃 + 门
  _gShop(g, x, gy, w, gh) {
    const sh = this._signH(5, 8);
    g.fillStyle(0x8a8a8a, 1); g.fillRect(x + 3, gy + 1, w - 6, 3);                 // 棚
    g.lineStyle(0.5, 0x101010, 0.8); g.strokeRect(x + 3, gy + 1, w - 6, 3);
    g.fillStyle(0x2a2a2a, 1); g.fillRect(x + 4, gy + 4, w - 8, sh);               // 招牌
    this._icon(g, x + w / 2, gy + 4 + sh / 2, this._shopKind());
    this._shopGlass(g, x, gy + 4 + sh, w, gh - (4 + sh));
  }

  // oldmix：卷帘门 + 不规则招牌
  _gRoller(g, x, gy, w, gh) {
    const sh = this._signH(5, 9);
    const off = (seededRand(x, 4) - 0.5) * 4;                                      // 招牌左右偏
    g.fillStyle(0x1f1f1f, 1); g.fillRect(x + 4 + off, gy + 2, w - 12, sh);
    g.lineStyle(0.5, 0x000000, 0.9); g.strokeRect(x + 4 + off, gy + 2, w - 12, sh);
    this._icon(g, x + w / 2 + off, gy + 2 + sh / 2, this._shopKind());
    // 卷帘门（横向波纹）
    const rY = gy + 3 + sh, rH = gh - (3 + sh) - 1;
    if (rH > 2) {
      g.fillStyle(0x6e6e6e, 1); g.fillRect(x + 4, rY, w - 8, rH);
      g.lineStyle(0.4, 0x3a3a3a, 0.8);
      for (let ly = rY + 1.5; ly < rY + rH; ly += 2) g.lineBetween(x + 4, ly, x + w - 4, ly);
      g.lineStyle(0.5, 0x101010, 0.85); g.strokeRect(x + 4, rY, w - 8, rH);
    }
  }

  // modern：干净玻璃店面 + 细招牌
  _gGlassShop(g, x, gy, w, gh) {
    g.fillStyle(0x2f2f2f, 1); g.fillRect(x + 4, gy + 1, w - 8, 4);
    this._icon(g, x + w / 2, gy + 3, this._shopKind());
    const glY = gy + 6, glH = gh - 7;
    if (glH > 2) {
      g.fillStyle(0x3a3a3a, 0.5); g.fillRect(x + 4, glY, w - 8, glH);
      g.fillStyle(0xffffff, 0.2); g.fillRect(x + 5, glY + 1, w - 10, glH / 2);
      g.lineStyle(0.6, 0x101010, 0.8); g.strokeRect(x + 4, glY, w - 8, glH);
      const segs = Math.max(2, Math.floor((w - 8) / 16));
      g.lineStyle(0.4, 0x808080, 0.5);
      for (let i = 1; i < segs; i++) { const lx = x + 4 + (w - 8) * i / segs; g.lineBetween(lx, glY, lx, glY + glH); }
    }
  }

  // clinic：门口小雨棚 + 十字 + 双玻门 + 台阶
  _gClinic(g, x, gy, w, gh) {
    this._shopGlass(g, x, gy + 6, w, gh - 6, /*lite=*/true);
    // 十字招牌
    g.fillStyle(0x2a2a2a, 1); g.fillRect(x + 4, gy + 1, w - 8, 5);
    this._icon(g, x + w / 2, gy + 3.5, 'cross');
    // 门口雨棚
    const eW = Math.min(26, w * 0.4), eX = x + (w - eW) / 2;
    g.fillStyle(0x5a5a5a, 1); g.fillRect(eX - 2, gy + 6, eW + 4, 3);
    g.lineStyle(0.5, 0x101010, 0.85); g.strokeRect(eX - 2, gy + 6, eW + 4, 3);
    // 台阶
    g.lineStyle(0.6, 0x707070, 0.8); g.lineBetween(x + 6, gy + gh, x + w - 6, gy + gh);
  }

  // convenience：横向大招牌 + 玻璃门 + 门口货箱 + 自动售货机
  _gCvs(g, x, gy, w, gh) {
    g.fillStyle(0x232323, 1); g.fillRect(x + 2, gy + 1, w - 4, 7);                 // 大招牌
    g.lineStyle(0.5, 0x000000, 0.9); g.strokeRect(x + 2, gy + 1, w - 4, 7);
    this._icon(g, x + w / 2, gy + 4.5, 'dots');
    const glY = gy + 9, glH = gh - 10;
    if (glH > 2) {
      g.fillStyle(0x383838, 0.55); g.fillRect(x + 4, glY, w - 8, glH);
      g.fillStyle(0xffffff, 0.2); g.fillRect(x + 5, glY + 1, w - 10, glH / 2);
      g.lineStyle(0.6, 0x101010, 0.8); g.strokeRect(x + 4, glY, w - 8, glH);
      // 货箱（门口）
      g.fillStyle(0x9a9a9a, 1);
      g.fillRect(x + 5, glY + glH - 4, 6, 4); g.fillRect(x + 12, glY + glH - 3, 5, 3);
      g.lineStyle(0.4, 0x303030, 0.85);
      g.strokeRect(x + 5, glY + glH - 4, 6, 4); g.strokeRect(x + 12, glY + glH - 3, 5, 3);
      // 自动售货机（右）
      const vW = 8, vX = x + w - 6 - vW;
      g.fillStyle(0x4a4a4a, 1); g.fillRect(vX, glY + 1, vW, glH - 1);
      g.lineStyle(0.4, 0xcacaca, 0.6); g.strokeRect(vX + 1, glY + 2, vW - 4, glH - 4);
      g.lineStyle(0.5, 0x101010, 0.85); g.strokeRect(vX, glY + 1, vW, glH - 1);
    }
  }

  // bookstore：木质招牌(深) + 窄门 + 橱窗摆书
  _gBookshop(g, x, gy, w, gh) {
    g.fillStyle(0x4a4a4a, 1); g.fillRect(x + 3, gy + 1, w - 6, 6);                 // 木牌
    g.lineStyle(0.6, 0x202020, 0.9); g.strokeRect(x + 3, gy + 1, w - 6, 6);
    this._icon(g, x + w / 2, gy + 4, 'book');
    const glY = gy + 8, glH = gh - 9;
    if (glH > 2) {
      g.fillStyle(0x383838, 0.5); g.fillRect(x + 4, glY, w - 8, glH);
      g.lineStyle(0.6, 0x101010, 0.8); g.strokeRect(x + 4, glY, w - 8, glH);
      // 橱窗书脊（参差竖条）
      let bx = x + 6;
      while (bx < x + w - 10) {
        const bw = 1.5 + seededRand(x + bx, 1) * 2;
        const bhh = glH * (0.4 + seededRand(x + bx, 2) * 0.5);
        const sh = 0x6a6a6a + Math.floor(seededRand(x + bx, 3) * 0x40) * 0x010101;
        g.fillStyle(sh, 0.9); g.fillRect(bx, glY + glH - bhh, bw, bhh);
        bx += bw + 1.2;
      }
      // 窄门（右）
      g.fillStyle(0x1a1a1a, 0.9); g.fillRect(x + w - 5 - 7, glY + 1, 7, glH - 1);
    }
  }

  // 通用店面玻璃 + 门
  _shopGlass(g, x, gy, w, gh, lite = false) {
    if (gh <= 2) return;
    g.fillStyle(lite ? 0x4a4a4a : 0x383838, lite ? 0.45 : 0.55); g.fillRect(x + 4, gy, w - 8, gh);
    g.fillStyle(0xffffff, lite ? 0.22 : 0.18); g.fillRect(x + 5, gy + 1, w - 10, gh / 2);
    g.lineStyle(0.6, 0x101010, 0.8); g.strokeRect(x + 4, gy, w - 8, gh);
    const segs = Math.max(2, Math.floor((w - 8) / 18));
    g.lineStyle(0.4, 0x808080, 0.5);
    for (let i = 1; i < segs; i++) { const lx = x + 4 + (w - 8) * i / segs; g.lineBetween(lx, gy, lx, gy + gh); }
    const dW = 9;
    g.fillStyle(0x1a1a1a, 0.92); g.fillRect(x + w - 6 - dW, gy + 1, dW, gh - 1);
    g.lineStyle(0.5, 0x000000, 0.9); g.strokeRect(x + w - 6 - dW, gy + 1, dW, gh - 1);
  }

  // ─── 小部件 ───────────────────────────────────────────────────────────────
  _ac(g, ax, ay) {
    g.fillStyle(0x9a9a9a, 1); g.fillRect(ax, ay, 4, 3);
    g.lineStyle(0.4, 0x303030, 0.85); g.strokeRect(ax, ay, 4, 3);
    g.lineBetween(ax + 0.5, ay + 1.5, ax + 3.5, ay + 1.5);
  }
  _laundry(g, wx, colW, wy) {
    const ly = wy - 1;
    g.lineStyle(0.4, 0x707070, 0.8); g.lineBetween(wx, ly, wx + colW, ly);
    g.fillStyle(0xcacaca, 0.85); g.fillRect(wx + 2, ly, 2, 4); g.fillRect(wx + 6, ly, 2, 3);
  }
  _green(g, cx, ry) {
    g.fillStyle(0x666666, 1); g.fillRect(cx - 3, ry - 2, 6, 2);
    g.fillStyle(0x9c9c9c, 0.95); g.fillRect(cx - 2.5, ry - 4, 2, 2); g.fillRect(cx + 0.5, ry - 4, 2, 2);
  }

  _icon(g, cx, cy, type) {
    g.lineStyle(0.8, 0xe8e8e8, 0.95); g.fillStyle(0xe8e8e8, 0.95);
    switch (type) {
      case 'cart':
        g.lineBetween(cx - 4, cy - 2, cx + 3, cy - 2); g.lineBetween(cx - 2, cy - 2, cx - 1, cy + 1);
        g.lineBetween(cx - 1, cy + 1, cx + 3, cy + 1);
        g.fillRect(cx - 1, cy + 2, 1.2, 1.2); g.fillRect(cx + 2, cy + 2, 1.2, 1.2); break;
      case 'cup':
        g.lineBetween(cx - 3, cy - 2, cx + 2, cy - 2); g.lineBetween(cx - 3, cy - 2, cx - 2, cy + 2);
        g.lineBetween(cx + 2, cy - 2, cx + 1, cy + 2); g.lineBetween(cx - 2, cy + 2, cx + 1, cy + 2);
        g.lineBetween(cx + 2, cy - 1, cx + 4, cy); break;
      case 'dumbbell':
        g.lineBetween(cx - 3, cy, cx + 3, cy); g.fillRect(cx - 4, cy - 2, 1.5, 4); g.fillRect(cx + 2.5, cy - 2, 1.5, 4); break;
      case 'book':
        g.strokeRect(cx - 4, cy - 2.5, 8, 5); g.lineBetween(cx, cy - 2.5, cx, cy + 2.5); break;
      case 'burger':
        g.lineBetween(cx - 4, cy - 2, cx + 4, cy - 2); g.lineBetween(cx - 4, cy, cx + 4, cy); g.lineBetween(cx - 4, cy + 2, cx + 4, cy + 2); break;
      case 'cross':
        g.lineBetween(cx, cy - 3, cx, cy + 3); g.lineBetween(cx - 3, cy, cx + 3, cy); break;
      case 'fork':
        g.lineBetween(cx - 2, cy - 3, cx - 2, cy + 3); g.lineBetween(cx + 2, cy - 3, cx + 2, cy + 3); break;
      case 'dots':
      default:
        for (const dx of [-3, 0, 3]) g.fillRect(cx + dx - 0.7, cy - 0.7, 1.4, 1.4); break;
    }
  }

  // ─── 屋顶细节 ─────────────────────────────────────────────────────────────
  _roofDetails(g, roofTop, d) {
    const x = this.x, w = this.bWidth;
    const acCount = Math.floor(this.A.acFreq * 4);
    for (let i = 0; i < acCount; i++) {
      const ax = x + 8 + seededRand(x, 10 + i) * (w - 20);
      const ay = roofTop + 6 + seededRand(x, 20 + i) * (d - 16);
      const aw = 6 + Math.floor(seededRand(x, 30 + i) * 5), ah = 4 + Math.floor(seededRand(x, 40 + i) * 3);
      g.fillStyle(0x9a9a9a, 1); g.fillRect(ax, ay, aw, ah);
      g.lineStyle(0.6, 0x303030, 0.85); g.strokeRect(ax, ay, aw, ah);
    }
    if (seededRand(x, 50) > 0.5) {
      const ax = x + w * (0.5 + (seededRand(x, 51) - 0.5) * 0.5), ay = roofTop + d * 0.3;
      g.lineStyle(0.7, 0x202020, 0.95); g.lineBetween(ax, ay, ax, ay - 12);
      g.lineBetween(ax - 3, ay - 4, ax + 3, ay - 4); g.lineBetween(ax - 2, ay - 7, ax + 2, ay - 7);
    }
  }

  _solarPanels(g, roofTop, d) {
    const x = this.x, w = this.bWidth;
    const px = x + w * 0.5, py = roofTop + d * 0.4;
    for (let i = 0; i < 2; i++) {
      const sx = px - 14 + i * 15, sy = py - 3;
      g.fillStyle(0x404040, 0.95); g.fillRect(sx, sy, 13, 7);
      g.lineStyle(0.4, 0x9a9a9a, 0.7);
      for (let k = 1; k < 3; k++) g.lineBetween(sx + 13 * k / 3, sy, sx + 13 * k / 3, sy + 7);
      g.lineBetween(sx, sy + 3.5, sx + 13, sy + 3.5);
      g.lineStyle(0.5, 0x101010, 0.85); g.strokeRect(sx, sy, 13, 7);
    }
  }

  _billboard(g, roofTop) {
    const x = this.x, w = this.bWidth;
    const bw = Math.min(40, w * 0.5), bx = x + (w - bw) / 2, by = roofTop - 16;
    g.lineStyle(0.7, 0x303030, 0.9); g.lineBetween(bx + 4, roofTop, bx + 4, by + 10); g.lineBetween(bx + bw - 4, roofTop, bx + bw - 4, by + 10);
    g.fillStyle(0xcfcfcf, 1); g.fillRect(bx, by, bw, 10);
    g.lineStyle(0.6, 0x202020, 0.9); g.strokeRect(bx, by, bw, 10);
    g.lineStyle(0.5, 0x9a9a9a, 0.7); g.lineBetween(bx + 4, by + 4, bx + bw - 4, by + 4); g.lineBetween(bx + 4, by + 6.5, bx + bw - 10, by + 6.5);
  }

  _waterTower(g, roofTop, d) {
    const wx = this.x + this.bWidth * 0.32, wy = roofTop + d * 0.3, sz = 7;
    g.fillStyle(0xb8b8b8, 1); g.fillRect(wx - sz, wy - sz, sz * 2, sz * 2);
    g.lineStyle(0.7, 0x303030, 0.95); g.strokeRect(wx - sz, wy - sz, sz * 2, sz * 2);
    g.lineBetween(wx - sz, wy - sz, wx, wy - sz - 5); g.lineBetween(wx + sz, wy - sz, wx, wy - sz - 5);
    g.lineStyle(0.6, 0x303030, 0.85);
    g.lineBetween(wx - sz + 2, wy + sz, wx - sz + 2, wy + sz + 5); g.lineBetween(wx + sz - 2, wy + sz, wx + sz - 2, wy + sz + 5);
  }
}
