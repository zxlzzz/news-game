/**
 * Viewfinder
 * 可拖动取景框：检测框内所有实体（NPC、建筑、道具）并收集标签。
 */

import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/Layout.js';

export class Viewfinder {
  constructor({ app, getWorldCoords }, config = {}) {
    this.app = app;
    this._toWorld = getWorldCoords;
    this.x      = config.x      || 300;
    this.y      = config.y      || 200;
    this.width  = config.width  || 200;
    this.height = config.height || 160;

    this.minWidth  = config.minWidth  || 90;
    this.minHeight = config.minHeight || 70;
    this.maxWidth  = config.maxWidth  || 520;
    this.maxHeight = config.maxHeight || 380;

    this.dragging    = false;
    this.resizing    = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.resizeAnchorX = 0;
    this.resizeAnchorY = 0;
    this.resizeGrabDx  = 0;
    this.resizeGrabDy  = 0;

    this.handleSize = 16;

    this.capturedEntities = [];

    this._setupInput();
  }

  _isInHandle(wx, wy) {
    const hx = this.x + this.width;
    const hy = this.y + this.height;
    const s  = this.handleSize;
    return wx >= hx - s && wx <= hx + 2 && wy >= hy - s && wy <= hy + 2;
  }

  _setupInput() {
    const view = this.app.view;

    view.addEventListener('pointerdown', (e) => {
      const { x: wx, y: wy } = this._toWorld(e.clientX, e.clientY);
      if (this._isInHandle(wx, wy)) {
        this.resizing = true;
        this.resizeAnchorX = this.x;
        this.resizeAnchorY = this.y;
        this.resizeGrabDx  = (this.x + this.width)  - wx;
        this.resizeGrabDy  = (this.y + this.height) - wy;
        return;
      }
      if (wx >= this.x && wx <= this.x + this.width &&
          wy >= this.y && wy <= this.y + this.height) {
        this.dragging    = true;
        this.dragOffsetX = wx - this.x;
        this.dragOffsetY = wy - this.y;
      }
    });

    view.addEventListener('pointermove', (e) => {
      if (!this.resizing && !this.dragging) return;
      const { x: wx, y: wy } = this._toWorld(e.clientX, e.clientY);
      if (this.resizing) {
        const newW = (wx + this.resizeGrabDx) - this.resizeAnchorX;
        const newH = (wy + this.resizeGrabDy) - this.resizeAnchorY;
        this.width  = Math.max(this.minWidth,  Math.min(this.maxWidth,  newW));
        this.height = Math.max(this.minHeight, Math.min(this.maxHeight, newH));
        return;
      }
      this.x = Math.max(0, Math.min(WORLD_WIDTH  - this.width,  wx - this.dragOffsetX));
      this.y = Math.max(0, Math.min(WORLD_HEIGHT - this.height, wy - this.dragOffsetY));
    });

    window.addEventListener('pointerup', () => {
      this.dragging = false;
      this.resizing = false;
    });
  }

  updateCapture(entities) {
    this.capturedEntities = [];
    const vf = { x: this.x, y: this.y, w: this.width, h: this.height };

    for (const e of entities) {
      const b = e.getBounds();
      const overlap = !(
        b.x + b.width  < vf.x ||
        b.x            > vf.x + vf.w ||
        b.y + b.height < vf.y ||
        b.y            > vf.y + vf.h
      );
      if (overlap) this.capturedEntities.push(e);
    }
  }

  draw(g) {
    const cx = this.x, cy = this.y, cw = this.width, ch = this.height;
    const cornerLen = 12;

    // outer frame
    g.lineStyle(2, 0xffffff, 0.88);
    g.drawRect(cx, cy, cw, ch);

    // corner marks
    g.lineStyle(3, 0xff4444, 1);
    g.moveTo(cx,      cy);      g.lineTo(cx + cornerLen, cy);
    g.moveTo(cx,      cy);      g.lineTo(cx,      cy + cornerLen);
    g.moveTo(cx + cw, cy);      g.lineTo(cx + cw - cornerLen, cy);
    g.moveTo(cx + cw, cy);      g.lineTo(cx + cw, cy + cornerLen);
    g.moveTo(cx,      cy + ch); g.lineTo(cx + cornerLen,      cy + ch);
    g.moveTo(cx,      cy + ch); g.lineTo(cx,      cy + ch - cornerLen);
    g.moveTo(cx + cw, cy + ch); g.lineTo(cx + cw - cornerLen, cy + ch);
    g.moveTo(cx + cw, cy + ch); g.lineTo(cx + cw, cy + ch - cornerLen);

    // center cross
    const mx = cx + cw / 2, my = cy + ch / 2;
    g.lineStyle(1, 0xffffff, 0.3);
    g.moveTo(mx - 10, my); g.lineTo(mx + 10, my);
    g.moveTo(mx, my - 10); g.lineTo(mx, my + 10);

    // capture indicator
    if (this.capturedEntities.length > 0) {
      g.beginFill(0xff4444, 0.85);
      g.drawCircle(cx + cw - 8, cy + 8, 5);
      g.endFill();
    }

    this._drawResizeHandle(g, cx + cw, cy + ch);
  }

  _drawResizeHandle(g, hx, hy) {
    const s = this.handleSize;
    g.beginFill(0xffffff, this.resizing ? 0.9 : 0.55);
    g.drawRect(hx - s, hy - s, s + 2, s + 2);
    g.endFill();
    g.lineStyle(2, 0xff4444, 1);
    g.drawRect(hx - s, hy - s, s + 2, s + 2);
    g.lineStyle(1.5, 0xcc2200, 0.95);
    for (let i = 0; i < 3; i++) {
      const off = 3 + i * 4;
      g.moveTo(hx - off, hy + 1); g.lineTo(hx + 1, hy - off);
    }
  }

  getCenter() {
    return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
  }

  getCapturedTags() {
    const tags = new Set();
    for (const e of this.capturedEntities) {
      const list = (typeof e.getTags === 'function') ? e.getTags() : (e.tags || []);
      for (const tag of list) tags.add(tag);
    }
    return Array.from(tags);
  }
}
