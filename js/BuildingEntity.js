/**
 * BuildingEntity
 * 俯视角"混合用途"沿街楼：底层店铺 + 上层居民楼（4–5 层观感）。
 *   - 底层 shopfront：按店铺类型画遮阳棚 / 招牌 / 抽象图标 / 落地玻璃 / 门
 *   - 上层 residential：成排小窗 + 阳台栏杆，零星点缀绿植 / 晾衣绳 / 空调外机
 * 纯黑白灰：所有颜色为灰阶。
 *
 * 坐标约定：
 *   this.x      = 建筑左边缘 X
 *   this.y      = 立面顶边 Y（屋顶在其上方，立面在其下方）
 *   this.facadeH= 立面高度（决定"几层"，可由 scene.json 覆盖以形成天际线起伏）
 *   bWidth      = 建筑宽度；bDepth = 屋顶俯视纵深（y-bDepth .. y）
 */

import { Entity } from './Entity.js';
import {
  GRAY_BUILDING_HI, GRAY_BUILDING_MID, GRAY_BUILDING_LO,
  LINE_FAR_COLOR, LINE_FAR_WIDTH,
} from './SceneConfig.js';

// 类型 → 屋顶灰阶 / 立面墙灰阶 / 默认立面高度
const TYPE_STYLES = {
  bank:        { fill: GRAY_BUILDING_LO,  facadeColor: 0x6e6e6e, facadeH: 86 },
  supermarket: { fill: GRAY_BUILDING_MID, facadeColor: 0x7c7c7c, facadeH: 80 },
  cafe:        { fill: GRAY_BUILDING_HI,  facadeColor: 0x8a8a8a, facadeH: 70 },
  convenience: { fill: GRAY_BUILDING_HI,  facadeColor: 0x868686, facadeH: 72 },
  gym:         { fill: GRAY_BUILDING_MID, facadeColor: 0x747474, facadeH: 82 },
  bookstore:   { fill: GRAY_BUILDING_HI,  facadeColor: 0x848484, facadeH: 76 },
  fruit:       { fill: GRAY_BUILDING_HI,  facadeColor: 0x8c8c8c, facadeH: 68 },
  burger:      { fill: GRAY_BUILDING_HI,  facadeColor: 0x888888, facadeH: 72 },
  clinic:      { fill: GRAY_BUILDING_HI,  facadeColor: 0x909090, facadeH: 78 },
  restaurant:  { fill: GRAY_BUILDING_HI,  facadeColor: 0x8a8a8a, facadeH: 74 },
  default:     { fill: GRAY_BUILDING_MID, facadeColor: 0x808080, facadeH: 76 },
};

// 店铺门面：遮阳棚灰阶 + 招牌抽象图标
const SHOP = {
  bank:        { awn: 0x707070, icon: 'bank' },
  supermarket: { awn: 0x888888, icon: 'cart' },
  cafe:        { awn: 0x9a9a9a, icon: 'cup' },
  convenience: { awn: 0x808080, icon: 'dots' },
  gym:         { awn: 0x6e6e6e, icon: 'dumbbell' },
  bookstore:   { awn: 0x949494, icon: 'book' },
  fruit:       { awn: 0xa0a0a0, icon: 'apple' },
  burger:      { awn: 0x8c8c8c, icon: 'burger' },
  clinic:      { awn: 0xb0b0b0, icon: 'cross' },
  restaurant:  { awn: 0x989898, icon: 'fork' },
  default:     { awn: 0x868686, icon: 'dots' },
};

// 稳定伪随机：用坐标作种子，避免每帧变化
function seededRand(x, salt = 0) {
  const s = Math.sin(x * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export class BuildingEntity extends Entity {
  constructor(config) {
    super({
      ...config,
      width:  config.bWidth ?? 100,
      height: config.bDepth ?? 70,
      static: true,
    });
    this.bWidth     = config.bWidth     ?? 100;
    this.bDepth     = config.bDepth     ?? 70;
    this.waterTower = config.waterTower ?? false;

    const t = (this.tags ?? []).find(tag => tag in TYPE_STYLES) || 'default';
    this.btype = t;
    this.style = TYPE_STYLES[t];
    this.facadeH = config.facadeH ?? this.style.facadeH;
  }

  getBounds() {
    return {
      x:      this.x,
      y:      this.y - this.bDepth,
      width:  this.bWidth,
      height: this.bDepth,
    };
  }

  draw(g) {
    if (!this.visible) return;
    const { x, bWidth: w, bDepth: d } = this;
    const base = this.y + this.facadeH;     // 临街地面线
    const top  = this.y - d;                // 屋顶后边缘

    // ── 屋顶 ──
    g.fillStyle(this.style.fill, 1);
    g.fillRect(x, top, w, d);
    g.fillStyle(0xffffff, 0.10);
    g.fillRect(x, top, w, Math.floor(d * 0.32));
    g.fillStyle(0x000000, 0.10);
    g.fillRect(x, top + d * 0.68, w, d * 0.32);
    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 0.95);
    g.strokeRect(x, top, w, d);
    this._drawRoofDetails(g, top, d);
    if (this.waterTower) this._drawWaterTower(g, top, d);

    // 临街地面落地线
    g.lineStyle(1.2, 0x303030, 0.45);
    g.lineBetween(x, base, x + w, base);

    // ── 立面 ──
    this._drawFacade(g, x, w);

    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }

  // ─── 立面：上层居民楼 + 底层店铺 ───────────────────────────────────────────
  _drawFacade(g, x, w) {
    const H = this.facadeH;
    const y = this.y;
    const { facadeColor } = this.style;

    // 主墙体
    g.fillStyle(facadeColor, 1);
    g.fillRect(x, y, w, H);
    // 左侧窄阴影 + 顶部屋檐投影
    g.fillStyle(0x000000, 0.16); g.fillRect(x, y, 3, H);
    g.fillStyle(0x000000, 0.22); g.fillRect(x, y, w, 3);

    const groundH = Math.min(26, Math.round(H * 0.30));
    const resH    = H - groundH;

    this._facadeResidential(g, x, y, w, resH);
    this._shopfront(g, x, y + resH, w, groundH);

    // 立面外框
    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 0.95);
    g.strokeRect(x, y, w, H);
  }

  // ─── 上层居民楼：成排小窗 + 阳台栏杆 + 点缀 ────────────────────────────────
  _facadeResidential(g, x, y, w, resH) {
    if (resH < 8) return;
    const floorH = 13;
    const n  = Math.max(1, Math.round(resH / floorH));
    const fh = resH / n;
    const colW = 10, gap = 7;
    const nCol = Math.max(1, Math.floor((w - 6) / (colW + gap)));
    const totalW = nCol * (colW + gap) - gap;
    const sx = x + (w - totalW) / 2;

    for (let f = 0; f < n; f++) {
      const fy = y + f * fh;
      // 楼板线
      g.lineStyle(0.6, 0x2c2c2c, 0.5);
      g.lineBetween(x + 2, fy, x + w - 2, fy);

      for (let c = 0; c < nCol; c++) {
        const wx = sx + c * (colW + gap);
        const wy = fy + 2;
        const wh = fh - 6;
        if (wh < 3) continue;
        // 窗
        g.fillStyle(0x383838, 0.85);
        g.fillRect(wx, wy, colW, wh);
        g.lineStyle(0.4, 0xb8b8b8, 0.45);
        g.lineBetween(wx + colW / 2, wy, wx + colW / 2, wy + wh);
        g.lineStyle(0.5, 0x101010, 0.8);
        g.strokeRect(wx, wy, colW, wh);
        // 阳台栏杆（窗下沿）
        const ry = fy + fh - 3;
        g.lineStyle(0.6, 0x555555, 0.85);
        g.lineBetween(wx - 1, ry, wx + colW + 1, ry);
        for (let bx = wx; bx <= wx + colW; bx += 3) g.lineBetween(bx, ry, bx, ry + 2.5);
        // 点缀（稳定哈希）
        const dec = seededRand(x + wx, f * 3 + c);
        if      (dec > 0.82 && wx + colW + 6 < x + w) this._balconyAC(g, wx + colW + 1, wy + 1);
        else if (dec > 0.64) this._balconyGreen(g, wx + colW / 2, ry);
        else if (dec > 0.48) this._balconyClothes(g, wx, colW, wy);
      }
    }
  }

  _balconyGreen(g, cx, ry) {
    g.fillStyle(0x666666, 1);  g.fillRect(cx - 3, ry - 2, 6, 2);       // 花箱
    g.fillStyle(0x9c9c9c, 0.95); g.fillRect(cx - 2.5, ry - 4, 2, 2); g.fillRect(cx + 0.5, ry - 4, 2, 2);
  }

  _balconyClothes(g, wx, colW, wy) {
    const ly = wy - 1;
    g.lineStyle(0.4, 0x707070, 0.8);
    g.lineBetween(wx, ly, wx + colW, ly);
    g.fillStyle(0xcacaca, 0.85);
    g.fillRect(wx + 2, ly, 2, 4); g.fillRect(wx + 6, ly, 2, 3);
  }

  _balconyAC(g, ax, ay) {
    g.fillStyle(0x9a9a9a, 1); g.fillRect(ax, ay, 4, 3);
    g.lineStyle(0.4, 0x303030, 0.85); g.strokeRect(ax, ay, 4, 3);
    g.lineBetween(ax + 0.5, ay + 1.5, ax + 3.5, ay + 1.5);
  }

  // ─── 底层店铺门面 ─────────────────────────────────────────────────────────
  _shopfront(g, x, gy, w, gh) {
    const s = SHOP[this.btype] || SHOP.default;
    // 遮阳棚
    g.fillStyle(s.awn, 1); g.fillRect(x + 3, gy + 1, w - 6, 4);
    g.lineStyle(0.5, 0x101010, 0.8); g.strokeRect(x + 3, gy + 1, w - 6, 4);
    // 招牌灯箱 + 抽象图标
    g.fillStyle(0x2a2a2a, 1); g.fillRect(x + 3, gy + 5, w - 6, 6);
    this._shopIcon(g, x + w / 2, gy + 8, s.icon);
    // 落地玻璃
    const glY = gy + 12, glH = gh - 13;
    if (glH > 2) {
      g.fillStyle(0x383838, 0.55); g.fillRect(x + 4, glY, w - 8, glH);
      g.fillStyle(0xffffff, 0.18); g.fillRect(x + 5, glY + 1, w - 10, glH / 2);
      g.lineStyle(0.6, 0x101010, 0.85); g.strokeRect(x + 4, glY, w - 8, glH);
      const segs = Math.max(2, Math.floor((w - 8) / 18));
      g.lineStyle(0.4, 0x808080, 0.5);
      for (let i = 1; i < segs; i++) {
        const lx = x + 4 + (w - 8) * i / segs;
        g.lineBetween(lx, glY, lx, glY + glH);
      }
      // 右侧门
      const dW = 9;
      g.fillStyle(0x1a1a1a, 0.92); g.fillRect(x + w - 6 - dW, glY + 1, dW, glH - 1);
      g.lineStyle(0.5, 0x000000, 0.9); g.strokeRect(x + w - 6 - dW, glY + 1, dW, glH - 1);
    }
  }

  // 招牌抽象图标（灰白线条，~6px）
  _shopIcon(g, cx, cy, type) {
    g.lineStyle(0.8, 0xe8e8e8, 0.95);
    g.fillStyle(0xe8e8e8, 0.95);
    switch (type) {
      case 'bank':                                  // 三根柱子
        g.lineBetween(cx - 4, cy - 2, cx + 4, cy - 2);
        for (const dx of [-3, 0, 3]) g.lineBetween(cx + dx, cy - 2, cx + dx, cy + 2);
        break;
      case 'cart':                                  // 购物车
        g.lineBetween(cx - 4, cy - 2, cx - 2, cy - 2);
        g.lineBetween(cx - 2, cy - 2, cx + 3, cy - 2);
        g.lineBetween(cx - 2, cy - 2, cx - 1, cy + 1);
        g.lineBetween(cx - 1, cy + 1, cx + 3, cy + 1);
        g.fillRect(cx - 1, cy + 2, 1.2, 1.2); g.fillRect(cx + 2, cy + 2, 1.2, 1.2);
        break;
      case 'cup':                                   // 咖啡杯
        g.lineBetween(cx - 3, cy - 2, cx + 2, cy - 2);
        g.lineBetween(cx - 3, cy - 2, cx - 2, cy + 2);
        g.lineBetween(cx + 2, cy - 2, cx + 1, cy + 2);
        g.lineBetween(cx - 2, cy + 2, cx + 1, cy + 2);
        g.lineBetween(cx + 2, cy - 1, cx + 4, cy);     // 把手
        break;
      case 'dumbbell':                              // 哑铃
        g.lineBetween(cx - 3, cy, cx + 3, cy);
        g.fillRect(cx - 4, cy - 2, 1.5, 4); g.fillRect(cx + 2.5, cy - 2, 1.5, 4);
        break;
      case 'book':                                  // 书
        g.strokeRect(cx - 4, cy - 2.5, 8, 5);
        g.lineBetween(cx, cy - 2.5, cx, cy + 2.5);
        break;
      case 'apple':                                 // 水果
        g.strokeRect(cx - 2, cy - 1, 4, 3.5);
        g.lineBetween(cx, cy - 1, cx + 1, cy - 3);     // 梗
        break;
      case 'burger':                                // 汉堡（三层）
        g.lineBetween(cx - 4, cy - 2, cx + 4, cy - 2);
        g.lineBetween(cx - 4, cy,     cx + 4, cy);
        g.lineBetween(cx - 4, cy + 2, cx + 4, cy + 2);
        break;
      case 'cross':                                 // 诊所十字
        g.lineBetween(cx, cy - 3, cx, cy + 3);
        g.lineBetween(cx - 3, cy, cx + 3, cy);
        break;
      case 'fork':                                  // 餐厅刀叉
        g.lineBetween(cx - 2, cy - 3, cx - 2, cy + 3);
        g.lineBetween(cx + 2, cy - 3, cx + 2, cy + 3);
        break;
      case 'dots':
      default:
        for (const dx of [-3, 0, 3]) g.fillRect(cx + dx - 0.7, cy - 0.7, 1.4, 1.4);
        break;
    }
  }

  // ─── 屋顶细节 ─────────────────────────────────────────────────────────────
  _drawRoofDetails(g, roofTop, d) {
    const x = this.x, w = this.bWidth;
    const acCount = 1 + Math.floor(seededRand(x, 1) * 3);
    for (let i = 0; i < acCount; i++) {
      const ax = x + 8 + seededRand(x, 10 + i) * (w - 20);
      const ay = roofTop + 6 + seededRand(x, 20 + i) * (d - 16);
      const aw = 6 + Math.floor(seededRand(x, 30 + i) * 5);
      const ah = 4 + Math.floor(seededRand(x, 40 + i) * 3);
      g.fillStyle(0x9a9a9a, 1); g.fillRect(ax, ay, aw, ah);
      g.lineStyle(0.6, 0x303030, 0.85); g.strokeRect(ax, ay, aw, ah);
      g.lineStyle(0.4, 0x404040, 0.7);
      for (let k = 1; k < ah; k += 1.5) g.lineBetween(ax + 1, ay + k, ax + aw - 1, ay + k);
    }
    if (seededRand(x, 50) > 0.55) {
      const ax = x + w * (0.5 + (seededRand(x, 51) - 0.5) * 0.5);
      const ay = roofTop + d * 0.3;
      g.lineStyle(0.7, 0x202020, 0.95);
      g.lineBetween(ax, ay, ax, ay - 12);
      g.lineBetween(ax - 3, ay - 4, ax + 3, ay - 4);
      g.lineBetween(ax - 2, ay - 7, ax + 2, ay - 7);
      g.lineBetween(ax - 1.5, ay - 10, ax + 1.5, ay - 10);
    }
    if (seededRand(x, 60) > 0.65) {
      const sx = x + w * (0.15 + seededRand(x, 61) * 0.5);
      const sy = roofTop + d * 0.45;
      g.fillStyle(0xa8a8a8, 1); g.fillRect(sx, sy, 10, 7);
      g.lineStyle(0.6, 0x404040, 0.9); g.strokeRect(sx, sy, 10, 7);
      g.lineBetween(sx, sy, sx + 5, sy - 2);
      g.lineBetween(sx + 10, sy, sx + 5, sy - 2);
    }
  }

  _drawWaterTower(g, roofTop, d) {
    const wx = this.x + this.bWidth * 0.38;
    const wy = roofTop + d * 0.35;
    const sz = 8;
    g.fillStyle(0xb8b8b8, 1); g.fillRect(wx - sz, wy - sz, sz * 2, sz * 2);
    g.lineStyle(0.7, 0x303030, 0.95); g.strokeRect(wx - sz, wy - sz, sz * 2, sz * 2);
    g.lineBetween(wx - sz, wy - sz, wx, wy - sz - 5);
    g.lineBetween(wx + sz, wy - sz, wx, wy - sz - 5);
    g.lineStyle(0.6, 0x303030, 0.85);
    g.lineBetween(wx - sz + 2, wy + sz, wx - sz + 2, wy + sz + 5);
    g.lineBetween(wx + sz - 2, wy + sz, wx + sz - 2, wy + sz + 5);
    g.lineBetween(wx, wy + sz, wx, wy + sz + 5);
  }
}
