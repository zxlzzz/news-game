/**
 * PropEntity
 * 静态场景道具。所有图形采用统一"细线条 + 简几何"画法，
 * 不使用实心圆球；远端线细色浅，近端线粗色深。
 *
 * propType 枚举：
 *   'lamp-far'    远端路灯
 *   'lamp-near'   近端路灯
 *   'bench'       长椅
 *   'trash'       垃圾桶
 *   'sign'        建筑招牌（贴在建筑顶上）
 *   'newsrack'    报刊架（主题契合）
 *   'hydrant'     消防栓
 *   'mailbox'     邮筒
 *   'planter'     花坛
 *   'manhole'     井盖（在路面）
 *   'drain'       排水沟盖（路边）
 */

import { Entity } from './Entity.js';
import { depthGray, depthLineWidth, depthLineColor } from './SceneConfig.js';

function toGrayBand(color, lightVal, darkVal) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b =  color        & 0xff;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const v   = Math.round(lightVal + (lum / 255) * (darkVal - lightVal));
  return (v << 16) | (v << 8) | v;
}

export class PropEntity extends Entity {
  constructor(config) {
    super({ ...config, static: true });
    this.propType  = config.propType  || 'generic';
    this.propColor = config.propColor ?? 0x888888;
    this.dir       = config.dir       ?? 1; // 部分道具（椅子）需要朝向
    // 锚点驱动的视觉高度（椅面/桌面距地），由交互场景按 NPC 锚点反推后传入
    this.seatH     = config.seatH     ?? null; // 椅子：椅面距地
    this.topH      = config.topH      ?? null; // 棋桌：桌面距地
  }

  draw(g) {
    if (!this.visible) return;
    switch (this.propType) {
      case 'lamp-far':    this._drawLampFar(g);    break;
      case 'lamp-near':   this._drawLampNear(g);   break;
      case 'bench':       this._drawBench(g);      break;
      case 'trash':       this._drawTrash(g);      break;
      case 'sign':        this._drawSign(g);       break;
      case 'newsrack':    this._drawNewsRack(g);   break;
      case 'hydrant':     this._drawHydrant(g);    break;
      case 'mailbox':     this._drawMailbox(g);    break;
      case 'planter':     this._drawPlanter(g);    break;
      case 'manhole':     this._drawManhole(g);    break;
      case 'drain':       this._drawDrain(g);      break;
      case 'chair':       this._drawChair(g);      break;
      case 'chess-table': this._drawChessTable(g); break;
      case 'tree':        this._drawTree(g);       break;
      case 'fountain':    this._drawFountain(g);   break;
      case 'stall':       this._drawStall(g);      break;
      case 'vending':     this._drawVending(g);    break;
      case 'phonebooth':  this._drawPhoneBooth(g); break;
    }
    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }

  // ─── 路灯：远端（细线，灯臂朝路，加高） ───────────────────────────────────
  _drawLampFar(g) {
    const { x, y } = this;
    // 灯柱（加高约 1.7×）
    g.lineStyle(1.1, 0x6a6a6a, 0.95);
    g.lineBetween(x, y + 16, x, y - 28);
    // 灯臂
    g.lineStyle(0.9, 0x6a6a6a, 0.9);
    g.lineBetween(x, y - 28, x + 18, y - 12);
    // 灯罩（描边方块，非实心）
    g.fillStyle(0xf0f0f0, 1);
    g.fillRect(x + 15, y - 14, 7, 7);
    g.lineStyle(0.8, 0x202020, 1);
    g.strokeRect(x + 15, y - 14, 7, 7);
    // 灯柱底座
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(x - 1.5, y + 14, 4, 4);
  }

  // ─── 路灯：近端（粗线，灯臂朝路，加高） ───────────────────────────────────
  _drawLampNear(g) {
    const { x, y } = this;
    g.lineStyle(2.8, 0x1f1f1f, 1);
    g.lineBetween(x, y - 36, x, y + 12);
    g.lineStyle(2.2, 0x1f1f1f, 1);
    g.lineBetween(x, y - 36, x - 24, y - 24);
    // 灯罩（线条几何，非实心圆）
    g.fillStyle(0xfafafa, 1);
    g.fillRect(x - 29, y - 28, 10, 10);
    g.lineStyle(1.8, 0x101010, 1);
    g.strokeRect(x - 29, y - 28, 10, 10);
    // 罩内灯光横线（暗示亮）
    g.lineStyle(0.8, 0xa0a0a0, 0.85);
    g.lineBetween(x - 27, y - 23, x - 21, y - 23);
    // 底座
    g.fillStyle(0x101010, 1);
    g.fillRect(x - 3, y + 10, 6, 5);
  }

  // ─── 长椅：线条 ──────────────────────────────────────────────────────────
  _drawBench(g) {
    const bw = this.width;
    const bh = 10;
    const bx = this.x - bw / 2;
    const by = this.y - bh;
    const lineW = depthLineWidth(this.y, { wMin: 1, wMax: 1.6 });
    const lineC = depthLineColor(this.y, { light: 0x40, dark: 0x10 });
    // 椅面（描边为主）
    g.fillStyle(0xdadada, 0.85);
    g.fillRect(bx, by, bw, bh);
    g.lineStyle(lineW, lineC, 0.95);
    g.strokeRect(bx, by, bw, bh);
    // 木条分隔
    g.lineStyle(0.5, lineC, 0.75);
    for (let i = 1; i < 4; i++) {
      const lx = bx + (bw * i / 4);
      g.lineBetween(lx, by, lx, by + bh);
    }
    // 椅背（薄长方形）
    g.fillStyle(0xc0c0c0, 0.9);
    g.fillRect(bx, by - 3, bw, 3);
    g.lineStyle(lineW * 0.8, lineC, 0.9);
    g.strokeRect(bx, by - 3, bw, 3);
    // 椅腿（短竖线）
    g.lineStyle(lineW, lineC, 0.9);
    g.lineBetween(bx + 3,      by + bh, bx + 3,      by + bh + 4);
    g.lineBetween(bx + bw - 3, by + bh, bx + bw - 3, by + bh + 4);
  }

  // ─── 垃圾桶：线条 ──────────────────────────────────────────────────────
  _drawTrash(g) {
    const { x, y } = this;
    const lineW = depthLineWidth(y, { wMin: 0.8, wMax: 1.6 });
    const lineC = depthLineColor(y, { light: 0x40, dark: 0x10 });
    // 桶身（梯形线条）
    const topW = 12, botW = 9, h = 13;
    const tx = x - topW / 2;
    const bx = x - botW / 2;
    g.fillStyle(0xc0c0c0, 0.92);
    g.beginPath();
    g.moveTo(tx,         y - h);
    g.lineTo(tx + topW,  y - h);
    g.lineTo(bx + botW,  y);
    g.lineTo(bx,         y);
    g.closePath();
    g.fillPath();
    g.lineStyle(lineW, lineC, 0.95);
    g.strokePath();
    // 桶口横盖（细线）
    g.lineStyle(lineW * 1.1, lineC, 0.95);
    g.lineBetween(tx - 1, y - h - 1, tx + topW + 1, y - h - 1);
    // 桶身竖线（金属条）
    g.lineStyle(0.5, lineC, 0.6);
    g.lineBetween(x - 2, y - h + 2, x - 2 + (botW - topW) * 0.3, y - 1);
    g.lineBetween(x + 2, y - h + 2, x + 2 - (botW - topW) * 0.3, y - 1);
  }

  // ─── 招牌（贴建筑顶上的横条） ──────────────────────────────────────────────
  _drawSign(g) {
    const sw = this.width;
    const sh = 14;
    const sx = this.x - sw / 2;
    const sy = this.y - sh;
    const fill = toGrayBand(this.propColor, 0xa8, 0x60);
    g.fillStyle(fill, 0.95);
    g.fillRect(sx, sy, sw, sh);
    // LOGO 抽象（两到三横线）
    g.lineStyle(0.6, 0xfafafa, 0.8);
    g.lineBetween(sx + 3, sy + sh * 0.35, sx + sw - 3, sy + sh * 0.35);
    g.lineBetween(sx + 5, sy + sh * 0.65, sx + sw - 5, sy + sh * 0.65);
    g.lineStyle(0.8, 0x000000, 0.7);
    g.strokeRect(sx, sy, sw, sh);
    // 招牌悬挂支架
    g.lineStyle(0.5, 0x303030, 0.7);
    g.lineBetween(sx + 4,      sy, sx + 4,      sy - 3);
    g.lineBetween(sx + sw - 4, sy, sx + sw - 4, sy - 3);
  }

  // ─── 报刊架（主题契合） ──────────────────────────────────────────────────
  _drawNewsRack(g) {
    const { x, y } = this;
    const w = 12, h = 17;
    const px = x - w / 2;
    const py = y - h;
    const lineW = depthLineWidth(y, { wMin: 0.8, wMax: 1.5 });
    const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });
    // 主体
    g.fillStyle(0xb8b8b8, 0.95);
    g.fillRect(px, py + 4, w, h - 4);
    g.lineStyle(lineW, lineC, 0.95);
    g.strokeRect(px, py + 4, w, h - 4);
    // 上部展示窗（玻璃）
    g.fillStyle(0xeaeaea, 0.95);
    g.fillRect(px + 1, py + 5, w - 2, 6);
    g.lineStyle(0.5, lineC, 0.8);
    g.strokeRect(px + 1, py + 5, w - 2, 6);
    // 报纸标题线
    g.lineStyle(0.5, lineC, 0.85);
    g.lineBetween(px + 2, py + 7,  px + w - 2, py + 7);
    g.lineBetween(px + 2, py + 8.5, px + w - 2, py + 8.5);
    g.lineBetween(px + 2, py + 10, px + w - 4, py + 10);
    // 投币口
    g.fillStyle(0x101010, 0.9);
    g.fillRect(px + w / 2 - 2, py + h - 4, 4, 1);
    // 顶盖（向前突出）
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(px - 1, py + 2, w + 2, 2);
    g.lineStyle(lineW * 0.9, lineC, 0.95);
    g.strokeRect(px - 1, py + 2, w + 2, 2);
    // 立柱腿
    g.lineStyle(lineW, lineC, 0.9);
    g.lineBetween(px + 2,     py + h, px + 2,     py + h + 3);
    g.lineBetween(px + w - 2, py + h, px + w - 2, py + h + 3);
  }

  // ─── 消防栓 ──────────────────────────────────────────────────────────────
  _drawHydrant(g) {
    const { x, y } = this;
    const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
    const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });
    // 基座
    g.fillStyle(0x6a6a6a, 1);
    g.fillRect(x - 4, y - 2, 8, 2);
    g.lineStyle(lineW, lineC, 0.95);
    g.strokeRect(x - 4, y - 2, 8, 2);
    // 主体
    g.fillStyle(0xb0b0b0, 1);
    g.fillRect(x - 3, y - 9, 6, 7);
    g.lineStyle(lineW, lineC, 0.95);
    g.strokeRect(x - 3, y - 9, 6, 7);
    // 顶帽（梯形）
    g.fillStyle(0xa0a0a0, 1);
    g.beginPath();
    g.moveTo(x - 2, y - 12);
    g.lineTo(x + 2, y - 12);
    g.lineTo(x + 3, y - 9);
    g.lineTo(x - 3, y - 9);
    g.closePath();
    g.fillPath();
    g.lineStyle(lineW, lineC, 0.95);
    g.strokePath();
    // 顶端螺帽（小方块）
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(x - 1, y - 13, 2, 1.5);
    // 侧帽（小方块）
    g.fillStyle(0x707070, 1);
    g.fillRect(x - 6, y - 7, 3, 2);
    g.fillRect(x + 3, y - 7, 3, 2);
    g.lineStyle(0.5, lineC, 0.85);
    g.strokeRect(x - 6, y - 7, 3, 2);
    g.strokeRect(x + 3, y - 7, 3, 2);
  }

  // ─── 邮筒 ────────────────────────────────────────────────────────────────
  _drawMailbox(g) {
    const { x, y } = this;
    const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
    const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });
    // 立柱
    g.lineStyle(lineW * 1.1, lineC, 0.95);
    g.lineBetween(x, y, x, y - 8);
    // 箱体
    g.fillStyle(0x8a8a8a, 1);
    g.fillRect(x - 6, y - 16, 12, 8);
    g.lineStyle(lineW, lineC, 0.95);
    g.strokeRect(x - 6, y - 16, 12, 8);
    // 顶盖
    g.fillStyle(0x707070, 1);
    g.fillRect(x - 7, y - 18, 14, 2);
    g.lineStyle(lineW, lineC, 0.95);
    g.strokeRect(x - 7, y - 18, 14, 2);
    // 投递口
    g.fillStyle(0x101010, 0.9);
    g.fillRect(x - 4, y - 13, 8, 1.5);
    // 信件图案（信封三角）
    g.lineStyle(0.5, 0xfafafa, 0.85);
    g.lineBetween(x - 3, y - 10.5, x, y - 9);
    g.lineBetween(x,     y - 9,    x + 3, y - 10.5);
  }

  // ─── 花坛 ────────────────────────────────────────────────────────────────
  _drawPlanter(g) {
    const w = this.width || 30;
    const h = 9;
    const px = this.x - w / 2;
    const py = this.y - h;
    const lineW = depthLineWidth(this.y, { wMin: 0.9, wMax: 1.5 });
    const lineC = depthLineColor(this.y, { light: 0x40, dark: 0x10 });
    // 花坛箱
    g.fillStyle(0xb4b4b4, 1);
    g.fillRect(px, py + 3, w, h - 3);
    g.lineStyle(lineW, lineC, 0.95);
    g.strokeRect(px, py + 3, w, h - 3);
    // 砖纹
    g.lineStyle(0.4, lineC, 0.6);
    const segs = Math.max(2, Math.floor(w / 8));
    for (let i = 1; i < segs; i++) {
      const lx = px + (w * i / segs);
      g.lineBetween(lx, py + 3, lx, py + h);
    }
    // 植物（分叉线条，非实心圆）
    const clumps = Math.max(2, Math.floor(w / 9));
    for (let i = 0; i < clumps; i++) {
      const cx = px + 4 + i * (w - 8) / Math.max(1, clumps - 1);
      const cy = py + 2;
      g.lineStyle(lineW * 0.9, lineC, 0.85);
      g.lineBetween(cx, cy + 2, cx, cy - 4);
      g.lineBetween(cx, cy - 2, cx - 3, cy - 5);
      g.lineBetween(cx, cy - 2, cx + 3, cy - 5);
      g.lineBetween(cx, cy - 4, cx - 2, cy - 6);
      g.lineBetween(cx, cy - 4, cx + 2, cy - 6);
    }
  }

  // ─── 井盖（路面圆形，俯视椭圆 + 网格线） ─────────────────────────────────
  _drawManhole(g) {
    const { x, y } = this;
    const rx = (this.width || 18) / 2;
    const ry = rx * 0.45; // 椭圆压扁
    const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
    // 底圈阴影
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(x + 1, y + 1, rx * 2.1, ry * 2.1);
    // 主体
    g.fillStyle(0x6a6a6a, 1);
    g.fillEllipse(x, y, rx * 2, ry * 2);
    g.lineStyle(lineW, 0x101010, 0.92);
    g.strokeEllipse(x, y, rx * 2, ry * 2);
    // 内圈
    g.lineStyle(0.5, 0x1a1a1a, 0.8);
    g.strokeEllipse(x, y, rx * 1.55, ry * 1.55);
    // 网格（短横线，模拟铸铁纹）
    g.lineStyle(0.5, 0x202020, 0.7);
    for (let i = -2; i <= 2; i++) {
      const ly = y + i * (ry * 0.32);
      const t  = 1 - Math.pow(i / 2.8, 2);
      const half = Math.sqrt(Math.max(0, t)) * rx * 0.78;
      g.lineBetween(x - half, ly, x + half, ly);
    }
  }

  // ─── 椅子（侧视，背靠 dir 反方向；椅面距地由 seatH 决定，腿落到 this.y） ──
  _drawChair(g) {
    const x = this.x, y = this.y;
    const d = this.dir;            // +1 椅背在左, -1 椅背在右
    const seatH = this.seatH ?? 14;
    const seatW = 14;
    const seatY = y - seatH;       // 椅面 = 坐者臀部
    const seatX1 = x - seatW / 2;
    const seatX2 = x + seatW / 2;
    g.lineStyle(1.2, 0x202020, 0.95);
    g.lineBetween(seatX1, seatY, seatX2, seatY);
    // 椅背（背在 -d 方向，向上延伸约半个椅面高）
    const backX = (d > 0) ? seatX1 : seatX2;
    const backTop = seatY - seatH * 0.7;
    g.lineBetween(backX, seatY, backX, backTop);
    g.lineBetween(backX - 2 * d, backTop, backX + 1 * d, backTop);
    // 前后两腿落地
    g.lineStyle(1, 0x202020, 0.9);
    g.lineBetween(seatX1 + 1, seatY, seatX1 + 1, y);
    g.lineBetween(seatX2 - 1, seatY, seatX2 - 1, y);
    // 坐垫线
    g.lineStyle(0.5, 0x303030, 0.6);
    g.lineBetween(seatX1 + 1, seatY + 1, seatX2 - 1, seatY + 1);
  }

  // ─── 棋桌（桌面 = 双方手部高度，由 topH 决定；腿落到 this.y） ───────────
  _drawChessTable(g) {
    const tw = this.width || 22;
    const x = this.x, y = this.y;
    const topH = this.topH ?? 18;      // 桌面距地
    const th = Math.min(8, Math.max(5, topH * 0.4)); // 桌面厚度
    const topX = x - tw / 2;
    const topY = y - topH;
    // 桌面
    g.fillStyle(0xcfcfcf, 1);
    g.fillRect(topX, topY, tw, th);
    g.lineStyle(1, 0x1a1a1a, 0.95);
    g.strokeRect(topX, topY, tw, th);
    g.lineStyle(0.5, 0xfafafa, 0.85);
    g.lineBetween(topX + 1, topY + 1, topX + tw - 1, topY + 1);
    // 棋盘 3×3 网格
    g.lineStyle(0.6, 0x101010, 0.85);
    for (let i = 1; i < 3; i++) {
      const lx = topX + (tw * i / 3);
      g.lineBetween(lx, topY + 2, lx, topY + th - 2);
    }
    for (let i = 1; i < 3; i++) {
      const ly = topY + 2 + (th - 4) * i / 3;
      g.lineBetween(topX + 2, ly, topX + tw - 2, ly);
    }
    // 4 腿
    g.lineStyle(1, 0x1a1a1a, 0.95);
    g.lineBetween(topX + 1,      topY + th, topX + 1,      y);
    g.lineBetween(topX + tw - 1, topY + th, topX + tw - 1, y);
    g.lineStyle(0.7, 0x1a1a1a, 0.7);
    g.lineBetween(topX + tw * 0.3, topY + th, topX + tw * 0.3, y - 1);
    g.lineBetween(topX + tw * 0.7, topY + th, topX + tw * 0.7, y - 1);
  }

  // ─── 行道树（道具版，俯视分瓣树冠 + 小十字树干，深度自适应） ──────────────
  _drawTree(g) {
    const { x, y } = this;
    const r  = (this.width || 22) / 2;
    const lw = depthLineWidth(y, { wMin: 0.7, wMax: 1.5 });
    const c  = depthLineColor(y, { light: 0x78, dark: 0x24 });
    // 阴影
    g.fillStyle(0x000000, 0.10);
    g.fillEllipse(x + r * 0.2, y + r * 0.3, r * 1.7, r * 0.6);
    // 分瓣轮廓
    const lobes = 6, steps = lobes * 4, pts = [];
    for (let i = 0; i < steps; i++) {
      const ang  = (i / steps) * Math.PI * 2;
      const lobe = 0.84 + 0.16 * Math.cos(ang * lobes);
      const nz   = 1 + 0.06 * Math.sin(x * 0.21 + i * 1.3);
      const rad  = r * lobe * nz;
      pts.push({ x: x + Math.cos(ang) * rad, y: y + Math.sin(ang) * rad * 0.82 });
    }
    g.fillStyle(c, 0.08);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < steps; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath(); g.fillPath();
    g.lineStyle(lw, c, 0.9);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < steps; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath(); g.strokePath();
    // 内部叶丛短弧 + 树干十字
    g.lineStyle(lw * 0.7, c, 0.5);
    g.strokeCircle(x - r * 0.3, y - r * 0.15, r * 0.3);
    g.lineStyle(lw * 1.1, c, 0.9);
    g.lineBetween(x - 1.5, y, x + 1.5, y);
    g.lineBetween(x, y - 1.5, x, y + 1.5);
  }

  // ─── 排水沟盖（路边长条，多条平行竖线） ───────────────────────────────────
  _drawDrain(g) {
    const w = this.width || 18;
    const h = 6;
    const px = this.x - w / 2;
    const py = this.y - h / 2;
    g.fillStyle(0x707070, 1);
    g.fillRect(px, py, w, h);
    g.lineStyle(0.9, 0x101010, 0.9);
    g.strokeRect(px, py, w, h);
    // 平行栅条
    g.lineStyle(0.6, 0x1a1a1a, 0.85);
    const slots = Math.max(3, Math.floor(w / 3));
    for (let i = 1; i < slots; i++) {
      const lx = px + (w * i / slots);
      g.lineBetween(lx, py + 1, lx, py + h - 1);
    }
  }

  // ─── 公园喷泉（俯视椭圆水池 + 中央水柱，柔和接地不漂浮） ───────────────────
  _drawFountain(g) {
  const { x, y } = this;
  const rx = (this.width || 60) / 2;
  const ry = rx * 0.42;

  // 极淡地面压痕
  g.fillStyle(0x000000, 0.04);
  g.fillEllipse(x, y + 4, rx * 1.9, ry * 1.3);

  // 外圈地砖
  g.fillStyle(0xe5e5e5, 1);
  g.fillEllipse(x, y, rx * 1.55, ry * 1.55);

  // 池边
  g.lineStyle(1, 0xbcbcbc, 0.7);
  g.strokeEllipse(x, y, rx * 1.2, ry * 1.2);

  // 水面
  g.fillStyle(0xd6d6d6, 0.9);
  g.fillEllipse(x + 1, y - 1, rx * 0.92, ry * 0.92);

  // 少量水波
  g.lineStyle(0.5, 0xb0b0b0, 0.35);
  g.strokeEllipse(x - 1, y, rx * 0.42, ry * 0.42);

  // 中央小喷头
  g.fillStyle(0xa8a8a8, 1);
  g.fillCircle(x, y - 1, 2);

  // 简化水线
  g.lineStyle(0.8, 0xf0f0f0, 0.6);
  g.lineBetween(x, y - 2, x, y - ry * 1.1);
}

  // ─── 自动售货机（玻璃柜 + 商品格 + 取货口） ───────────────────────────────
  _drawVending(g) {
    const { x, y } = this;
    const w = this.width || 16, h = w * 1.7;
    const px = x - w / 2, py = y - h;
    const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
    const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });
    g.fillStyle(0x000000, 0.10); g.fillEllipse(x, y, w * 1.1, 4);   // 接地影
    // 机身
    g.fillStyle(0xb0b0b0, 1); g.fillRect(px, py, w, h);
    g.lineStyle(lineW, lineC, 0.95); g.strokeRect(px, py, w, h);
    // 玻璃柜
    const gx = px + 2, gy = py + 2, gw = w * 0.6, gh = h - 10;
    g.fillStyle(0x3a3a3a, 0.6); g.fillRect(gx, gy, gw, gh);
    g.fillStyle(0xffffff, 0.18); g.fillRect(gx + 1, gy + 1, gw - 2, gh * 0.4);
    g.lineStyle(0.5, lineC, 0.8); g.strokeRect(gx, gy, gw, gh);
    // 商品格横线
    g.lineStyle(0.4, 0xcacaca, 0.6);
    for (let i = 1; i < 5; i++) g.lineBetween(gx, gy + gh * i / 5, gx + gw, gy + gh * i / 5);
    // 右侧操作面板
    g.fillStyle(0x8a8a8a, 1); g.fillRect(px + gw + 3, gy, w - gw - 5, gh * 0.5);
    g.lineStyle(0.5, lineC, 0.8); g.strokeRect(px + gw + 3, gy, w - gw - 5, gh * 0.5);
    // 取货口
    g.fillStyle(0x101010, 0.9); g.fillRect(px + 2, py + h - 6, w - 4, 3);
  }

  // ─── 电话亭（高玻璃亭 + 顶盖 + 听筒暗示） ─────────────────────────────────
  _drawPhoneBooth(g) {
    const { x, y } = this;
    const w = this.width || 16, h = w * 2.1;
    const px = x - w / 2, py = y - h;
    const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
    const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });
    g.fillStyle(0x000000, 0.10); g.fillEllipse(x, y, w * 1.1, 4);   // 接地影
    // 亭体（玻璃）
    g.fillStyle(0x404040, 0.5); g.fillRect(px, py + 4, w, h - 4);
    g.fillStyle(0xffffff, 0.16); g.fillRect(px + 1, py + 5, w - 2, (h - 4) * 0.45);
    g.lineStyle(lineW, lineC, 0.95); g.strokeRect(px, py + 4, w, h - 4);
    // 竖向窗框
    g.lineStyle(0.5, lineC, 0.7);
    g.lineBetween(px + w / 2, py + 5, px + w / 2, y - 1);
    g.lineBetween(px + 2, py + (h - 4) * 0.5, px + w - 2, py + (h - 4) * 0.5);
    // 顶盖
    g.fillStyle(0x6a6a6a, 1); g.fillRect(px - 1, py, w + 2, 5);
    g.lineStyle(lineW, lineC, 0.95); g.strokeRect(px - 1, py, w + 2, 5);
    // 顶部标识条
    g.fillStyle(0xeaeaea, 0.9); g.fillRect(px + 1, py + 1, w - 2, 2);
    // 听筒/话机暗示（内侧小竖块）
    g.fillStyle(0x202020, 0.7); g.fillRect(px + w - 5, py + 10, 2, 6);
  }

  // ─── 小摊贩亭（条纹遮阳棚 + 货台 + 货物） ──────────────────────────────────
  _drawStall(g) {
    const { x, y } = this;
    const w = this.width || 36;
    const h = w * 0.78;
    const lineW = depthLineWidth(y, { wMin: 1, wMax: 1.7 });
    const lineC = depthLineColor(y, { light: 0x38, dark: 0x08 });
    const px = x - w / 2;
    const counterY = y - h * 0.42;
    // 立柱
    g.lineStyle(lineW, lineC, 0.95);
    g.lineBetween(px + 2, y, px + 2, y - h);
    g.lineBetween(px + w - 2, y, px + w - 2, y - h);
    // 条纹遮阳棚（梯形）
    const aY = y - h, aH = 6;
    g.fillStyle(0x707070, 1);
    g.beginPath();
    g.moveTo(px, aY + aH); g.lineTo(px + w, aY + aH);
    g.lineTo(px + w + 3, aY); g.lineTo(px - 3, aY);
    g.closePath(); g.fillPath();
    g.lineStyle(lineW, lineC, 0.95); g.strokePath();
    g.lineStyle(0.5, 0xdddddd, 0.7);
    for (let i = 1; i < Math.floor(w / 6); i++) {
      const sx = px - 3 + i * 6; g.lineBetween(sx, aY, sx + 1.5, aY + aH);
    }
    // 货台
    g.fillStyle(0xc0c0c0, 1); g.fillRect(px + 1, counterY, w - 2, 4);
    g.lineStyle(lineW, lineC, 0.95); g.strokeRect(px + 1, counterY, w - 2, 4);
    // 货物（小方块/堆叠）
    g.fillStyle(0x9a9a9a, 1);
    for (let i = 0; i < 3; i++) {
      const gx = px + 4 + i * ((w - 10) / 2);
      g.fillRect(gx, counterY - 3, 4, 3);
      g.lineStyle(0.4, lineC, 0.85); g.strokeRect(gx, counterY - 3, 4, 3);
    }
  }
}
