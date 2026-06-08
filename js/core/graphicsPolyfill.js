/**
 * graphicsPolyfill — Phaser 风格绘制 API → PIXI.Graphics 兼容层
 * 副作用 import，必须在所有绘制代码之前执行。
 * moveTo/lineTo/closePath 有原生实现；仅在 beginPath 模式下拦截缓冲，否则透传。
 */
/* global PIXI */
const P = PIXI.Graphics.prototype;
const _mv = P.moveTo, _lt = P.lineTo, _cp = P.closePath;

// ── fill 颜色缓存 ──────────────────────────────────────────────────────────────
if (!P.fillStyle)   P.fillStyle   = function(c, a = 1) { this._fc = c; this._fa = a; return this; };

// ── 矩形 ──────────────────────────────────────────────────────────────────────
if (!P.fillRect)    P.fillRect    = function(x, y, w, h) { this.beginFill(this._fc ?? 0, this._fa ?? 1); this.drawRect(x, y, w, h); return this.endFill(); };
if (!P.strokeRect)  P.strokeRect  = function(x, y, w, h) { this.beginFill(0, 0); this.drawRect(x, y, w, h); return this.endFill(); };

// ── 圆 / 椭圆（Phaser fillEllipse 传全宽全高；PIXI drawEllipse 传半轴）─────────
if (!P.fillCircle)  P.fillCircle  = function(x, y, r)       { this.beginFill(this._fc ?? 0, this._fa ?? 1); this.drawCircle(x, y, r); return this.endFill(); };
if (!P.fillEllipse) P.fillEllipse = function(cx, cy, w, h)  { this.beginFill(this._fc ?? 0, this._fa ?? 1); this.drawEllipse(cx, cy, w / 2, h / 2); return this.endFill(); };

// ── 直线 ──────────────────────────────────────────────────────────────────────
if (!P.lineBetween) P.lineBetween = function(x1, y1, x2, y2) { _mv.call(this, x1, y1); _lt.call(this, x2, y2); return this; };

// ── 路径 API ──────────────────────────────────────────────────────────────────
if (!P.beginPath) P.beginPath = function() { this._pp = []; this._pc = false; this._ip = true; return this; };

// moveTo / lineTo：路径模式下缓冲到 _pp（格式 [x,y,type, ...]，type 0=M 1=L）；否则透传原生
P.moveTo    = function(x, y) { if (this._ip) { this._pp.push(x, y, 0); return this; } return _mv.call(this, x, y); };
P.lineTo    = function(x, y) { if (this._ip) { this._pp.push(x, y, 1); return this; } return _lt.call(this, x, y); };
P.closePath = function()     { if (this._ip) { this._pc = true; return this; } return _cp ? _cp.call(this) : this; };

function _replay(g) {
  const p = g._pp;
  if (!p || p.length < 3) return;
  for (let i = 0; i < p.length; i += 3) (p[i + 2] === 0 ? _mv : _lt).call(g, p[i], p[i + 1]);
  if (g._pc && _cp) _cp.call(g);
}

if (!P.fillPath)   P.fillPath   = function() { this.beginFill(this._fc ?? 0, this._fa ?? 1); _replay(this); this.endFill(); this._ip = false; return this; };
if (!P.strokePath) P.strokePath = function() { this.beginFill(0, 0); _replay(this); this.endFill(); this._ip = false; return this; };
