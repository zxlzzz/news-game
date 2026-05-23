'use strict';

// ─── World constants ──────────────────────────────────────────────────────────
const WORLD_W = 2000, WORLD_H = 500;
const FAR_Y = 252, NEAR_Y = 458, BUILD_Y = 130;
const TREE_FAR_XS  = [75, 238, 405, 572, 740, 908, 1076, 1244, 1412, 1580, 1748, 1916];
const TREE_NEAR_XS = [140, 340, 540, 740, 940, 1140, 1340, 1540, 1740, 1940];

// ─── Color utilities ──────────────────────────────────────────────────────────
function rgba(hex, a = 1) {
  if (typeof hex === 'string') hex = parseInt(hex.replace('#', ''), 16);
  const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}
function fromHex(s) {
  return parseInt(String(s).replace('#', ''), 16);
}

// ─── Canvas 2D drawing helpers (Phaser Graphics equivalent) ──────────────────
const ctx_ = {
  fillRect(ctx, x, y, w, h, color, a = 1) {
    ctx.fillStyle = rgba(color, a); ctx.fillRect(x, y, w, h);
  },
  strokeRect(ctx, x, y, w, h, lw, color, a = 1) {
    ctx.strokeStyle = rgba(color, a); ctx.lineWidth = lw;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  },
  line(ctx, x1, y1, x2, y2, lw, color, a = 1) {
    ctx.beginPath(); ctx.strokeStyle = rgba(color, a); ctx.lineWidth = lw;
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  },
  fillCircle(ctx, x, y, r, color, a = 1) {
    ctx.beginPath(); ctx.fillStyle = rgba(color, a);
    ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  },
  strokeCircle(ctx, x, y, r, lw, color, a = 1) {
    ctx.beginPath(); ctx.strokeStyle = rgba(color, a); ctx.lineWidth = lw;
    ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  },
  fillEllipse(ctx, cx, cy, ew, eh, color, a = 1) {
    ctx.beginPath(); ctx.fillStyle = rgba(color, a);
    ctx.ellipse(cx, cy, ew / 2, eh / 2, 0, 0, Math.PI * 2); ctx.fill();
  },
};

// ─── Ground rendering (mirrors StreetScene._drawGround) ──────────────────────
function drawGround(ctx) {
  ctx_.fillRect(ctx, 0, 0, WORLD_W, BUILD_Y, 0xc8c3bc);
  ctx_.fillRect(ctx, 0, BUILD_Y, WORLD_W, FAR_Y - BUILD_Y, 0xd0cbc2);
  ctx_.fillRect(ctx, 0, FAR_Y, WORLD_W, NEAR_Y - FAR_Y, 0x797573);
  ctx_.fillRect(ctx, 0, NEAR_Y, WORLD_W, WORLD_H - NEAR_Y, 0xd4cfc6);
  drawRoadMarkings(ctx);
  drawPavement(ctx, BUILD_Y, FAR_Y, 48, 3);
  drawPavement(ctx, NEAR_Y + 4, WORLD_H, 52, 2);
  drawTrees(ctx);
}

function drawRoadMarkings(ctx) {
  let lineY = NEAR_Y - 10, spacing = 30;
  while (lineY > FAR_Y + 5 && spacing > 2.8) {
    ctx_.line(ctx, 0, Math.round(lineY), WORLD_W, Math.round(lineY), 1, 0x626060, 0.22);
    spacing *= 0.80; lineY -= spacing;
  }
  ctx_.fillRect(ctx, 0, FAR_Y - 4, WORLD_W, 5, 0xe2ddd4);
  ctx_.fillRect(ctx, 0, NEAR_Y,    WORLD_W, 5, 0xe8e3da);
  ctx_.line(ctx, 0, FAR_Y + 9,  WORLD_W, FAR_Y + 9,  3, 0xffffff, 0.45);
  ctx_.line(ctx, 0, NEAR_Y - 9, WORLD_W, NEAR_Y - 9, 3, 0xffffff, 0.45);
  const midY = Math.round((FAR_Y + NEAR_Y) / 2);
  for (let x = 0; x < WORLD_W; x += 68) {
    ctx_.line(ctx, x, midY - 2, x + 36, midY - 2, 2, 0xc8b040, 0.75);
    ctx_.line(ctx, x, midY + 2, x + 36, midY + 2, 2, 0xc8b040, 0.75);
  }
  for (let cx = 220; cx < WORLD_W; cx += 380) drawCrosswalk(ctx, cx);
}

function drawCrosswalk(ctx, cx) {
  const roadTop = FAR_Y + 10, roadBot = NEAR_Y - 10;
  ctx.fillStyle = rgba(0xffffff, 0.50);
  for (let i = 0; i < 8; i++) {
    const fx = cx + i * 20, nx = cx + i * 29;
    ctx.beginPath();
    ctx.moveTo(fx, roadTop); ctx.lineTo(fx + 8, roadTop);
    ctx.lineTo(nx + 13, roadBot); ctx.lineTo(nx, roadBot);
    ctx.closePath(); ctx.fill();
  }
}

function drawPavement(ctx, topY, botY, colStep, rows) {
  ctx.strokeStyle = rgba(0xb5b0a6, 0.28); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < WORLD_W; x += colStep) { ctx.moveTo(x, topY); ctx.lineTo(x, botY); }
  for (let r = 1; r < rows; r++) {
    const ly = topY + (botY - topY) * r / rows;
    ctx.moveTo(0, ly); ctx.lineTo(WORLD_W, ly);
  }
  ctx.stroke();
}

function drawTrees(ctx) {
  for (const tx of TREE_FAR_XS) {
    const ty = 168 + Math.sin(tx * 0.031) * 9;
    const r  = 14  + Math.sin(tx * 0.071) * 3;
    ctx_.fillEllipse(ctx, tx + 5, ty + 7, r * 2.6, r * 1.5, 0x000000, 0.16);
    ctx_.fillCircle(ctx, tx, ty, r, 0x4e7430);
    ctx_.fillCircle(ctx, tx - 4, ty - 4, r * 0.44, 0x72a848, 0.52);
  }
  for (const tx of TREE_NEAR_XS) {
    const ty = 480, r = 17 + Math.sin(tx * 0.053) * 4;
    ctx_.fillEllipse(ctx, tx + 6, ty + 8, r * 2.9, r * 1.6, 0x000000, 0.13);
    ctx_.fillCircle(ctx, tx, ty, r, 0x436228);
    ctx_.fillCircle(ctx, tx - 5, ty - 5, r * 0.42, 0x628840, 0.48);
  }
}

// ─── Building rendering ───────────────────────────────────────────────────────
function drawBuilding(ctx, b, selected, hovered) {
  const { x, bWidth: w, bDepth: d, color } = b;
  const top = BUILD_Y - d;
  const col = fromHex(color);
  ctx_.fillRect(ctx, x, top, w, d, col);
  ctx_.fillRect(ctx, x, top, w, Math.floor(d * 0.38), 0xffffff, 0.07);
  ctx_.fillRect(ctx, x, top + d * 0.62, w, d * 0.38, 0x000000, 0.13);
  ctx_.strokeRect(ctx, x, top, w, d, 1.5, 0x5c5850);
  ctx_.line(ctx, x + w / 2, top, x + w / 2, BUILD_Y, 1, 0x706860, 0.45);
  ctx_.line(ctx, x, BUILD_Y, x + w, BUILD_Y, 3, 0x403830, 0.55);
  if (b.waterTower) drawWaterTower(ctx, x, w, top, d);
  if (selected) {
    ctx.strokeStyle = rgba(0xff4400, 0.9); ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]); ctx.strokeRect(x + 1, top + 1, w - 2, d - 2); ctx.setLineDash([]);
  } else if (hovered) {
    ctx.strokeStyle = rgba(0xffcc00, 0.65); ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]); ctx.strokeRect(x + 1, top + 1, w - 2, d - 2); ctx.setLineDash([]);
  }
}

function drawWaterTower(ctx, bx, bw, roofTop, d) {
  const wx = bx + bw * 0.38, wy = roofTop + d * 0.35;
  ctx_.fillCircle(ctx, wx, wy, 10, 0x706858);
  ctx_.strokeCircle(ctx, wx, wy, 10, 1.5, 0x504840);
  ctx_.fillCircle(ctx, wx, wy, 5, 0x907858, 0.65);
  ctx_.line(ctx, wx - 6, wy + 8, wx - 6, wy + 14, 1.5, 0x605048, 0.8);
  ctx_.line(ctx, wx + 6, wy + 8, wx + 6, wy + 14, 1.5, 0x605048, 0.8);
}

function drawBuildingHandles(ctx, b) {
  const { x, bWidth: w, bDepth: d } = b;
  const top = BUILD_Y - d;
  const HS = 8;
  const handles = [
    { x: x,         y: top + d / 2, cursor: 'ew' },   // left edge
    { x: x + w,     y: top + d / 2, cursor: 'ew' },   // right edge
    { x: x + w / 2, y: top,         cursor: 'ns' },   // top edge (depth)
  ];
  for (const h of handles) {
    ctx.fillStyle = rgba(0xff6020, 1);
    ctx.fillRect(h.x - HS / 2, h.y - HS / 2, HS, HS);
    ctx.strokeStyle = rgba(0xffffff, 0.75); ctx.lineWidth = 1;
    ctx.strokeRect(h.x - HS / 2 + 0.5, h.y - HS / 2 + 0.5, HS, HS);
  }
}

// ─── Prop rendering ───────────────────────────────────────────────────────────
function drawProp(ctx, p, selected, hovered) {
  const { x, y, propType } = p;
  switch (propType) {
    case 'lamp-far':  drawLampFar(ctx, x, y);  break;
    case 'lamp-near': drawLampNear(ctx, x, y); break;
    case 'bench':     drawBench(ctx, x, y, p.width ?? 32); break;
    case 'trash':     drawTrash(ctx, x, y);    break;
    case 'sign':      drawSign(ctx, x, y, p.width ?? 24, p.color ?? '#888888'); break;
  }
  if (selected || hovered) {
    ctx.strokeStyle = selected ? rgba(0xff4400, 0.9) : rgba(0xffcc00, 0.65);
    ctx.lineWidth = selected ? 1.5 : 1;
    ctx.setLineDash(selected ? [4, 3] : [3, 2]);
    ctx.strokeRect(x - 14, y - 22, 28, 26); ctx.setLineDash([]);
  }
}

function drawLampFar(ctx, x, y) {
  ctx_.line(ctx, x, y + 14, x, y - 6,  2.5, 0x8a8880, 0.92);
  ctx_.line(ctx, x, y - 6,  x + 16, y + 8, 2, 0x8c8a84, 0.85);
  ctx_.fillCircle(ctx, x + 16, y + 8, 5,   0xdcd090, 0.95);
  ctx_.fillCircle(ctx, x + 16, y + 8, 2.5, 0xfffff8, 0.45);
}

function drawLampNear(ctx, x, y) {
  ctx_.line(ctx, x, y - 12, x, y + 8,      2.5, 0x8a8880, 0.92);
  ctx_.line(ctx, x, y - 12, x - 16, y - 5, 2,   0x8c8a84, 0.85);
  ctx_.fillCircle(ctx, x - 16, y - 5, 5,   0xdcd090, 0.95);
  ctx_.fillCircle(ctx, x - 16, y - 5, 2.5, 0xfffff8, 0.45);
}

function drawBench(ctx, x, y, bw) {
  const bh = 11, bx = x - bw / 2, by = y - bh;
  ctx_.fillRect(ctx, bx, by,     bw, bh, 0xb09868, 0.88);
  ctx_.fillRect(ctx, bx, by - 4, bw, 4,  0x907848, 0.75);
  ctx_.strokeRect(ctx, bx, by, bw, bh, 1, 0x7a6040, 0.8);
  ctx_.fillRect(ctx, bx + 4,      by + bh, 3, 4, 0x605030, 0.55);
  ctx_.fillRect(ctx, bx + bw - 7, by + bh, 3, 4, 0x605030, 0.55);
}

function drawTrash(ctx, x, y) {
  const r = 6;
  ctx_.fillEllipse(ctx, x + 3, y - r + 5, r * 2.5, r * 1.4, 0x444444, 0.2);
  ctx_.fillCircle(ctx, x, y - r, r,   0x607060, 0.92);
  ctx_.strokeCircle(ctx, x, y - r, r, 1.5, 0x405040, 0.9);
  ctx_.fillCircle(ctx, x, y - r, 2.5, 0x304030, 0.7);
}

function drawSign(ctx, x, y, sw, colorStr) {
  const sh = 14, sx = x - sw / 2, sy = y - sh;
  ctx_.fillRect(ctx, sx, sy, sw, sh, fromHex(colorStr), 0.92);
  ctx_.fillRect(ctx, sx, sy, sw, Math.floor(sh * 0.4), 0xffffff, 0.14);
  ctx_.strokeRect(ctx, sx, sy, sw, sh, 1.5, 0x000000, 0.42);
}

// ─── Default scene (matches StreetScene.js hardcoded data) ───────────────────
function defaultScene() {
  const buildings = [
    { x: 15,   bWidth: 115, bDepth: 80, color: '#9e9590', waterTower: false, tags: ['office', 'building'] },
    { x: 152,  bWidth: 88,  bDepth: 62, color: '#8a9098', waterTower: false, tags: ['shop', 'retail', 'building'] },
    { x: 263,  bWidth: 148, bDepth: 87, color: '#a08878', waterTower: true,  tags: ['bank', 'finance', 'building'] },
    { x: 430,  bWidth: 82,  bDepth: 58, color: '#909898', waterTower: false, tags: ['shop', 'retail', 'building'] },
    { x: 534,  bWidth: 126, bDepth: 73, color: '#94887a', waterTower: false, tags: ['restaurant', 'food', 'building'] },
    { x: 684,  bWidth: 106, bDepth: 68, color: '#7e8898', waterTower: false, tags: ['office', 'building'] },
    { x: 813,  bWidth: 158, bDepth: 90, color: '#a09488', waterTower: true,  tags: ['hotel', 'building'] },
    { x: 992,  bWidth: 88,  bDepth: 60, color: '#8c9890', waterTower: false, tags: ['shop', 'retail', 'building'] },
    { x: 1102, bWidth: 134, bDepth: 78, color: '#988a7e', waterTower: false, tags: ['bank', 'finance', 'building'] },
    { x: 1258, bWidth: 80,  bDepth: 56, color: '#8898a0', waterTower: false, tags: ['apartment', 'residential', 'building'] },
    { x: 1362, bWidth: 118, bDepth: 70, color: '#9a9080', waterTower: false, tags: ['office', 'building'] },
    { x: 1505, bWidth: 148, bDepth: 84, color: '#7e8898', waterTower: true,  tags: ['hotel', 'building'] },
    { x: 1678, bWidth: 92,  bDepth: 64, color: '#988890', waterTower: false, tags: ['restaurant', 'food', 'building'] },
    { x: 1798, bWidth: 126, bDepth: 74, color: '#a09488', waterTower: false, tags: ['shop', 'retail', 'building'] },
  ];
  const props = [];
  for (let x = 95;  x < 2000; x += 155) props.push({ propType: 'lamp-far',  x, y: FAR_Y,  width: 14, height: 14, tags: ['lamp', 'street-furniture'] });
  for (let x = 172; x < 2000; x += 155) props.push({ propType: 'lamp-near', x, y: NEAR_Y, width: 14, height: 14, tags: ['lamp', 'street-furniture'] });
  for (let x = 135; x < 2000; x += 290) props.push({ propType: 'bench', x, y: 216, width: 32, height: 12, tags: ['bench', 'street-furniture'] });
  for (let x = 300; x < 2000; x += 450) props.push({ propType: 'trash', x, y: 230, width: 12, height: 12, tags: ['trash-can', 'street-furniture'] });
  for (let x = 210; x < 2000; x += 380) props.push({ propType: 'trash', x, y: 472, width: 12, height: 12, tags: ['trash-can', 'street-furniture'] });
  const signs = [
    { x: 72,   color: '#1a4488', tags: ['sign', 'office']   },
    { x: 196,  color: '#cc3322', tags: ['sign', 'retail']   },
    { x: 337,  color: '#886600', tags: ['sign', 'finance']  },
    { x: 471,  color: '#22aa55', tags: ['sign', 'retail']   },
    { x: 597,  color: '#cc6622', tags: ['sign', 'food']     },
    { x: 737,  color: '#336688', tags: ['sign', 'office']   },
    { x: 892,  color: '#7a3322', tags: ['sign', 'hotel']    },
    { x: 1036, color: '#aa2288', tags: ['sign', 'retail']   },
    { x: 1169, color: '#886600', tags: ['sign', 'finance']  },
    { x: 1421, color: '#225588', tags: ['sign', 'office']   },
    { x: 1579, color: '#7a3322', tags: ['sign', 'hotel']    },
    { x: 1724, color: '#cc6622', tags: ['sign', 'food']     },
    { x: 1861, color: '#cc3322', tags: ['sign', 'retail']   },
  ];
  for (const s of signs) props.push({ propType: 'sign', x: s.x, y: BUILD_Y + 1, width: 24, height: 14, color: s.color, tags: s.tags });
  return { buildings, props };
}

// ─── Scene Editor ─────────────────────────────────────────────────────────────
class SceneEditor {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.zoom   = 0.6;
    this.scene  = { buildings: [], props: [] };
    this.selected = null;  // { type: 'building'|'prop', index }
    this.hover    = null;
    this.drag     = null;  // active drag state
    this.history  = [];
    this.histIdx  = -1;

    this._loadScene();
    this._bindEvents();
    this._bindUI();
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  async _loadScene() {
    try {
      const r = await fetch('../../assets/scene.json');
      if (!r.ok) throw new Error('not found');
      this.scene = await r.json();
    } catch {
      this.scene = defaultScene();
    }
    this._pushHistory();
    this._resizeCanvas();
    this.render();
  }

  // ── History ─────────────────────────────────────────────────────────────────

  _pushHistory() {
    this.history = this.history.slice(0, this.histIdx + 1);
    this.history.push(JSON.stringify(this.scene));
    if (this.history.length > 60) this.history.shift();
    else this.histIdx++;
  }

  undo() {
    if (this.histIdx <= 0) return;
    this.histIdx--; this.scene = JSON.parse(this.history[this.histIdx]);
    this.selected = null; this._refresh();
  }

  redo() {
    if (this.histIdx >= this.history.length - 1) return;
    this.histIdx++; this.scene = JSON.parse(this.history[this.histIdx]);
    this.selected = null; this._refresh();
  }

  _refresh() { this.render(); this._updatePanel(); }

  // ── Canvas sizing ────────────────────────────────────────────────────────────

  _resizeCanvas() {
    this.canvas.width  = Math.round(WORLD_W * this.zoom);
    this.canvas.height = Math.round(WORLD_H * this.zoom);
  }

  setZoom(z) {
    this.zoom = Math.max(0.2, Math.min(2.5, Math.round(z * 10) / 10));
    document.getElementById('zoomLevel').textContent = Math.round(this.zoom * 100) + '%';
    this._resizeCanvas();
    this.render();
  }

  // ── Coordinate helpers ────────────────────────────────────────────────────────

  _canvasXY(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _toWorld(cx, cy) { return { x: cx / this.zoom, y: cy / this.zoom }; }

  // ── Hit testing ──────────────────────────────────────────────────────────────

  _buildingHandle(wx, wy, b) {
    const { x, bWidth: w, bDepth: d } = b;
    const top = BUILD_Y - d;
    const hs = 8 / this.zoom;
    if (Math.abs(wx - x)         < hs && Math.abs(wy - (top + d / 2)) < hs) return 'left';
    if (Math.abs(wx - (x + w))   < hs && Math.abs(wy - (top + d / 2)) < hs) return 'right';
    if (Math.abs(wx - (x + w/2)) < hs && Math.abs(wy - top)           < hs) return 'top';
    return null;
  }

  _hitTest(wx, wy) {
    // Selected building handles have priority
    if (this.selected?.type === 'building') {
      const b = this.scene.buildings[this.selected.index];
      const h = this._buildingHandle(wx, wy, b);
      if (h) return { type: 'handle', handle: h, index: this.selected.index };
    }
    // Buildings (reverse order for correct overlap)
    for (let i = this.scene.buildings.length - 1; i >= 0; i--) {
      const b = this.scene.buildings[i];
      if (wx >= b.x && wx <= b.x + b.bWidth && wy >= BUILD_Y - b.bDepth && wy <= BUILD_Y)
        return { type: 'building', index: i };
    }
    // Props (generous 16px hit radius)
    for (let i = this.scene.props.length - 1; i >= 0; i--) {
      const p = this.scene.props[i];
      if (Math.abs(wx - p.x) < 16 && Math.abs(wy - p.y) < 16)
        return { type: 'prop', index: i };
    }
    return null;
  }

  // ── Mouse events ─────────────────────────────────────────────────────────────

  _bindEvents() {
    this.canvas.addEventListener('mousedown', e => this._onDown(e));
    window.addEventListener('mousemove',  e => this._onMove(e));
    window.addEventListener('mouseup',    e => this._onUp(e));
    window.addEventListener('keydown',    e => this._onKey(e));
  }

  _onDown(e) {
    if (e.button !== 0) return;
    const { x: cx, y: cy } = this._canvasXY(e);
    const { x: wx, y: wy } = this._toWorld(cx, cy);
    const hit = this._hitTest(wx, wy);

    if (!hit) {
      this.selected = null; this._refresh(); return;
    }

    if (hit.type === 'handle') {
      const b = this.scene.buildings[hit.index];
      this.drag = { type: 'resize', handle: hit.handle, index: hit.index,
        wx0: wx, wy0: wy, ox: b.x, ow: b.bWidth, od: b.bDepth };
    } else if (hit.type === 'building') {
      this.selected = { type: 'building', index: hit.index };
      const b = this.scene.buildings[hit.index];
      this.drag = { type: 'move', elem: 'building', index: hit.index,
        wx0: wx, wy0: wy, ox: b.x };
    } else if (hit.type === 'prop') {
      this.selected = { type: 'prop', index: hit.index };
      const p = this.scene.props[hit.index];
      this.drag = { type: 'move', elem: 'prop', index: hit.index,
        wx0: wx, wy0: wy, ox: p.x, oy: p.y };
    }
    this._refresh();
  }

  _onMove(e) {
    const { x: cx, y: cy } = this._canvasXY(e);
    const { x: wx, y: wy } = this._toWorld(cx, cy);

    // Status bar coords
    document.getElementById('statusCoords').textContent =
      `X: ${Math.round(wx)}  Y: ${Math.round(wy)}`;

    if (this.drag) {
      const dx = wx - this.drag.wx0, dy = wy - this.drag.wy0;

      if (this.drag.type === 'resize') {
        const b = this.scene.buildings[this.drag.index];
        if (this.drag.handle === 'left') {
          const nx = Math.round(this.drag.ox + dx);
          const nw = Math.round(this.drag.ow - dx);
          if (nw >= 20) { b.x = nx; b.bWidth = nw; }
        } else if (this.drag.handle === 'right') {
          b.bWidth = Math.max(20, Math.round(this.drag.ow + dx));
        } else if (this.drag.handle === 'top') {
          b.bDepth = Math.max(20, Math.min(BUILD_Y - 10, Math.round(this.drag.od - dy)));
        }
      } else if (this.drag.elem === 'building') {
        const b = this.scene.buildings[this.drag.index];
        b.x = Math.round(this.drag.ox + dx);
      } else if (this.drag.elem === 'prop') {
        const p = this.scene.props[this.drag.index];
        p.x = Math.round(this.drag.ox + dx);
        p.y = Math.round(this.drag.oy + dy);
      }
      this.render();
      this._updatePanel();
    } else {
      // Hover
      const hit = this._hitTest(wx, wy);
      const newHov = (hit && hit.type !== 'handle') ? { type: hit.type, index: hit.index } : null;
      if (JSON.stringify(newHov) !== JSON.stringify(this.hover)) {
        this.hover = newHov; this.render();
      }
      // Cursor shape
      if (hit?.type === 'handle')
        this.canvas.style.cursor = hit.handle === 'top' ? 'n-resize' : 'ew-resize';
      else if (hit)
        this.canvas.style.cursor = 'move';
      else
        this.canvas.style.cursor = 'default';
    }
  }

  _onUp() {
    if (this.drag) { this._pushHistory(); this.drag = null; }
  }

  _onKey(e) {
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); this.undo(); }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); this.redo(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.matches('input,select,textarea'))
      this.deleteSelected();
    if (e.key === 'Escape') { this.selected = null; this._refresh(); }
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(this.zoom, this.zoom);

    drawGround(ctx);

    this.scene.buildings.forEach((b, i) => {
      const sel = this.selected?.type === 'building' && this.selected.index === i;
      const hov = this.hover?.type   === 'building' && this.hover.index   === i && !sel;
      drawBuilding(ctx, b, sel, hov);
    });

    if (this.selected?.type === 'building')
      drawBuildingHandles(ctx, this.scene.buildings[this.selected.index]);

    this.scene.props.forEach((p, i) => {
      const sel = this.selected?.type === 'prop' && this.selected.index === i;
      const hov = this.hover?.type   === 'prop' && this.hover.index   === i && !sel;
      drawProp(ctx, p, sel, hov);
    });

    ctx.restore();
  }

  // ── Properties panel ──────────────────────────────────────────────────────────

  _updatePanel() {
    const panel = document.getElementById('propsPanel');
    const noSel = document.getElementById('noSelection');
    if (!this.selected) { panel.innerHTML = ''; noSel.style.display = ''; return; }
    noSel.style.display = 'none';
    if (this.selected.type === 'building') {
      panel.innerHTML = this._buildingHTML(this.scene.buildings[this.selected.index], this.selected.index);
    } else {
      panel.innerHTML = this._propHTML(this.scene.props[this.selected.index], this.selected.index);
    }
  }

  _buildingHTML(b, i) {
    return `
      <div class="prop-group">
        <label>X 左边缘</label>
        <input type="number" value="${b.x}" onchange="app.editBuilding(${i},'x',+this.value)">
      </div>
      <div class="prop-group">
        <label>宽度 bWidth</label>
        <input type="number" value="${b.bWidth}" min="20"
          onchange="app.editBuilding(${i},'bWidth',+this.value)">
      </div>
      <div class="prop-group">
        <label>纵深 bDepth</label>
        <input type="number" value="${b.bDepth}" min="20" max="119"
          onchange="app.editBuilding(${i},'bDepth',+this.value)">
      </div>
      <div class="prop-group">
        <label>颜色</label>
        <input type="color" value="${b.color}" onchange="app.editBuilding(${i},'color',this.value)">
      </div>
      <div class="prop-group">
        <div class="check-row">
          <input type="checkbox" id="wt${i}" ${b.waterTower ? 'checked' : ''}
            onchange="app.editBuilding(${i},'waterTower',this.checked)">
          <label for="wt${i}" style="text-transform:none;letter-spacing:0">水塔</label>
        </div>
      </div>
      <div class="prop-group">
        <label>标签（逗号分隔）</label>
        <input type="text" value="${(b.tags||[]).join(', ')}"
          onchange="app.editBuilding(${i},'tags',this.value.split(',').map(t=>t.trim()).filter(Boolean))">
      </div>
      <button class="danger" onclick="app.deleteSelected()">删除建筑</button>`;
  }

  _propHTML(p, i) {
    const TYPES = ['lamp-far','lamp-near','bench','trash','sign'];
    const opts  = TYPES.map(t => `<option${t===p.propType?' selected':''}>${t}</option>`).join('');
    const colorField = p.propType === 'sign'
      ? `<div class="prop-group"><label>招牌颜色</label>
           <input type="color" value="${p.color||'#888888'}"
             onchange="app.editProp(${i},'color',this.value)"></div>`
      : '';
    return `
      <div class="prop-group">
        <label>类型</label>
        <select onchange="app.editProp(${i},'propType',this.value)">${opts}</select>
      </div>
      <div class="prop-group">
        <label>X</label>
        <input type="number" value="${p.x}" onchange="app.editProp(${i},'x',+this.value)">
      </div>
      <div class="prop-group">
        <label>Y</label>
        <input type="number" value="${p.y}" onchange="app.editProp(${i},'y',+this.value)">
      </div>
      ${colorField}
      <div class="prop-group">
        <label>标签（逗号分隔）</label>
        <input type="text" value="${(p.tags||[]).join(', ')}"
          onchange="app.editProp(${i},'tags',this.value.split(',').map(t=>t.trim()).filter(Boolean))">
      </div>
      <button class="danger" onclick="app.deleteSelected()">删除道具</button>`;
  }

  // ── Data mutation ─────────────────────────────────────────────────────────────

  editBuilding(i, key, val) {
    this.scene.buildings[i][key] = val;
    this._pushHistory(); this.render();
  }

  editProp(i, key, val) {
    this.scene.props[i][key] = val;
    this._pushHistory(); this.render();
    if (key === 'propType') this._updatePanel();
  }

  deleteSelected() {
    if (!this.selected) return;
    if (this.selected.type === 'building') this.scene.buildings.splice(this.selected.index, 1);
    else this.scene.props.splice(this.selected.index, 1);
    this.selected = null;
    this._pushHistory(); this._refresh();
  }

  addBuilding() {
    this.scene.buildings.push({
      x: 200, bWidth: 100, bDepth: 70, color: '#9a9080', waterTower: false, tags: ['building'],
    });
    this.selected = { type: 'building', index: this.scene.buildings.length - 1 };
    this._pushHistory(); this._refresh();
  }

  addProp(type) {
    const defs = {
      'lamp-far':  { x: 200, y: FAR_Y,      width: 14, height: 14, tags: ['lamp','street-furniture'] },
      'lamp-near': { x: 200, y: NEAR_Y,     width: 14, height: 14, tags: ['lamp','street-furniture'] },
      'bench':     { x: 200, y: 216,        width: 32, height: 12, tags: ['bench','street-furniture'] },
      'trash':     { x: 200, y: 230,        width: 12, height: 12, tags: ['trash-can','street-furniture'] },
      'sign':      { x: 200, y: BUILD_Y+1,  width: 24, height: 14, color: '#666666', tags: ['sign'] },
    };
    this.scene.props.push({ propType: type, ...defs[type] });
    this.selected = { type: 'prop', index: this.scene.props.length - 1 };
    this._pushHistory(); this._refresh();
  }

  // ── Import / Export ──────────────────────────────────────────────────────────

  exportScene() {
    const blob = new Blob([JSON.stringify(this.scene, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scene.json';
    a.click();
    URL.revokeObjectURL(a.href);
    document.getElementById('statusInfo').textContent = '已导出 scene.json — 替换 assets/scene.json 后刷新游戏';
    setTimeout(() => { document.getElementById('statusInfo').textContent = ''; }, 5000);
  }

  importScene() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = ev => {
        try {
          this.scene = JSON.parse(ev.target.result);
          this.selected = null;
          this._pushHistory(); this._refresh();
        } catch (err) { alert('JSON 格式错误: ' + err.message); }
      };
      r.readAsText(f);
    };
    input.click();
  }

  // ── UI bindings ───────────────────────────────────────────────────────────────

  _bindUI() {
    // All buttons call app.* directly via onclick in HTML
    document.getElementById('zoomLevel').textContent = Math.round(this.zoom * 100) + '%';
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────
const app = new SceneEditor();
