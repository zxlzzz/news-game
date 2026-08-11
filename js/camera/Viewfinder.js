/**
 * Viewfinder
 * 可拖动取景框：检测框内所有实体（NPC、建筑、道具）并收集标签。
 */

import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/Layout.js';
import { toScreen, projectGroundRect } from '../core/Projection.js';

export class Viewfinder {
  constructor({ app, getWorldCoords }, config = {}) {
    this.app = app;
    this._toWorld = getWorldCoords;
    // O-1：世界单位，× UNIT_REBASE_FACTOR(5.294118)（原世界像素 300/200/200/160、90/70/520/380）
    this.x      = config.x      || 1588;
    this.y      = config.y      || 1059;
    this.width  = config.width  || 1059;
    this.height = config.height || 847;

    this.minWidth  = config.minWidth  || 476;
    this.minHeight = config.minHeight || 371;
    this.maxWidth  = config.maxWidth  || 2753;
    this.maxHeight = config.maxHeight || 2012;

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

  // O-2：取景框是世界坐标下的矩形，投影后是平行四边形（shear）——外框/高亮
  // 描边直接画投影后的四边形；十字准星/拍摄指示灯/缩放手柄这几个纯 UI 装饰
  // 不代表贴地几何，仍按屏幕空间轴对齐画，只是定位点换成投影后的角点。
  draw(g) {
    const cx = this.x, cy = this.y, cw = this.width, ch = this.height;
    const cornerLen = 12;

    // quad = [p0(左上/远), p1(右上/远), p2(右下/近), p3(左下/近)]（世界意义上的四角）
    const quad = projectGroundRect(cx, cy, cx + cw, cy + ch);
    const [p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y] = quad;

    // outer frame
    g.lineStyle(2, 0xffffff, 0.88);
    g.drawPolygon(quad);

    // corner marks：沿平行四边形的边取一小段，替代原来轴对齐矩形的 L 形
    g.lineStyle(3, 0xff4444, 1);
    const corners = [[p0x, p0y, p1x, p1y], [p0x, p0y, p3x, p3y],
                      [p1x, p1y, p0x, p0y], [p1x, p1y, p2x, p2y],
                      [p3x, p3y, p0x, p0y], [p3x, p3y, p2x, p2y],
                      [p2x, p2y, p1x, p1y], [p2x, p2y, p3x, p3y]];
    for (const [ax, ay, bx, by] of corners) {
      const d = Math.hypot(bx - ax, by - ay);
      const t = d > 0 ? cornerLen / d : 0;
      g.moveTo(ax, ay);
      g.lineTo(ax + (bx - ax) * t, ay + (by - ay) * t);
    }

    // center cross（UI 装饰，屏幕空间轴对齐）
    const center = toScreen(cx + cw / 2, cy + ch / 2);
    g.lineStyle(1, 0xffffff, 0.3);
    g.moveTo(center.x - 10, center.y); g.lineTo(center.x + 10, center.y);
    g.moveTo(center.x, center.y - 10); g.lineTo(center.x, center.y + 10);

    // capture indicator（贴着 p1＝右上角）
    if (this.capturedEntities.length > 0) {
      g.beginFill(0xff4444, 0.85);
      g.drawCircle(p1x - 8, p1y + 8, 5);
      g.endFill();
    }

    this._drawResizeHandle(g, p2x, p2y); // p2＝右下角（世界意义：cx+cw, cy+ch）

    // Highlight outlines for captured entities
    if (this.capturedEntities.length > 0) {
      g.lineStyle(2, 0xffcc00, 0.7);
      for (const e of this.capturedEntities) {
        const b = e.getBounds();
        g.drawPolygon(projectGroundRect(b.x, b.y, b.x + b.width, b.y + b.height));
      }
    }
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
