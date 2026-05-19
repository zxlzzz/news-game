/**
 * PropEntity
 * 静态场景道具实体：路灯、长椅、垃圾桶、招牌等。
 * 用简单 Graphics 绘制，带语义 tags，可被取景框识别。
 *
 * 坐标约定：this.x/y 为道具视觉底部中心点
 *
 * propType 枚举：
 *   'lamp-far'  — 道路远端路灯（灯臂朝路面方向）
 *   'lamp-near' — 道路近端路灯（灯臂朝路面方向）
 *   'bench'     — 长椅（宽度由 this.width 决定）
 *   'trash'     — 垃圾桶（小圆形）
 *   'sign'      — 店铺/机构招牌（颜色由 propColor 决定）
 */

import { Entity } from './Entity.js';
import { depthGray, depthLineWidth, LINE_FAR_COLOR, LINE_NEAR_COLOR } from './SceneConfig.js';

// 把任意颜色压成 luminance，再映射到指定灰阶区间
function toGrayBand(color, lightVal, darkVal) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b =  color        & 0xff;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const v   = Math.round(lightVal + (lum / 255) * (darkVal - lightVal));
  return (v << 16) | (v << 8) | v;
}

export class PropEntity extends Entity {
  /**
   * @param {object} config
   * @param {string}  config.propType  - 道具类型
   * @param {number}  config.propColor - 招牌/道具主色（默认灰色）
   */
  constructor(config) {
    super({ ...config, static: true });
    this.propType  = config.propType  || 'generic';
    this.propColor = config.propColor ?? 0x888888;
  }

  draw(g) {
    if (!this.visible) return;
    switch (this.propType) {
      case 'lamp-far':  this._drawLampFar(g);  break;
      case 'lamp-near': this._drawLampNear(g); break;
      case 'bench':     this._drawBench(g);    break;
      case 'trash':     this._drawTrash(g);    break;
      case 'sign':      this._drawSign(g);     break;
    }
    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }

  // ── 路灯：远端（灯臂朝Y增大方向，即朝道路） ──────────────────────────────────
  _drawLampFar(g) {
    const { x, y } = this;
    g.lineStyle(1.5, 0x6a6a6a, 0.92);
    g.lineBetween(x, y + 14, x, y - 6);
    g.lineStyle(1.2, 0x6a6a6a, 0.88);
    g.lineBetween(x, y - 6, x + 16, y + 8);
    // 灯罩（深灰）
    g.fillStyle(0x404040, 0.95);
    g.fillCircle(x + 16, y + 8, 5);
    // 灯泡光晕（白色）
    g.fillStyle(0xffffff, 0.75);
    g.fillCircle(x + 16, y + 8, 2.5);
  }

  // ── 路灯：近端（灯臂朝Y减小方向，即朝道路） ──────────────────────────────────
  _drawLampNear(g) {
    const { x, y } = this;
    g.lineStyle(3, 0x1a1a1a, 0.95);
    g.lineBetween(x, y - 12, x, y + 8);
    g.lineStyle(2.4, 0x1a1a1a, 0.92);
    g.lineBetween(x, y - 12, x - 16, y - 5);
    // 灯罩（黑）
    g.fillStyle(0x0a0a0a, 1);
    g.fillCircle(x - 16, y - 5, 5.5);
    // 灯泡（白）
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(x - 16, y - 5, 2.8);
  }

  // ── 长椅 ──────────────────────────────────────────────────────────────────────
  _drawBench(g) {
    const bw = this.width;
    const bh = 11;
    const bx = this.x - bw / 2;
    const by = this.y - bh;
    // 灰度按 Y 取色（这里 Y≈216，浅灰偏中）
    const fill   = depthGray(this.y, { light: 0xa8, dark: 0x30 });
    const stroke = depthGray(this.y, { light: 0x60, dark: 0x00 });
    const lw     = depthLineWidth(this.y, { wMin: 1, wMax: 2 });
    // 椅面
    g.fillStyle(fill, 0.95);
    g.fillRect(bx, by, bw, bh);
    // 椅背（略深）
    const back = depthGray(this.y, { light: 0x80, dark: 0x18 });
    g.fillStyle(back, 0.85);
    g.fillRect(bx, by - 4, bw, 4);
    // 轮廓
    g.lineStyle(lw, stroke, 0.85);
    g.strokeRect(bx, by, bw, bh);
    // 椅腿
    g.fillStyle(stroke, 0.7);
    g.fillRect(bx + 4,       by + bh, 3, 4);
    g.fillRect(bx + bw - 7,  by + bh, 3, 4);
  }

  // ── 垃圾桶 ────────────────────────────────────────────────────────────────────
  _drawTrash(g) {
    const { x, y } = this;
    const r = 6;
    const fill   = depthGray(y, { light: 0x90, dark: 0x20 });
    const stroke = depthGray(y, { light: 0x4a, dark: 0x00 });
    const lw     = depthLineWidth(y, { wMin: 1, wMax: 2 });
    // 桶身投影
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(x + 3, y - r + 5, r * 2.5, r * 1.4);
    // 桶身
    g.fillStyle(fill, 0.95);
    g.fillCircle(x, y - r, r);
    // 桶盖轮廓
    g.lineStyle(lw, stroke, 0.92);
    g.strokeCircle(x, y - r, r);
    // 桶口
    g.fillStyle(stroke, 0.85);
    g.fillCircle(x, y - r, 2.5);
  }

  // ── 招牌 ──────────────────────────────────────────────────────────────────────
  _drawSign(g) {
    const sw = this.width;
    const sh = 14;
    const sx = this.x - sw / 2;
    const sy = this.y - sh;
    // 招牌底板：原配置色压成中浅灰带（90–55），保留每家招牌的微差异
    const fill = toGrayBand(this.propColor, 0xb0, 0x68);
    // 底板
    g.fillStyle(fill, 0.95);
    g.fillRect(sx, sy, sw, sh);
    // 高光
    g.fillStyle(0xffffff, 0.18);
    g.fillRect(sx, sy, sw, Math.floor(sh * 0.4));
    // 边框（薄黑线，建筑层级）
    g.lineStyle(1, 0x000000, 0.5);
    g.strokeRect(sx, sy, sw, sh);
  }
}
