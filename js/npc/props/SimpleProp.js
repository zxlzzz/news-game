/**
 * SimpleProp — 根据 AttachmentDefs draw 描述符绘制简单几何道具。
 *
 * 支持 shape: 'rect' | 'circle' | 'line'
 * 坐标全部经由 npc.getAnchor(anchor) + scale + direction 派生，不硬编码关节坐标。
 */

import { NpcProp } from './NpcProp.js';

export class SimpleProp extends NpcProp {
  /**
   * @param {object} npc
   * @param {string} anchor   getAnchor() 锚点名
   * @param {object} drawDesc AttachmentDefs[item].draw
   */
  constructor(npc, anchor, drawDesc) {
    super(npc);
    this._anchor = anchor;
    this._desc   = drawDesc;
  }

  draw(g) {
    if (!this.active) return;
    g.lineStyle(0);

    const a = this.npc.getAnchor(this._anchor);
    const s = this.npc.scale;
    const d = this.npc.direction;

    switch (this._desc.shape) {
      case 'rect': {
        const ox = this._desc.offsetX * s * d;
        const oy = this._desc.offsetY * s;
        g.beginFill(this._desc.color, this._desc.alpha ?? 1);
        g.drawRect(
          a.x + ox - this._desc.w * s / 2,
          a.y + oy - this._desc.h * s / 2,
          this._desc.w * s,
          this._desc.h * s,
        );
        g.endFill();
        break;
      }

      case 'circle': {
        const ox = (this._desc.offsetX ?? 0) * s * d;
        const oy = (this._desc.offsetY ?? 0) * s;
        g.beginFill(this._desc.color, this._desc.alpha ?? 1);
        g.drawCircle(a.x + ox, a.y + oy, this._desc.r * s);
        g.endFill();
        break;
      }

      case 'line': {
        const angleRad = (this._desc.angle ?? 0) * Math.PI / 180;
        const len = this._desc.length * s;
        const tx  = a.x + Math.sin(angleRad) * len * d;
        const ty  = a.y + Math.cos(angleRad) * len;
        g.lineStyle(this._desc.lineWidth * s, this._desc.color, this._desc.alpha ?? 1);
        g.moveTo(a.x, a.y);
        g.lineTo(tx, ty);
        g.lineStyle(0);
        break;
      }

      default: break;
    }
  }
}
