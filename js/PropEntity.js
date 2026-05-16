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
    g.lineStyle(2.5, 0x8a8880, 0.92);
    g.lineBetween(x, y + 14, x, y - 6);
    g.lineStyle(2, 0x8c8a84, 0.85);
    g.lineBetween(x, y - 6, x + 16, y + 8);
    g.fillStyle(0xdcd090, 0.95);
    g.fillCircle(x + 16, y + 8, 5);
    g.fillStyle(0xfffff8, 0.45);
    g.fillCircle(x + 16, y + 8, 2.5);
  }

  // ── 路灯：近端（灯臂朝Y减小方向，即朝道路） ──────────────────────────────────
  _drawLampNear(g) {
    const { x, y } = this;
    g.lineStyle(2.5, 0x8a8880, 0.92);
    g.lineBetween(x, y - 12, x, y + 8);
    g.lineStyle(2, 0x8c8a84, 0.85);
    g.lineBetween(x, y - 12, x - 16, y - 5);
    g.fillStyle(0xdcd090, 0.95);
    g.fillCircle(x - 16, y - 5, 5);
    g.fillStyle(0xfffff8, 0.45);
    g.fillCircle(x - 16, y - 5, 2.5);
  }

  // ── 长椅 ──────────────────────────────────────────────────────────────────────
  _drawBench(g) {
    const bw = this.width;
    const bh = 11;
    const bx = this.x - bw / 2;
    const by = this.y - bh;
    // 椅面
    g.fillStyle(0xb09868, 0.88);
    g.fillRect(bx, by, bw, bh);
    // 椅背
    g.fillStyle(0x907848, 0.75);
    g.fillRect(bx, by - 4, bw, 4);
    // 轮廓
    g.lineStyle(1, 0x7a6040, 0.8);
    g.strokeRect(bx, by, bw, bh);
    // 椅腿
    g.fillStyle(0x605030, 0.55);
    g.fillRect(bx + 4,       by + bh, 3, 4);
    g.fillRect(bx + bw - 7,  by + bh, 3, 4);
  }

  // ── 垃圾桶 ────────────────────────────────────────────────────────────────────
  _drawTrash(g) {
    const { x, y } = this;
    const r = 6;
    // 桶身投影
    g.fillStyle(0x444444, 0.2);
    g.fillEllipse(x + 3, y - r + 5, r * 2.5, r * 1.4);
    // 桶身
    g.fillStyle(0x607060, 0.92);
    g.fillCircle(x, y - r, r);
    // 桶盖轮廓
    g.lineStyle(1.5, 0x405040, 0.9);
    g.strokeCircle(x, y - r, r);
    // 桶口
    g.fillStyle(0x304030, 0.7);
    g.fillCircle(x, y - r, 2.5);
  }

  // ── 招牌 ──────────────────────────────────────────────────────────────────────
  _drawSign(g) {
    const sw = this.width;
    const sh = 14;
    const sx = this.x - sw / 2;
    const sy = this.y - sh;
    // 底板
    g.fillStyle(this.propColor, 0.92);
    g.fillRect(sx, sy, sw, sh);
    // 高光
    g.fillStyle(0xffffff, 0.14);
    g.fillRect(sx, sy, sw, Math.floor(sh * 0.4));
    // 边框
    g.lineStyle(1.5, 0x000000, 0.42);
    g.strokeRect(sx, sy, sw, sh);
  }
}
