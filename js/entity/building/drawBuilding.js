/**
 * drawBuilding — 统一线稿风格
 *
 * 填充只用 Layout.FILL_PAPER / FILL_LIGHT / FILL_MID / FILL_SHADE 四档。
 * 线条用 lenv() 封装 depthLineWidth + depthLineColor(ENV_LINE_*)，
 * 保证环境线整体比 NPC 浅一级。
 */

import {
  FILL_PAPER, FILL_LIGHT, FILL_MID, FILL_SHADE,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function rand(x, salt = 0) {
  const s = Math.sin(x * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// 设置环境线 lineStyle；返回线色（lc）供后续 stroke 调用复用
function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

// ── 屋顶细节 ──────────────────────────────────────────────────────────────────

function _roofAC(g, x, top, w, d, baseY, n) {
  const lc = lenv(g, baseY, 0.5);
  for (let i = 0; i < n; i++) {
    const ax = x + 5 + rand(x, 10 + i) * (w - 14);
    const ay = top + 3 + rand(x, 20 + i) * Math.max(2, d - 10);
    const aw = 4 + Math.round(rand(x, 30 + i) * 5);
    const ah = 3 + Math.round(rand(x, 40 + i) * 2);
    g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(ax, ay, aw, ah); g.endFill();
    g.lineStyle(0.5, lc, 0.9); g.drawRect(ax, ay, aw, ah);
  }
}

function _roofWaterTower(g, x, top, w, baseY) {
  const lc = lenv(g, baseY, 0.6);
  const wx = x + w * 0.28, sz = 7, wy = top - 5;
  g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(wx - sz, wy, sz * 2, sz); g.endFill();
  g.lineStyle(0.6, lc, 1);
  g.drawRect(wx - sz, wy, sz * 2, sz);
  g.moveTo(wx - sz + 2, wy + sz); g.lineTo(wx - sz + 2, top);
  g.moveTo(wx + sz - 2, wy + sz); g.lineTo(wx + sz - 2, top);
  g.moveTo(wx - sz - 1, wy); g.lineTo(wx, wy - 4); g.lineTo(wx + sz + 1, wy);
}

function _roofBillboard(g, x, top, w, baseY) {
  const lc = lenv(g, baseY, 0.6);
  const bw = Math.min(38, w * 0.45), bx = x + (w - bw) / 2, by = top - 12;
  g.lineStyle(0.55, lc, 1);
  g.moveTo(bx + 4, top); g.lineTo(bx + 4, by + 2);
  g.moveTo(bx + bw - 4, top); g.lineTo(bx + bw - 4, by + 2);
  g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(bx, by, bw, 10); g.endFill();
  g.lineStyle(0.5, lc, 1); g.drawRect(bx, by, bw, 10);
  g.lineStyle(0.35, lc, 0.55);
  g.moveTo(bx + 3, by + 3); g.lineTo(bx + bw - 3, by + 3);
  g.moveTo(bx + 3, by + 6); g.lineTo(bx + bw - 8, by + 6);
}

function _roofSolar(g, x, top, w, baseY) {
  const lc = lenv(g, baseY, 0.5);
  for (let i = 0; i < 2; i++) {
    const sx = x + w * 0.42 - 13 + i * 14, sy = top + 3;
    g.lineStyle(0); g.beginFill(FILL_SHADE, 0.9); g.drawRect(sx, sy, 12, 6); g.endFill();
    g.lineStyle(0.4, lc, 0.7);
    g.moveTo(sx + 4, sy); g.lineTo(sx + 4, sy + 6);
    g.moveTo(sx + 8, sy); g.lineTo(sx + 8, sy + 6);
    g.moveTo(sx, sy + 3); g.lineTo(sx + 12, sy + 3);
    g.lineStyle(0.5, lc, 1); g.drawRect(sx, sy, 12, 6);
  }
}

// ── 上层窗 ────────────────────────────────────────────────────────────────────

// 标准居民 / 混合楼型：大窗网格，FILL_LIGHT 填充
function _windows(g, x, y0, w, resH, floorH, baseY) {
  if (resH < 8) return;
  const lc  = lenv(g, baseY, 0.55);
  const n   = Math.max(1, Math.round(resH / floorH));
  const fh  = resH / n;
  const cW  = 18, cGap = 10;
  const nC  = Math.max(1, Math.floor((w - 16) / (cW + cGap)));
  const sx  = x + (w - (nC * (cW + cGap) - cGap)) / 2;
  const wh  = Math.max(4, fh * 0.56);
  const wy0 = (fh - wh) / 2;
  for (let f = 0; f < n; f++) {
    const fy = y0 + f * fh;
    g.lineStyle(0.35, lc, 0.22); g.moveTo(x + 2, fy); g.lineTo(x + w - 2, fy);
    for (let c = 0; c < nC; c++) {
      const wx = sx + c * (cW + cGap), wy = fy + wy0;
      g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(wx, wy, cW, wh); g.endFill();
      g.lineStyle(0.5, lc, 0.9); g.drawRect(wx, wy, cW, wh);
      // 单条横向分隔线
      g.lineStyle(0.3, lc, 0.4);
      g.moveTo(wx + 1, wy + wh * 0.5); g.lineTo(wx + cW - 1, wy + wh * 0.5);
    }
  }
}

// 玻璃幕墙：全宽横带，竖向分格
function _windowsGlass(g, x, y0, w, resH, floorH, baseY) {
  if (resH < 4) return;
  const lc = lenv(g, baseY, 0.5);
  const n  = Math.max(2, Math.round(resH / floorH));
  const fh = resH / n;
  for (let f = 0; f < n; f++) {
    const fy = y0 + f * fh + 2, bh = Math.max(3, fh - 4);
    g.lineStyle(0); g.beginFill(FILL_LIGHT, 0.9); g.drawRect(x + 3, fy, w - 6, bh); g.endFill();
    g.lineStyle(0.5, lc, 0.75); g.drawRect(x + 3, fy, w - 6, bh);
    const segs = Math.max(2, Math.floor((w - 6) / 14));
    g.lineStyle(0.35, lc, 0.38);
    for (let i = 1; i < segs; i++) {
      const lx = x + 3 + (w - 6) * i / segs;
      g.moveTo(lx, fy); g.lineTo(lx, fy + bh);
    }
  }
}

// 百叶 / 老旧楼型：较小窗，FILL_MID 填充 + 细百叶线
function _windowsGrille(g, x, y0, w, resH, floorH, baseY) {
  if (resH < 8) return;
  const lc  = lenv(g, baseY, 0.55);
  const n   = Math.max(1, Math.round(resH / floorH));
  const fh  = resH / n;
  const cW  = 14, cGap = 8;
  const nC  = Math.max(1, Math.floor((w - 12) / (cW + cGap)));
  const sx  = x + (w - (nC * (cW + cGap) - cGap)) / 2;
  const wh  = Math.max(4, fh * 0.52);
  const wy0 = (fh - wh) / 2;
  for (let f = 0; f < n; f++) {
    const fy = y0 + f * fh;
    g.lineStyle(0.35, lc, 0.2); g.moveTo(x + 2, fy); g.lineTo(x + w - 2, fy);
    for (let c = 0; c < nC; c++) {
      const wx = sx + c * (cW + cGap), wy = fy + wy0;
      g.lineStyle(0); g.beginFill(FILL_MID, 1); g.drawRect(wx, wy, cW, wh); g.endFill();
      g.lineStyle(0.5, lc, 0.9); g.drawRect(wx, wy, cW, wh);
      g.lineStyle(0.3, lc, 0.38);
      for (let gx = wx + 3; gx < wx + cW - 2; gx += 3.5) {
        g.moveTo(gx, wy + 1); g.lineTo(gx, wy + wh - 1);
      }
    }
  }
}

// ── 底层店面 ──────────────────────────────────────────────────────────────────
// 一个大橱窗 + 一扇门，留白充足，细节克制

function _ground(g, x, gy, w, gh, style, baseY) {
  const lc = lenv(g, baseY, 0.65);

  // 门楣/招牌横条
  const sH = 5;
  g.lineStyle(0); g.beginFill(FILL_MID, 1); g.drawRect(x + 2, gy, w - 4, sH); g.endFill();
  g.lineStyle(0.5, lc, 0.85); g.drawRect(x + 2, gy, w - 4, sH);

  const glY = gy + sH + 1, glH = gh - sH - 2;
  if (glH < 4) return;

  const dW = Math.max(8, Math.min(12, Math.round(w * 0.2)));
  const dX = x + w - 4 - dW;

  // 橱窗
  const winW = dX - x - 5;
  if (winW > 4) {
    g.lineStyle(0);
    g.beginFill(FILL_LIGHT, style === 'glass' ? 0.9 : 0.75);
    g.drawRect(x + 3, glY, winW, glH);
    g.endFill();
    g.lineStyle(0.55, lc, 0.9);
    g.drawRect(x + 3, glY, winW, glH);
  }

  // 门扇
  g.lineStyle(0); g.beginFill(FILL_MID, 1); g.drawRect(dX, glY, dW, glH); g.endFill();
  g.lineStyle(0.5, lc, 0.95); g.drawRect(dX, glY, dW, glH);
  // 门把手点
  g.lineStyle(0); g.beginFill(FILL_SHADE, 1); g.drawCircle(dX + 3, glY + glH * 0.52, 1.2); g.endFill();
}

// ── 立面 ──────────────────────────────────────────────────────────────────────

function _facade(g, x, w, building, baseY) {
  const { facadeH: H, y, A } = building;
  const fill = A.style === 'grille' ? FILL_LIGHT : FILL_PAPER;

  // 立面底色
  g.lineStyle(0);
  g.beginFill(fill, 1);
  g.drawRect(x, y, w, H);
  g.endFill();
  // 左侧竖向阴影收边
  g.beginFill(0x000000, 0.07);
  g.drawRect(x, y, 3, H);
  g.endFill();

  const groundH = Math.min(A.groundMax, Math.round(H * A.groundFrac));
  const resH    = H - groundH;

  if (A.style === 'glass')        _windowsGlass(g, x, y, w, resH, A.floorH, baseY);
  else if (A.style === 'grille')  _windowsGrille(g, x, y, w, resH, A.floorH, baseY);
  else                            _windows(g, x, y, w, resH, A.floorH, baseY);

  _ground(g, x, y + resH, w, groundH, A.style, baseY);

  // 立面轮廓（最后画，压在所有细节上）
  lenv(g, baseY, 0.85);
  g.drawRect(x, y, w, H);
}

// ── 主出口 ────────────────────────────────────────────────────────────────────

export function drawBuilding(g, building) {
  const { x, bWidth: w, bDepth: d } = building;
  const baseY = building.y + building.facadeH;
  const top   = building.y - d;

  // 屋顶板
  g.lineStyle(0); g.beginFill(FILL_MID, 1); g.drawRect(x, top, w, d); g.endFill();
  lenv(g, baseY, 0.65); g.drawRect(x, top, w, d);

  // 屋顶细节
  const acN = 1 + Math.floor(rand(x, 9) * 3);
  _roofAC(g, x, top, w, d, baseY, acN);
  if (building.waterTower) _roofWaterTower(g, x, top, w, baseY);
  if (building.solar)      _roofSolar(g, x, top, w, baseY);
  if (building.billboard)  _roofBillboard(g, x, top, w, baseY);

  // 立面
  _facade(g, x, w, building, baseY);

  // 楼间小巷阴影
  if (building.alleyLeft) {
    g.lineStyle(0);
    g.beginFill(0x000000, 0.14);
    g.drawRect(x - 1, top, 6, baseY - top + 1);
    g.endFill();
  }
}
