/**
 * PhaserGraphicsAdapter — 在 PIXI.Graphics 之上模拟 Phaser.GameObjects.Graphics 的绘图 API。
 *
 * 目的：渲染底层从 Phaser 换到 PixiJS，但所有绘图文件（StickRenderer / PropDrawer /
 * SceneRenderer / BuildingEntity / NPC / VehicleEntity / Viewfinder ...）零改动。
 *
 * 语义差异处理：
 *   - Phaser 是「有状态」模型：fillStyle()/lineStyle() 设定当前样式，后续 fillRect/
 *     strokeRect/lineBetween/fillPath/strokePath 各自取用。本适配器缓存当前样式，
 *     在每个图元绘制时翻译成 PIXI 的 beginFill/endFill + lineStyle。
 *   - fill* 图元只填充不描边（每次绘制前 lineStyle(0)）；stroke* 只描边不填充。
 *   - Phaser fillEllipse/strokeEllipse 参数是 (cx, cy, 全宽, 全高)，PIXI drawEllipse
 *     用半轴，故宽高除以 2。
 *   - 路径（beginPath/moveTo/lineTo/closePath/fillPath/strokePath）自行缓存顶点，
 *     在 fillPath/strokePath 时一次性下发到 PIXI。
 *
 * 所有方法返回 this，兼容 Phaser 的链式调用。
 */
export class PhaserGraphicsAdapter {
  /** @param {PIXI.Graphics} graphics */
  constructor(graphics) {
    this.g = graphics;

    this._fillColor = 0x000000;
    this._fillAlpha = 1;
    this._lineWidth = 1;
    this._lineColor = 0x000000;
    this._lineAlpha = 1;

    this._pathPts = [];      // 当前路径顶点 [{x,y}, ...]，[0] 为 moveTo 起点
    this._pathClosed = false;
  }

  clear() {
    this.g.clear();
    this._pathPts = [];
    this._pathClosed = false;
    return this;
  }

  // ─── 样式状态 ──────────────────────────────────────────────────────────────
  lineStyle(width = 1, color = 0x000000, alpha = 1) {
    this._lineWidth = width;
    this._lineColor = color;
    this._lineAlpha = alpha;
    return this;
  }

  fillStyle(color = 0x000000, alpha = 1) {
    this._fillColor = color;
    this._fillAlpha = alpha;
    return this;
  }

  // ─── 矩形 ──────────────────────────────────────────────────────────────────
  fillRect(x, y, w, h) {
    const g = this.g;
    g.lineStyle(0);
    g.beginFill(this._fillColor, this._fillAlpha);
    g.drawRect(x, y, w, h);
    g.endFill();
    return this;
  }

  strokeRect(x, y, w, h) {
    const g = this.g;
    g.lineStyle(this._lineWidth, this._lineColor, this._lineAlpha);
    g.drawRect(x, y, w, h);
    g.lineStyle(0);
    return this;
  }

  // ─── 直线 ──────────────────────────────────────────────────────────────────
  lineBetween(x1, y1, x2, y2) {
    const g = this.g;
    g.lineStyle(this._lineWidth, this._lineColor, this._lineAlpha);
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.lineStyle(0);
    return this;
  }

  // ─── 圆 ────────────────────────────────────────────────────────────────────
  fillCircle(x, y, r) {
    const g = this.g;
    g.lineStyle(0);
    g.beginFill(this._fillColor, this._fillAlpha);
    g.drawCircle(x, y, r);
    g.endFill();
    return this;
  }

  strokeCircle(x, y, r) {
    const g = this.g;
    g.lineStyle(this._lineWidth, this._lineColor, this._lineAlpha);
    g.drawCircle(x, y, r);
    g.lineStyle(0);
    return this;
  }

  // ─── 椭圆（Phaser 全宽高 → PIXI 半轴）──────────────────────────────────────
  fillEllipse(cx, cy, w, h) {
    const g = this.g;
    g.lineStyle(0);
    g.beginFill(this._fillColor, this._fillAlpha);
    g.drawEllipse(cx, cy, w / 2, h / 2);
    g.endFill();
    return this;
  }

  strokeEllipse(cx, cy, w, h) {
    const g = this.g;
    g.lineStyle(this._lineWidth, this._lineColor, this._lineAlpha);
    g.drawEllipse(cx, cy, w / 2, h / 2);
    g.lineStyle(0);
    return this;
  }

  // ─── 路径 ──────────────────────────────────────────────────────────────────
  beginPath() {
    this._pathPts = [];
    this._pathClosed = false;
    return this;
  }

  moveTo(x, y) {
    this._pathPts = [{ x, y }];
    this._pathClosed = false;
    return this;
  }

  lineTo(x, y) {
    this._pathPts.push({ x, y });
    return this;
  }

  closePath() {
    this._pathClosed = true;
    return this;
  }

  fillPath() {
    const pts = this._pathPts;
    if (pts.length < 2) return this;
    const g = this.g;
    g.lineStyle(0);
    g.beginFill(this._fillColor, this._fillAlpha);
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.endFill();
    return this;
  }

  strokePath() {
    const pts = this._pathPts;
    if (pts.length < 2) return this;
    const g = this.g;
    g.lineStyle(this._lineWidth, this._lineColor, this._lineAlpha);
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    if (this._pathClosed) g.closePath();
    g.lineStyle(0);
    return this;
  }
}
