/**
 * Viewfinder
 * 可拖动取景框：检测框内所有实体（NPC、建筑、道具）并收集标签。
 *
 * 取景框位置补丁（tasks.md 外的直接修复，2026-08-11）：坐标系从"世界坐标"
 * 改成"屏幕像素坐标，浮在顶层（uiContainer），完全独立于相机 pan/zoom"——
 * 取景框不再代表世界上的一块地皮，而是玩家在屏幕上摆的一个取景窗口，随相机
 * 怎么动都不受影响，也不需要相机反过来"跟着它挪"。删掉的是 StreetScene 里
 * 那段跟随逻辑（两轮真实修复后 Hsinlung 仍不满意开局自动平移的观感，见
 * docs/roadmap.md "相机跟随取景框" 系列条目）；这里同步把取景框本身也搬到
 * 屏幕空间，否则跟随逻辑一删，拖到屏幕边缘就再也够不着世界剩下的部分。
 *
 * 拖拽/缩放直接用画布本地像素坐标（`getScreenCoords`，不再经世界坐标换算）；
 * 命中检测的实体世界包围盒每帧经 `toRenderScreen`（世界坐标 + 当前相机
 * pan/zoom → 当前屏幕像素）投影后再跟取景框比较——取景框固定不动，但相机一
 * 移动，同一批实体投影出来的屏幕位置会变，命中集合因此仍然正确随相机内容
 * 更新。用四角 AABB 近似（世界矩形因 shear 投影后是平行四边形），跟本项目
 * 其它"近似够用，不必算精确多边形相交"的取舍一致。
 */

export class Viewfinder {
  constructor({ app, getScreenCoords, toRenderScreen }, config = {}) {
    this.app = app;
    this._toScreenCoords = getScreenCoords; // client(x,y) → 画布本地像素 {x,y}
    this._toRenderScreen = toRenderScreen;  // 世界(x,y) → 当前屏幕像素 {x,y}（含相机 pan/zoom）

    // 屏幕像素坐标（viewport 相对，不随相机 pan/zoom 变化）
    this.x      = config.x      ?? 130;
    this.y      = config.y      ?? 130;
    this.width  = config.width  ?? 640;
    this.height = config.height ?? 460;

    this.minWidth  = config.minWidth  ?? 200;
    this.minHeight = config.minHeight ?? 150;
    this.maxWidth  = config.maxWidth  ?? 860;
    this.maxHeight = config.maxHeight ?? 680;

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

  _isInHandle(sx, sy) {
    const hx = this.x + this.width;
    const hy = this.y + this.height;
    const s  = this.handleSize;
    return sx >= hx - s && sx <= hx + 2 && sy >= hy - s && sy <= hy + 2;
  }

  _setupInput() {
    const view = this.app.view;

    view.addEventListener('pointerdown', (e) => {
      const { x: sx, y: sy } = this._toScreenCoords(e.clientX, e.clientY);
      if (this._isInHandle(sx, sy)) {
        this.resizing = true;
        this.resizeAnchorX = this.x;
        this.resizeAnchorY = this.y;
        this.resizeGrabDx  = (this.x + this.width)  - sx;
        this.resizeGrabDy  = (this.y + this.height) - sy;
        return;
      }
      if (sx >= this.x && sx <= this.x + this.width &&
          sy >= this.y && sy <= this.y + this.height) {
        this.dragging    = true;
        this.dragOffsetX = sx - this.x;
        this.dragOffsetY = sy - this.y;
      }
    });

    view.addEventListener('pointermove', (e) => {
      if (!this.resizing && !this.dragging) return;
      const { x: sx, y: sy } = this._toScreenCoords(e.clientX, e.clientY);
      if (this.resizing) {
        const newW = (sx + this.resizeGrabDx) - this.resizeAnchorX;
        const newH = (sy + this.resizeGrabDy) - this.resizeAnchorY;
        this.width  = Math.max(this.minWidth,  Math.min(this.maxWidth,  newW));
        this.height = Math.max(this.minHeight, Math.min(this.maxHeight, newH));
        return;
      }
      const viewW = this.app.screen.width, viewH = this.app.screen.height;
      this.x = Math.max(0, Math.min(viewW  - this.width,  sx - this.dragOffsetX));
      this.y = Math.max(0, Math.min(viewH - this.height, sy - this.dragOffsetY));
    });

    window.addEventListener('pointerup', () => {
      this.dragging = false;
      this.resizing = false;
    });
  }

  /** 实体世界包围盒四角投影到当前屏幕像素空间后的 AABB。 */
  _projectBoundsAABB(b) {
    const corners = [
      this._toRenderScreen(b.x,           b.y),
      this._toRenderScreen(b.x + b.width, b.y),
      this._toRenderScreen(b.x,           b.y + b.height),
      this._toRenderScreen(b.x + b.width, b.y + b.height),
    ];
    const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
    };
  }

  updateCapture(entities) {
    this.capturedEntities = [];
    const vf = { x: this.x, y: this.y, w: this.width, h: this.height };

    for (const e of entities) {
      const aabb = this._projectBoundsAABB(e.getBounds());
      const overlap = !(
        aabb.maxX < vf.x ||
        aabb.minX > vf.x + vf.w ||
        aabb.maxY < vf.y ||
        aabb.minY > vf.y + vf.h
      );
      if (overlap) this.capturedEntities.push(e);
    }
  }

  /**
   * 取景框本身是屏幕空间轴对齐矩形（浮在顶层，不再随相机 shear/pan/zoom）；
   * 命中实体的高亮描边仍需要把它们的世界包围盒投影到当前屏幕空间才能画对
   * 位置，用 `toRenderScreen` 四角投影出的四边形（可能因 shear 是平行四边形）。
   */
  draw(g) {
    const x = this.x, y = this.y, w = this.width, h = this.height;
    const cornerLen = 12;

    // outer frame
    g.lineStyle(2, 0xffffff, 0.88);
    g.drawRect(x, y, w, h);

    // corner marks（四角各画两条短线，替代原来投影平行四边形边上取一段的做法）
    g.lineStyle(3, 0xff4444, 1);
    const corners = [
      [x,     y,     1,  0], [x,     y,      0,  1],
      [x + w, y,    -1,  0], [x + w, y,      0,  1],
      [x,     y + h, 1,  0], [x,     y + h,  0, -1],
      [x + w, y + h,-1,  0], [x + w, y + h,  0, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      g.moveTo(cx, cy);
      g.lineTo(cx + dx * cornerLen, cy + dy * cornerLen);
    }

    // center cross
    const ccx = x + w / 2, ccy = y + h / 2;
    g.lineStyle(1, 0xffffff, 0.3);
    g.moveTo(ccx - 10, ccy); g.lineTo(ccx + 10, ccy);
    g.moveTo(ccx, ccy - 10); g.lineTo(ccx, ccy + 10);

    // capture indicator（贴着右上角）
    if (this.capturedEntities.length > 0) {
      g.beginFill(0xff4444, 0.85);
      g.drawCircle(x + w - 8, y + 8, 5);
      g.endFill();
    }

    this._drawResizeHandle(g, x + w, y + h);

    // 命中实体高亮描边：世界包围盒四角投影到当前屏幕空间
    if (this.capturedEntities.length > 0) {
      g.lineStyle(2, 0xffcc00, 0.7);
      for (const e of this.capturedEntities) {
        const b  = e.getBounds();
        const p0 = this._toRenderScreen(b.x,           b.y);
        const p1 = this._toRenderScreen(b.x + b.width, b.y);
        const p2 = this._toRenderScreen(b.x + b.width, b.y + b.height);
        const p3 = this._toRenderScreen(b.x,           b.y + b.height);
        g.drawPolygon([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]);
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

  getCapturedTags() {
    const tags = new Set();
    for (const e of this.capturedEntities) {
      const list = (typeof e.getTags === 'function') ? e.getTags() : (e.tags || []);
      for (const tag of list) tags.add(tag);
    }
    return Array.from(tags);
  }
}
