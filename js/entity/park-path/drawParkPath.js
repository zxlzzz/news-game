import {
  PARK_TOP, WORLD_WIDTH, WORLD_HEIGHT,
  FILL_PAPER, FILL_LIGHT, FILL_MID,
  depthScale,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

function rand(x, salt = 0) {
  const s = Math.sin(x * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function _catmullRom(ctrl, seg) {
  const out = [];
  const p = (i) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

function _strokePolyline(g, pts) {
  g.beginFill(0, 0);
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.endFill();
}

function _drawCurvedPath(g, ctrl, width, baseY) {
  const pts = _catmullRom(ctrl, 10);
  // 路面用 FILL_PAPER 宽线条填充（fill-via-stroke 技法）
  g.lineStyle(width, FILL_PAPER, 1);       _strokePolyline(g, pts);
  g.lineStyle(width - 7, FILL_PAPER, 1);   _strokePolyline(g, pts);
  // 路缘线走 lenv
  lenv(g, baseY, 0.5);                     _strokePolyline(g, pts);
}

export function drawParkPaths(g, chessPlaza, miniPark) {
  const cc    = chessPlaza;
  const mp    = miniPark;
  const walkY = PARK_TOP + 15;

  const paths = [
    [
      [cc.cx + cc.rx,        cc.cy     ],
      [cc.cx + cc.rx + 70,   cc.cy -  9],
      [mp.cx - mp.rx - 50,   mp.cy -  9],
      [mp.cx - mp.rx,        mp.cy     ],
    ],
    [
      [cc.cx - cc.rx,        cc.cy     ],
      [cc.cx - cc.rx - 160,  cc.cy + 14],
      [cc.cx - cc.rx - 340,  cc.cy +  2],
      [0,                     cc.cy +  8],
    ],
    [
      [mp.cx + mp.rx,        mp.cy     ],
      [mp.cx + mp.rx + 180,  mp.cy - 10],
      [mp.cx + mp.rx + 380,  mp.cy +  8],
      [WORLD_WIDTH,           mp.cy     ],
    ],
    [
      [1765, walkY                         ],
      [1762, (walkY + mp.cy) >> 1          ],
      [1768, mp.cy + 6                     ],
    ],
  ];
  for (const pts of paths) {
    const baseY = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    _drawCurvedPath(g, pts, 26, baseY);
  }
}

export function drawParkPlaza(g, parkTrees = []) {
  const top = PARK_TOP, bot = WORLD_HEIGHT;
  const parkMidY = (top + bot) / 2;
  const seed = (i) => { const s = Math.sin(i * 91.7) * 43758.5; return s - Math.floor(s); };

  // Grass blob patches
  g.lineStyle(0);
  const blobs = 7;
  for (let i = 0; i < blobs; i++) {
    const bx = seed(i * 4 + 1) * WORLD_WIDTH;
    const by = top + 30 + seed(i * 4 + 2) * (bot - top - 60);
    const brx = 90 + seed(i * 4 + 3) * 120;
    const bry = brx * (0.28 + seed(i * 4 + 4) * 0.18);
    g.beginFill(FILL_LIGHT, 0.28);
    g.drawEllipse(bx, by, brx, bry);
    g.endFill();
  }

  // Tree shadow ellipses
  for (const t of parkTrees) {
    const sc = depthScale(t.y);
    const jitter = 0.85 + rand(t.x, 0) * 0.30;
    const crownR = 150 * sc * jitter;
    g.lineStyle(0);
    g.beginFill(FILL_LIGHT, 0.32);
    g.drawEllipse(t.x, t.y, crownR * 1.05, crownR * 0.18);
    g.endFill();
  }

  // Grass stroke marks
  const clusters = 22;
  let drawn = 0;
  for (let c = 0; c < clusters && drawn < 160; c++) {
    const ccx = seed(c * 3 + 1) * WORLD_WIDTH;
    const ccy = top + 28 + seed(c * 3 + 2) * (bot - top - 34);
    const cn  = 3 + Math.floor(seed(c * 3 + 3) * 7);
    const spread = 24 + seed(c * 5 + 1) * 60;
    for (let k = 0; k < cn && drawn < 160; k++, drawn++) {
      const gx = ccx + (seed(drawn * 2 + 7) - 0.5) * spread;
      const gy = ccy + (seed(drawn * 2 + 8) - 0.5) * spread * 0.55;
      if (gx < 4 || gx > WORLD_WIDTH - 4) continue;
      lenv(g, gy, 0.3);
      g.moveTo(gx, gy);       g.lineTo(gx, gy - 3);
      g.moveTo(gx, gy - 1.5); g.lineTo(gx - 1.5, gy - 3.5);
      g.moveTo(gx, gy - 1.5); g.lineTo(gx + 1.5, gy - 3.5);
    }
  }

  // Entry strip (PARK_TOP band)
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.drawRect(0, top + 4, WORLD_WIDTH, 22);
  g.endFill();
  lenv(g, top + 4, 0.5);
  g.moveTo(0, top + 4);  g.lineTo(WORLD_WIDTH, top + 4);
  lenv(g, top + 26, 0.5);
  g.moveTo(0, top + 26); g.lineTo(WORLD_WIDTH, top + 26);
}
