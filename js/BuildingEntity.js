/**
 * BuildingEntity
 * 俯视角建筑实体。按 tags 中的类型（bank/hotel/shop/restaurant/cafe/office/apartment）
 * 调整楼顶灰阶、立面高度、门面细节（柱子/落地窗/遮阳棚/招牌灯箱/阳台）等。
 *
 * 坐标约定：
 *   this.x = 建筑左边缘 X（非中心）
 *   this.y = 建筑临街底边 Y（默认 130）
 *   bWidth = 建筑宽度（X方向）
 *   bDepth = 建筑纵深（俯视高度，从 y-bDepth 到 y）
 */

import { Entity } from './Entity.js';
import {
  GRAY_BUILDING_HI, GRAY_BUILDING_MID, GRAY_BUILDING_LO,
  LINE_FAR_COLOR, LINE_FAR_WIDTH,
} from './SceneConfig.js';

// 类型 → { fill, facadeColor, facadeH }
//   fill         屋顶灰阶
//   facadeColor  立面墙体灰阶（比屋顶深一档）
//   facadeH      立面高度（决定建筑看起来"几层"）
const TYPE_STYLES = {
  bank:       { fill: GRAY_BUILDING_LO,  facadeColor: 0x707070, facadeH: 44 },
  hotel:      { fill: GRAY_BUILDING_MID, facadeColor: 0x848484, facadeH: 48 },
  office:     { fill: GRAY_BUILDING_MID, facadeColor: 0x7c7c7c, facadeH: 40 },
  apartment:  { fill: GRAY_BUILDING_HI,  facadeColor: 0x8c8c8c, facadeH: 36 },
  restaurant: { fill: GRAY_BUILDING_HI,  facadeColor: 0x989898, facadeH: 30 },
  cafe:       { fill: GRAY_BUILDING_HI,  facadeColor: 0xa0a0a0, facadeH: 30 },
  shop:       { fill: 0xd0d0d0,          facadeColor: 0x9a9a9a, facadeH: 28 },
  food:       { fill: GRAY_BUILDING_HI,  facadeColor: 0x989898, facadeH: 30 },
  retail:     { fill: 0xd0d0d0,          facadeColor: 0x9a9a9a, facadeH: 28 },
  residential:{ fill: GRAY_BUILDING_HI,  facadeColor: 0x8c8c8c, facadeH: 36 },
  finance:    { fill: GRAY_BUILDING_LO,  facadeColor: 0x707070, facadeH: 44 },
  default:    { fill: GRAY_BUILDING_MID, facadeColor: 0x808080, facadeH: 34 },
};

// 稳定的伪随机：用 x 作种子，避免每帧变化
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

    // 取第一个匹配的类型作为主类型
    const t = (this.tags ?? []).find(tag => tag in TYPE_STYLES) || 'default';
    this.btype = t;
    this.style = TYPE_STYLES[t];
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
    const { x, bWidth: w, bDepth: d, style } = this;
    const top = this.y - d;

    // ── 屋顶 ──
    g.fillStyle(style.fill, 1);
    g.fillRect(x, top, w, d);

    // 背街侧极淡高光
    g.fillStyle(0xffffff, 0.10);
    g.fillRect(x, top, w, Math.floor(d * 0.32));
    // 临街侧轻阴影
    g.fillStyle(0x000000, 0.10);
    g.fillRect(x, top + d * 0.68, w, d * 0.32);

    // 轮廓（薄浅）
    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 0.95);
    g.strokeRect(x, top, w, d);

    // 屋顶细节：空调外机 / 天线 / 上人口（按 x 哈希）
    this._drawRoofDetails(g, top, d);

    // 临街落地线
    g.lineStyle(1.2, 0x303030, 0.45);
    g.lineBetween(x, this.y, x + w, this.y);

    if (this.waterTower) this._drawWaterTower(g, top, d);

    // ── 立面（按类型分发） ──
    this._drawFacade(g, x, w);

    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }

  // ─── 屋顶细节（线条几何） ──────────────────────────────────────────────────
  _drawRoofDetails(g, roofTop, d) {
    const x = this.x, w = this.bWidth;
    // AC 外机：1–3 个
    const acCount = 1 + Math.floor(seededRand(x, 1) * 3);
    for (let i = 0; i < acCount; i++) {
      const ax = x + 8 + seededRand(x, 10 + i) * (w - 20);
      const ay = roofTop + 6 + seededRand(x, 20 + i) * (d - 16);
      const aw = 6 + Math.floor(seededRand(x, 30 + i) * 5);
      const ah = 4 + Math.floor(seededRand(x, 40 + i) * 3);
      g.fillStyle(0x9a9a9a, 1);
      g.fillRect(ax, ay, aw, ah);
      g.lineStyle(0.6, 0x303030, 0.85);
      g.strokeRect(ax, ay, aw, ah);
      // 风扇格栅
      g.lineStyle(0.4, 0x404040, 0.7);
      for (let k = 1; k < ah; k += 1.5) {
        g.lineBetween(ax + 1, ay + k, ax + aw - 1, ay + k);
      }
    }
    // 天线（部分建筑）
    if (seededRand(x, 50) > 0.55) {
      const ax = x + w * (0.5 + (seededRand(x, 51) - 0.5) * 0.5);
      const ay = roofTop + d * 0.3;
      g.lineStyle(0.7, 0x202020, 0.95);
      g.lineBetween(ax, ay, ax, ay - 12);
      // 横杆
      g.lineBetween(ax - 3, ay - 4, ax + 3, ay - 4);
      g.lineBetween(ax - 2, ay - 7, ax + 2, ay - 7);
      g.lineBetween(ax - 1.5, ay - 10, ax + 1.5, ay - 10);
    }
    // 上人口（小棚屋，约 1/3 概率）
    if (seededRand(x, 60) > 0.65) {
      const sx = x + w * (0.15 + seededRand(x, 61) * 0.5);
      const sy = roofTop + d * 0.45;
      const sw = 10;
      const sh = 7;
      g.fillStyle(0xa8a8a8, 1);
      g.fillRect(sx, sy, sw, sh);
      g.lineStyle(0.6, 0x404040, 0.9);
      g.strokeRect(sx, sy, sw, sh);
      // 屋顶斜线
      g.lineBetween(sx, sy, sx + sw / 2, sy - 2);
      g.lineBetween(sx + sw, sy, sx + sw / 2, sy - 2);
    }
  }

  // ─── 立面：按类型分发 ─────────────────────────────────────────────────────
  _drawFacade(g, x, w) {
    const { facadeColor, facadeH: H } = this.style;

    // 主墙体
    g.fillStyle(facadeColor, 1);
    g.fillRect(x, this.y, w, H);

    // 左侧窄阴影
    g.fillStyle(0x000000, 0.16);
    g.fillRect(x, this.y, 3, H);
    // 顶部屋檐投影
    g.fillStyle(0x000000, 0.22);
    g.fillRect(x, this.y, w, 3);
    // 落地线（薄）
    g.lineStyle(LINE_FAR_WIDTH, 0x303030, 0.85);
    g.lineBetween(x, this.y + H, x + w, this.y + H);

    // 按 type 调用具体绘制
    switch (this.btype) {
      case 'bank': case 'finance':
        this._facadeBank(g, x, w, H); break;
      case 'hotel':
        this._facadeHotel(g, x, w, H); break;
      case 'cafe':
        this._facadeCafe(g, x, w, H); break;
      case 'restaurant': case 'food':
        this._facadeRestaurant(g, x, w, H); break;
      case 'shop': case 'retail':
        this._facadeShop(g, x, w, H); break;
      case 'apartment': case 'residential':
        this._facadeApartment(g, x, w, H); break;
      case 'office':
      default:
        this._facadeOffice(g, x, w, H); break;
    }

    // 立面外框（薄浅）
    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 0.95);
    g.strokeRect(x, this.y, w, H);
  }

  // ── 银行：4 根柱子 + 中央大门 + 顶部装饰线 ──
  _facadeBank(g, x, w, H) {
    // 顶部装饰横线
    g.lineStyle(0.7, 0x202020, 0.85);
    g.lineBetween(x + 4, this.y + 6, x + w - 4, this.y + 6);
    g.lineBetween(x + 4, this.y + 8, x + w - 4, this.y + 8);

    // 4–6 根柱子
    const nCol = Math.max(4, Math.min(6, Math.floor(w / 22)));
    const colW = 4;
    const span = w - 12;
    g.fillStyle(0xdcdcdc, 0.95);
    for (let i = 0; i < nCol; i++) {
      const cx = x + 6 + (i + 0.5) * (span / nCol) - colW / 2;
      g.fillRect(cx, this.y + 10, colW, H - 14);
      g.lineStyle(0.5, 0x202020, 0.7);
      g.strokeRect(cx, this.y + 10, colW, H - 14);
      // 柱头
      g.fillStyle(0xc4c4c4, 1);
      g.fillRect(cx - 1, this.y + 9, colW + 2, 2);
      g.fillRect(cx - 1, this.y + H - 5, colW + 2, 2);
      g.fillStyle(0xdcdcdc, 0.95);
    }

    // 中央台阶 + 大门
    const dW = Math.min(22, Math.floor(w * 0.18));
    const dX = x + (w - dW) / 2;
    const dY = this.y + H - 14;
    g.fillStyle(0x1c1c1c, 0.9);
    g.fillRect(dX, dY, dW, 14);
    g.lineStyle(0.5, 0x000000, 0.9);
    g.lineBetween(dX + dW / 2, dY, dX + dW / 2, dY + 14);
    // 阶梯
    g.lineStyle(0.6, 0x202020, 0.7);
    g.lineBetween(dX - 3, dY + 14, dX + dW + 3, dY + 14);
  }

  // ── 酒店：竖向密窗（很多层小窗）+ 入口雨棚 ──
  _facadeHotel(g, x, w, H) {
    const winW = 4, winH = 4, gapX = 4, gapY = 3;
    const nCol = Math.max(3, Math.floor((w - 10) / (winW + gapX)));
    const nRow = Math.max(2, Math.floor((H - 16) / (winH + gapY)));
    const startX = x + Math.round((w - nCol * (winW + gapX) + gapX) / 2);
    for (let r = 0; r < nRow; r++) {
      for (let c = 0; c < nCol; c++) {
        const wx = startX + c * (winW + gapX);
        const wy = this.y + 4 + r * (winH + gapY);
        g.fillStyle(0x2a2a2a, 0.85);
        g.fillRect(wx, wy, winW, winH);
        g.lineStyle(0.4, 0x101010, 0.7);
        g.strokeRect(wx, wy, winW, winH);
      }
    }
    // 入口雨棚
    const eW = Math.min(28, w * 0.32);
    const eX = x + (w - eW) / 2;
    const eY = this.y + H - 11;
    g.fillStyle(0x202020, 0.9);
    g.fillRect(eX - 2, eY - 3, eW + 4, 3);
    // 大门
    g.fillStyle(0x1a1a1a, 0.9);
    g.fillRect(eX, eY, eW, 11);
    g.lineStyle(0.5, 0x000000, 0.85);
    g.lineBetween(eX + eW / 2, eY, eX + eW / 2, eY + 11);
    // 雨棚立杆
    g.lineStyle(0.6, 0x202020, 0.9);
    g.lineBetween(eX - 1, eY - 3, eX - 1, eY);
    g.lineBetween(eX + eW + 1, eY - 3, eX + eW + 1, eY);
  }

  // ── 咖啡馆：大落地窗 ──
  _facadeCafe(g, x, w, H) {
    // 落地玻璃幕
    const mX = x + 5, mY = this.y + 6;
    const mW = w - 10, mH = H - 12;
    g.fillStyle(0x404040, 0.55);
    g.fillRect(mX, mY, mW, mH);
    // 玻璃高光
    g.fillStyle(0xffffff, 0.18);
    g.fillRect(mX + 1, mY + 1, mW - 2, mH / 2);
    // 窗框分隔
    g.lineStyle(0.8, 0x1a1a1a, 0.85);
    g.strokeRect(mX, mY, mW, mH);
    const segs = Math.max(2, Math.floor(mW / 22));
    for (let i = 1; i < segs; i++) {
      const lx = mX + (mW * i / segs);
      g.lineBetween(lx, mY, lx, mY + mH);
    }
    // 横向腰线
    g.lineBetween(mX, mY + mH * 0.55, mX + mW, mY + mH * 0.55);
    // 小遮阳棚（细条）
    g.fillStyle(0x2a2a2a, 0.95);
    g.fillRect(mX, mY - 4, mW, 3);
    g.lineStyle(0.4, 0xffffff, 0.55);
    for (let i = 1; i < 6; i++) {
      const lx = mX + (mW * i / 6);
      g.lineBetween(lx, mY - 4, lx, mY - 1);
    }
  }

  // ── 餐厅：带条纹遮阳棚 + 招牌 + 双门 ──
  _facadeRestaurant(g, x, w, H) {
    // 招牌灯箱
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(x + 4, this.y + 3, w - 8, 5);
    g.lineStyle(0.5, 0x000000, 0.9);
    g.strokeRect(x + 4, this.y + 3, w - 8, 5);
    // 招牌字（横线 LOGO 抽象）
    g.lineStyle(0.6, 0xe8e8e8, 0.9);
    const tcx = x + w / 2;
    g.lineBetween(tcx - 10, this.y + 5.5, tcx + 10, this.y + 5.5);
    g.lineBetween(tcx - 6,  this.y + 7,   tcx + 6,  this.y + 7);

    // 条纹遮阳棚（梯形）
    const aY = this.y + 9;
    const aH = 6;
    g.fillStyle(0x707070, 1);
    g.beginPath();
    g.moveTo(x + 6, aY);
    g.lineTo(x + w - 6, aY);
    g.lineTo(x + w - 2, aY + aH);
    g.lineTo(x + 2, aY + aH);
    g.closePath();
    g.fillPath();
    g.lineStyle(0.6, 0x101010, 0.9);
    g.strokePath();
    // 条纹
    g.lineStyle(0.5, 0xdddddd, 0.7);
    const nStripe = Math.floor((w - 8) / 6);
    for (let i = 1; i < nStripe; i++) {
      const sx = x + 6 + i * 6;
      g.lineBetween(sx, aY, sx + 2, aY + aH);
    }

    // 玻璃 + 门
    const gY = aY + aH + 1;
    const gH = H - (gY - this.y) - 2;
    g.fillStyle(0x303030, 0.55);
    g.fillRect(x + 4, gY, w - 8, gH);
    g.lineStyle(0.6, 0x101010, 0.85);
    g.strokeRect(x + 4, gY, w - 8, gH);
    // 双开门
    const dW = Math.min(20, w * 0.22);
    const dX = x + (w - dW) / 2;
    g.fillStyle(0x1a1a1a, 0.92);
    g.fillRect(dX, gY + 1, dW, gH - 1);
    g.lineStyle(0.5, 0x000000, 0.9);
    g.lineBetween(dX + dW / 2, gY + 1, dX + dW / 2, gY + gH);
  }

  // ── 便利店：遮阳棚 + 大字招牌 + 落地玻璃 ──
  _facadeShop(g, x, w, H) {
    // 横向招牌
    g.fillStyle(0xeaeaea, 1);
    g.fillRect(x + 2, this.y + 2, w - 4, 7);
    g.lineStyle(0.7, 0x101010, 0.9);
    g.strokeRect(x + 2, this.y + 2, w - 4, 7);
    // LOGO 抽象（粗条）
    g.fillStyle(0x202020, 0.9);
    const txStart = x + w / 2 - 16;
    for (let k = 0; k < 4; k++) {
      g.fillRect(txStart + k * 8, this.y + 4, 5, 3);
    }

    // 半遮阳棚（短条）
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(x + 4, this.y + 10, w - 8, 3);
    g.lineStyle(0.4, 0xdddddd, 0.55);
    const nStripe = Math.max(4, Math.floor((w - 10) / 5));
    for (let i = 1; i < nStripe; i++) {
      const sx = x + 4 + i * ((w - 8) / nStripe);
      g.lineBetween(sx, this.y + 10, sx, this.y + 13);
    }

    // 大落地玻璃
    const gY = this.y + 14;
    const gH = H - 14 - 1;
    g.fillStyle(0x383838, 0.55);
    g.fillRect(x + 4, gY, w - 8, gH);
    g.fillStyle(0xffffff, 0.22);
    g.fillRect(x + 5, gY + 1, w - 10, gH / 2);
    g.lineStyle(0.6, 0x101010, 0.85);
    g.strokeRect(x + 4, gY, w - 8, gH);
    // 玻璃竖框
    const segs = Math.max(2, Math.floor((w - 8) / 18));
    for (let i = 1; i < segs; i++) {
      const lx = x + 4 + (w - 8) * i / segs;
      g.lineBetween(lx, gY, lx, gY + gH);
    }
    // 入口（右侧门）
    const dW = 9;
    g.fillStyle(0x1a1a1a, 0.92);
    g.fillRect(x + w - 6 - dW, gY + 1, dW, gH - 1);
    g.lineStyle(0.5, 0x000000, 0.9);
    g.strokeRect(x + w - 6 - dW, gY + 1, dW, gH - 1);
  }

  // ── 公寓：多排小窗 + 阳台横线 ──
  _facadeApartment(g, x, w, H) {
    const winW = 6, winH = 6, gapX = 6, gapY = 4;
    const nCol = Math.max(2, Math.floor((w - 10) / (winW + gapX)));
    const nRow = Math.max(2, Math.floor((H - 10) / (winH + gapY)));
    const startX = x + Math.round((w - nCol * (winW + gapX) + gapX) / 2);
    for (let r = 0; r < nRow; r++) {
      for (let c = 0; c < nCol; c++) {
        const wx = startX + c * (winW + gapX);
        const wy = this.y + 4 + r * (winH + gapY);
        // 窗
        g.fillStyle(0x383838, 0.85);
        g.fillRect(wx, wy, winW, winH);
        // 十字窗格
        g.lineStyle(0.4, 0xc8c8c8, 0.65);
        g.lineBetween(wx + winW / 2, wy, wx + winW / 2, wy + winH);
        g.lineBetween(wx, wy + winH / 2, wx + winW, wy + winH / 2);
        g.lineStyle(0.5, 0x101010, 0.85);
        g.strokeRect(wx, wy, winW, winH);
      }
      // 每层一条阳台横线
      const ly = this.y + 4 + r * (winH + gapY) + winH + 1;
      g.lineStyle(0.5, 0x404040, 0.7);
      g.lineBetween(x + 3, ly, x + w - 3, ly);
    }
  }

  // ── 办公楼：横向连续条形窗 ──
  _facadeOffice(g, x, w, H) {
    const rows = Math.max(2, Math.floor((H - 8) / 10));
    for (let r = 0; r < rows; r++) {
      const ry = this.y + 5 + r * 10;
      g.fillStyle(0x2c2c2c, 0.85);
      g.fillRect(x + 4, ry, w - 8, 6);
      g.lineStyle(0.5, 0x101010, 0.85);
      g.strokeRect(x + 4, ry, w - 8, 6);
      // 玻璃竖向分隔
      const segs = Math.max(3, Math.floor((w - 8) / 10));
      g.lineStyle(0.4, 0x808080, 0.55);
      for (let i = 1; i < segs; i++) {
        const lx = x + 4 + (w - 8) * i / segs;
        g.lineBetween(lx, ry, lx, ry + 6);
      }
      // 顶部高光
      g.fillStyle(0xffffff, 0.18);
      g.fillRect(x + 4, ry, w - 8, 1.5);
    }
    // 入口
    const dW = Math.min(14, w * 0.18);
    const dX = x + (w - dW) / 2;
    const dY = this.y + H - 9;
    g.fillStyle(0x1c1c1c, 0.92);
    g.fillRect(dX, dY, dW, 9);
    g.lineStyle(0.5, 0x000000, 0.9);
    g.lineBetween(dX + dW / 2, dY, dX + dW / 2, dY + 9);
  }

  _drawWaterTower(g, roofTop, d) {
    const wx = this.x + this.bWidth * 0.38;
    const wy = roofTop + d * 0.35;
    // 改为线条几何：方形塔体 + 锥顶（不再用实心球）
    const sz = 8;
    g.fillStyle(0xb8b8b8, 1);
    g.fillRect(wx - sz, wy - sz, sz * 2, sz * 2);
    g.lineStyle(0.7, 0x303030, 0.95);
    g.strokeRect(wx - sz, wy - sz, sz * 2, sz * 2);
    // 锥顶
    g.lineBetween(wx - sz, wy - sz, wx, wy - sz - 5);
    g.lineBetween(wx + sz, wy - sz, wx, wy - sz - 5);
    // 塔腿
    g.lineStyle(0.6, 0x303030, 0.85);
    g.lineBetween(wx - sz + 2, wy + sz, wx - sz + 2, wy + sz + 5);
    g.lineBetween(wx + sz - 2, wy + sz, wx + sz - 2, wy + sz + 5);
    // 中间立柱
    g.lineBetween(wx, wy + sz, wx, wy + sz + 5);
  }
}
