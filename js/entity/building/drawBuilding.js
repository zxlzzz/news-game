/**
 * drawBuilding — 统一线稿风格
 *
 * 填充只用 Layout.FILL_PAPER / FILL_LIGHT / FILL_MID / FILL_SHADE 四档。
 * 线条用 lenv() 封装 depthLineWidth + depthLineColor(ENV_LINE_*)，
 * 保证环境线整体比 NPC 浅一级。
 *
 * O-1：楼是唯一重报尺寸的实体——本文件内窗格/门/屋顶细节的位置与尺寸常量
 * 全部 × UNIT_REBASE_FACTOR(5.294118)，随 building.js INTRINSIC / ARCH 一起
 * 从旧世界像素改为骨架单位。裸的 g.lineStyle() 描边宽度字面量（如 0.5、0.35）
 * 不在此列——那些是装饰细线，容器整体乘 PX_PER_UNIT 后会变细但不消失，
 * 留给 O-3/O-4 盒子模板化时一并处理。
 */

import {
  FILL_PAPER, FILL_LIGHT, FILL_MID, FILL_SHADE,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK, lenv,
} from '../../core/Layout.js';

function rand(x, salt = 0) {
  const s = Math.sin(x * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// ── 屋顶细节 ──────────────────────────────────────────────────────────────────

function _roofAC(g, x, top, w, d, baseY, n) {
  const lc = lenv(g, baseY, 0.5);
  for (let i = 0; i < n; i++) {
    const ax = x + 26 + rand(x, 10 + i) * (w - 74);
    const ay = top + 16 + rand(x, 20 + i) * Math.max(11, d - 53);
    const aw = 21 + Math.round(rand(x, 30 + i) * 26);
    const ah = 16 + Math.round(rand(x, 40 + i) * 11);
    g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(ax, ay, aw, ah); g.endFill();
    g.lineStyle(0.5, lc, 0.9); g.drawRect(ax, ay, aw, ah);
  }
}

function _roofWaterTower(g, x, top, w, baseY) {
  const lc = lenv(g, baseY, 0.6);
  const wx = x + w * 0.28, sz = 37, wy = top - 26;
  g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(wx - sz, wy, sz * 2, sz); g.endFill();
  g.lineStyle(0.6, lc, 1);
  g.drawRect(wx - sz, wy, sz * 2, sz);
  g.moveTo(wx - sz + 11, wy + sz); g.lineTo(wx - sz + 11, top);
  g.moveTo(wx + sz - 11, wy + sz); g.lineTo(wx + sz - 11, top);
  g.moveTo(wx - sz - 5, wy); g.lineTo(wx, wy - 21); g.lineTo(wx + sz + 5, wy);
}

function _roofBillboard(g, x, top, w, baseY) {
  const lc = lenv(g, baseY, 0.6);
  const bw = Math.min(201, w * 0.45), bx = x + (w - bw) / 2, by = top - 64;
  g.lineStyle(0.55, lc, 1);
  g.moveTo(bx + 21, top); g.lineTo(bx + 21, by + 11);
  g.moveTo(bx + bw - 21, top); g.lineTo(bx + bw - 21, by + 11);
  g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(bx, by, bw, 53); g.endFill();
  g.lineStyle(0.5, lc, 1); g.drawRect(bx, by, bw, 53);
  g.lineStyle(0.35, lc, 0.55);
  g.moveTo(bx + 16, by + 16); g.lineTo(bx + bw - 16, by + 16);
  g.moveTo(bx + 16, by + 32); g.lineTo(bx + bw - 42, by + 32);
}

function _roofSolar(g, x, top, w, baseY) {
  const lc = lenv(g, baseY, 0.5);
  for (let i = 0; i < 2; i++) {
    const sx = x + w * 0.42 - 69 + i * 74, sy = top + 16;
    g.lineStyle(0); g.beginFill(FILL_SHADE, 0.9); g.drawRect(sx, sy, 64, 32); g.endFill();
    g.lineStyle(0.4, lc, 0.7);
    g.moveTo(sx + 21, sy); g.lineTo(sx + 21, sy + 32);
    g.moveTo(sx + 42, sy); g.lineTo(sx + 42, sy + 32);
    g.moveTo(sx, sy + 16); g.lineTo(sx + 64, sy + 16);
    g.lineStyle(0.5, lc, 1); g.drawRect(sx, sy, 64, 32);
  }
}

// ── 上层窗 ────────────────────────────────────────────────────────────────────

// 标准居民 / 混合楼型：大窗网格，FILL_LIGHT 填充
function _windows(g, x, y0, w, resH, floorH, baseY) {
  if (resH < 42) return;
  const lc  = lenv(g, baseY, 0.55);
  const n   = Math.max(1, Math.round(resH / floorH));
  const fh  = resH / n;
  const cW  = 95, cGap = 53;
  const nC  = Math.max(1, Math.floor((w - 85) / (cW + cGap)));
  const sx  = x + (w - (nC * (cW + cGap) - cGap)) / 2;
  const wh  = Math.max(21, fh * 0.56);
  const wy0 = (fh - wh) / 2;
  for (let f = 0; f < n; f++) {
    const fy = y0 + f * fh;
    g.lineStyle(0.35, lc, 0.22); g.moveTo(x + 11, fy); g.lineTo(x + w - 11, fy);
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
  if (resH < 21) return;
  const lc = lenv(g, baseY, 0.5);
  const n  = Math.max(2, Math.round(resH / floorH));
  const fh = resH / n;
  for (let f = 0; f < n; f++) {
    const fy = y0 + f * fh + 11, bh = Math.max(16, fh - 21);
    g.lineStyle(0); g.beginFill(FILL_LIGHT, 0.9); g.drawRect(x + 16, fy, w - 32, bh); g.endFill();
    g.lineStyle(0.5, lc, 0.75); g.drawRect(x + 16, fy, w - 32, bh);
    const segs = Math.max(2, Math.floor((w - 32) / 74));
    g.lineStyle(0.35, lc, 0.38);
    for (let i = 1; i < segs; i++) {
      const lx = x + 16 + (w - 32) * i / segs;
      g.moveTo(lx, fy); g.lineTo(lx, fy + bh);
    }
  }
}

// 百叶 / 老旧楼型：较小窗，FILL_MID 填充 + 细百叶线
function _windowsGrille(g, x, y0, w, resH, floorH, baseY) {
  if (resH < 42) return;
  const lc  = lenv(g, baseY, 0.55);
  const n   = Math.max(1, Math.round(resH / floorH));
  const fh  = resH / n;
  const cW  = 74, cGap = 42;
  const nC  = Math.max(1, Math.floor((w - 64) / (cW + cGap)));
  const sx  = x + (w - (nC * (cW + cGap) - cGap)) / 2;
  const wh  = Math.max(21, fh * 0.52);
  const wy0 = (fh - wh) / 2;
  for (let f = 0; f < n; f++) {
    const fy = y0 + f * fh;
    g.lineStyle(0.35, lc, 0.2); g.moveTo(x + 11, fy); g.lineTo(x + w - 11, fy);
    for (let c = 0; c < nC; c++) {
      const wx = sx + c * (cW + cGap), wy = fy + wy0;
      g.lineStyle(0); g.beginFill(FILL_MID, 1); g.drawRect(wx, wy, cW, wh); g.endFill();
      g.lineStyle(0.5, lc, 0.9); g.drawRect(wx, wy, cW, wh);
      g.lineStyle(0.3, lc, 0.38);
      for (let gx = wx + 16; gx < wx + cW - 11; gx += 18.53) {
        g.moveTo(gx, wy + 1); g.lineTo(gx, wy + wh - 1);
      }
    }
  }
}

// ── 阳台 ──────────────────────────────────────────────────────────────────────

function _balcony(g, x, y0, w, resH, floorH, baseY) {
  const lc    = lenv(g, baseY, 0.5);
  const n     = Math.max(1, Math.round(resH / floorH));
  const fh    = resH / n;
  const slabW = 42, slabH = 16, railH = 32;
  const bx    = x + w;

  for (let f = 0; f < n; f++) {
    const slabY = Math.round(y0 + f * fh + fh * 0.55);

    // Slab
    g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(bx, slabY, slabW, slabH); g.endFill();
    g.lineStyle(0.4, lc, 0.9); g.drawRect(bx, slabY, slabW, slabH);

    // Vertical rails + horizontal top rail
    g.moveTo(bx,         slabY - railH); g.lineTo(bx,         slabY);
    g.moveTo(bx + slabW, slabY - railH); g.lineTo(bx + slabW, slabY);
    g.moveTo(bx,         slabY - railH); g.lineTo(bx + slabW, slabY - railH);
  }
}

// ── 晾衣绳 ────────────────────────────────────────────────────────────────────

function _laundry(g, x, y0, w, resH, floorH, baseY) {
  const lc  = lenv(g, baseY, 0.5);
  const n   = Math.max(1, Math.round(resH / floorH));
  const fh  = resH / n;
  const cnt = 1 + Math.floor(rand(x, 44) * 2);   // 1 or 2 lines

  for (let li = 0; li < cnt; li++) {
    const fi    = Math.floor(rand(x, 50 + li * 7) * Math.max(1, n - 1));
    const lineY = y0 + fi * fh + fh * 0.3;
    const lx1   = x + 21 + Math.round(rand(x, 55 + li * 3) * w * 0.25);
    const lx2   = x + w - 21 - Math.round(rand(x, 60 + li * 3) * w * 0.25);
    if (lx2 <= lx1 + 42) continue;

    // Clothesline（0.5/1.3 是旧世界像素覆盖值，按 O-1 除以 PX_PER_UNIT 补偿）
    g.lineStyle(depthLineWidth(baseY, { wMin: 1.29, wMax: 3.34 }) * 0.3, lc, 0.55);
    g.moveTo(lx1, lineY); g.lineTo(lx2, lineY);

    // Hanging items
    const items = 3 + Math.floor(rand(x, 65 + li) * 3);
    const sp    = (lx2 - lx1) / (items + 1);
    for (let i = 0; i < items; i++) {
      const ix = lx1 + sp * (i + 1) + (rand(x, 70 + li * 13 + i) - 0.5) * 3;
      g.lineStyle(0); g.beginFill(FILL_MID, 1); g.drawRect(Math.round(ix) - 5, lineY, 16, 21); g.endFill();
    }
  }
}

// ── 底层店面 ──────────────────────────────────────────────────────────────────

function _ground(g, x, gy, w, gh, style, archType, baseY) {
  const lc = lenv(g, baseY, 0.65);

  // 门楣/招牌横条
  const sH = 26;
  g.lineStyle(0); g.beginFill(FILL_MID, 1); g.drawRect(x + 11, gy, w - 21, sH); g.endFill();
  g.lineStyle(0.5, lc, 0.85); g.drawRect(x + 11, gy, w - 21, sH);

  const glY = gy + sH + 5, glH = gh - sH - 11;
  if (glH >= 21) {
    const dW  = Math.max(42, Math.min(64, Math.round(w * 0.2)));
    const dX  = x + w - 21 - dW;
    const winW = dX - x - 26;

    if (archType === 'convenience') {
      // Full-width glass front — awning stripe + glass rect + dividers
      const awH = 21;
      g.lineStyle(0); g.beginFill(FILL_SHADE, 1); g.drawRect(x + 11, glY, w - 21, awH); g.endFill();
      g.lineStyle(0.4, lc, 0.8); g.drawRect(x + 11, glY, w - 21, awH);
      const frontY = glY + awH, frontH = glH - awH;
      g.lineStyle(0); g.beginFill(FILL_LIGHT, 0.9); g.drawRect(x + 11, frontY, w - 21, frontH); g.endFill();
      g.lineStyle(0.5, lc, 0.9); g.drawRect(x + 11, frontY, w - 21, frontH);
      g.lineStyle(0.35, lc, 0.5);
      for (let dx = 74; dx < w - 32; dx += 74) {
        g.moveTo(x + 11 + dx, frontY); g.lineTo(x + 11 + dx, frontY + frontH);
      }

    } else {
      // 橱窗
      if (winW > 21) {
        const [shopFill, shopAlpha] =
          archType === 'oldmix'  ? [FILL_MID,   1   ] :
          archType === 'clinic'  ? [FILL_LIGHT, 0.9  ] :
          style    === 'glass'   ? [FILL_LIGHT, 0.9  ] :
                                   [FILL_LIGHT, 0.75 ];
        g.lineStyle(0); g.beginFill(shopFill, shopAlpha); g.drawRect(x + 16, glY, winW, glH); g.endFill();
        g.lineStyle(0.55, lc, 0.9); g.drawRect(x + 16, glY, winW, glH);

        if (archType === 'bookstore') {
          const nSpines = 4 + Math.floor(rand(x, 91) * 3);  // 4–6
          g.lineStyle(0.3, lc, 0.5);
          for (let i = 1; i <= nSpines; i++) {
            const bx = x + 16 + winW * i / (nSpines + 1);
            g.moveTo(bx, glY + 11); g.lineTo(bx, glY + glH - 11);
          }
        }
      }

      // 门扇
      if (archType === 'modern' || archType === 'glass') {
        // Two narrow panels with center gap
        const halfW = Math.floor(dW / 2);
        g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(dX, glY, halfW - 5, glH); g.endFill();
        g.lineStyle(0.5, lc, 0.95); g.drawRect(dX, glY, halfW - 5, glH);
        g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(dX + halfW + 5, glY, dW - halfW - 5, glH); g.endFill();
        g.lineStyle(0.5, lc, 0.95); g.drawRect(dX + halfW + 5, glY, dW - halfW - 5, glH);

      } else if (archType === 'oldmix') {
        // Roller shutter
        g.lineStyle(0); g.beginFill(FILL_SHADE, 1); g.drawRect(dX, glY, dW, glH); g.endFill();
        g.lineStyle(0.5, lc, 0.95); g.drawRect(dX, glY, dW, glH);
        g.lineStyle(0.25, lc, 0.4);
        for (let sy = glY + 16; sy < glY + glH; sy += 16) {
          g.moveTo(dX + 5, sy); g.lineTo(dX + dW - 5, sy);
        }

      } else if (archType === 'clinic') {
        // Glass door with cross
        g.lineStyle(0); g.beginFill(FILL_LIGHT, 1); g.drawRect(dX, glY, dW, glH); g.endFill();
        g.lineStyle(0.5, lc, 0.95); g.drawRect(dX, glY, dW, glH);
        const cx = Math.round(dX + dW / 2), cy = Math.round(glY + glH / 2);
        g.lineStyle(0); g.beginFill(FILL_SHADE, 1);
        g.drawRect(cx - 2.65, cy - 16, 5, 32);
        g.drawRect(cx - 16,   cy - 2.65, 32, 5);
        g.endFill();

      } else {
        // resi / default / bookstore — single panel
        g.lineStyle(0); g.beginFill(FILL_MID, 1); g.drawRect(dX, glY, dW, glH); g.endFill();
        g.lineStyle(0.5, lc, 0.95); g.drawRect(dX, glY, dW, glH);
        // Vertical center line
        g.lineStyle(0.3, lc, 0.5);
        g.moveTo(dX + dW / 2, glY + 11); g.lineTo(dX + dW / 2, glY + glH - 11);
        // Door sill
        g.lineStyle(0.4, lc, 0.6);
        g.moveTo(dX - 5, glY + glH); g.lineTo(dX + dW + 5, glY + glH);
        // Door number dot (above handle)
        g.lineStyle(0); g.beginFill(FILL_SHADE, 1); g.drawCircle(dX + dW / 2, glY + 26, 5); g.endFill();
        // Handle dot
        g.lineStyle(0); g.beginFill(FILL_SHADE, 1); g.drawCircle(dX + 16, glY + glH * 0.52, 6.35); g.endFill();
      }
    }
  }

  // Fix 4: full-width entrance step at very bottom of ground floor
  lenv(g, baseY, 0.5);
  g.moveTo(x, gy + gh); g.lineTo(x + w, gy + gh);
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

  const groundH = Math.min(A.groundMax, Math.round(H * A.groundFrac));
  const resH    = H - groundH;

  if (A.style === 'glass')        _windowsGlass(g, x, y, w, resH, A.floorH, baseY);
  else if (A.style === 'grille')  _windowsGrille(g, x, y, w, resH, A.floorH, baseY);
  else                            _windows(g, x, y, w, resH, A.floorH, baseY);

  if (A.balcony)                  _balcony(g, x, y, w, resH, A.floorH, baseY);
  if (A.laundry && rand(x, 77) < A.laundry) _laundry(g, x, y, w, resH, A.floorH, baseY);

  _ground(g, x, y + resH, w, groundH, A.style, building.arch, baseY);

  // 立面轮廓（最后画，压在所有细节上）
  lenv(g, baseY, 0.85);
  g.drawRect(x, y, w, H);
}

// ── 主出口 ────────────────────────────────────────────────────────────────────

export function drawBuilding(g, building) {
  g.lineStyle(0);
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

}
