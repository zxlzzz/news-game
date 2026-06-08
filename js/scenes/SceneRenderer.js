import {
  WORLD_WIDTH, WORLD_HEIGHT, SKY_Y, FAR_Y, NEAR_Y, BUILDING_BASE_Y,
  PARK_TOP, PARK_BOTTOM,
  GRAY_SKY, GRAY_FAR_PAVE, GRAY_ROAD, GRAY_NEAR_PAVE, GRAY_CURB,
  LINE_FAR_WIDTH, LINE_NEAR_COLOR, LINE_NEAR_WIDTH,
  BIKE_LANE_FAR_TOP, BIKE_LANE_NEAR_BOTTOM,
  depthScale,
} from '../SceneConfig.js';

export class SceneRenderer {
  constructor(bgGraphics, skyGraphics, layout) {
    this.bg     = bgGraphics;
    this.sky    = skyGraphics;
    this.layout = layout;
  }

  drawAll() {
    this._drawSky();
    this._drawGround();
    this._drawBusStops();
  }

  _drawGround() {
    const g = this.bg;
    g.beginFill(GRAY_FAR_PAVE, 1);
    g.drawRect(0, BUILDING_BASE_Y, WORLD_WIDTH, FAR_Y - BUILDING_BASE_Y);
    g.endFill();
    g.beginFill(GRAY_ROAD, 1);
    g.drawRect(0, FAR_Y, WORLD_WIDTH, NEAR_Y - FAR_Y);
    g.endFill();
    g.beginFill(GRAY_NEAR_PAVE, 1);
    g.drawRect(0, NEAR_Y, WORLD_WIDTH, BIKE_LANE_NEAR_BOTTOM - NEAR_Y);
    g.endFill();
    g.beginFill(0xcacaca, 1);
    g.drawRect(0, PARK_TOP, WORLD_WIDTH, WORLD_HEIGHT - PARK_TOP);
    g.endFill();
    g.lineStyle(1.5, 0x888888, 1);
    g.moveTo(0, BIKE_LANE_FAR_TOP);      g.lineTo(WORLD_WIDTH, BIKE_LANE_FAR_TOP);
    g.moveTo(0, BIKE_LANE_NEAR_BOTTOM);  g.lineTo(WORLD_WIDTH, BIKE_LANE_NEAR_BOTTOM);

    this._drawRoadMarkings(g);
    this._drawSidewalkTiles(g, BUILDING_BASE_Y + 3, BIKE_LANE_FAR_TOP - 3);
    this._drawRoadPatches(g);
    this._drawParkPlaza(g);
    this._drawMiniPark(g);
    this._drawChessPlaza(g);
    this._drawParkPaths(g);
  }

  _drawBusStops() {
    const g  = this.bg;
    const ft = BIKE_LANE_FAR_TOP;
    const fy = FAR_Y;
    const ny = NEAR_Y;

    const drawSign = (px, py) => {
      const sw = 22, sh = 15;
      const sx = px - Math.round(sw / 2);
      g.beginFill(0x1a44aa, 1);
      g.drawRect(sx, py, sw, sh);
      g.endFill();
      g.lineStyle(1, 0x0a0820, 1);
      g.drawRect(sx, py, sw, sh);
      g.beginFill(0xeaeaf0, 1);
      g.drawRect(sx + 2, py + 2, sw - 4, sh - 4);
      g.endFill();
      g.beginFill(0x2255bb, 0.85);
      g.drawRect(sx + 3, py + 3, sw - 6, 4);
      g.endFill();
      g.beginFill(0x303050, 0.55);
      g.drawRect(sx + 3, py + 8,  sw - 6, 1);
      g.drawRect(sx + 3, py + 10, sw - 6, 1);
      g.drawRect(sx + 3, py + 12, sw - 8, 1);
      g.endFill();
    };

    for (const stop of (this.layout.busStops || [])) {
      if (stop.direction > 0) {
        this._drawFarBusStop(g, stop, ft, fy, drawSign);
      } else {
        this._drawNearBusStop(g, stop, ny, drawSign);
      }
    }
  }

  _drawFarBusStop(g, stop, ft, fy, drawSign) {
    const sx      = stop.x;
    const BAY_W   = stop.bayW;
    const BAY_D   = stop.bayD;
    const ROOF_W  = stop.roofW;
    const ROOF_H  = stop.roofH;
    const PIL_X   = stop.pillarOffset;
    const BENCH_W = stop.benchW;
    const bx0     = sx - BAY_W / 2;
    const bx1     = sx + BAY_W / 2;

    g.beginFill(GRAY_ROAD, 1);
    g.drawRect(bx0, fy - BAY_D, BAY_W, BAY_D);
    g.endFill();
    g.beginFill(0xd8d8d8, 1);
    g.drawRect(bx0 - 3, fy - BAY_D - 3, 3,         BAY_D + 3);
    g.drawRect(bx1,     fy - BAY_D - 3, 3,         BAY_D + 3);
    g.drawRect(bx0 - 3, fy - BAY_D - 3, BAY_W + 6, 3);
    g.endFill();
    g.beginFill(0xb2b2b0, 1);
    g.drawRect(bx0, fy - BAY_D - 2, BAY_W, 2);
    g.endFill();

    const roofT   = ft - 30;
    const pillarT = roofT + ROOF_H;

    const sf = depthScale(fy);
    const benchY = pillarT + 10;
    const benchHalf = BENCH_W / 2;
    g.beginFill(0x565654, 1);
    g.drawRect(sx - benchHalf, benchY, BENCH_W, 4 * sf);
    g.endFill();
    g.lineStyle(0.8 * sf, 0x181818, 0.7);
    g.drawRect(sx - benchHalf, benchY, BENCH_W, 4 * sf);
    g.lineStyle(1.5 * sf, 0x303030, 0.9);
    g.moveTo(sx - benchHalf + 10, benchY + 4 * sf); g.lineTo(sx - benchHalf + 10, benchY + 30 * sf);
    g.moveTo(sx + benchHalf - 10, benchY + 4 * sf); g.lineTo(sx + benchHalf - 10, benchY + 30 * sf);

    const poleX  = bx1 + 5;
    const poleTy = roofT + 10;
    const poleBy = fy - BAY_D - 2;
    g.lineStyle(2.2 * sf, 0x2e2e2e, 1);
    g.moveTo(poleX, poleTy); g.lineTo(poleX, poleBy);
    drawSign(poleX, poleTy);
  }

  _drawNearBusStop(g, stop, ny, drawSign) {
    const sx      = stop.x;
    const BAY_W   = stop.bayW;
    const BAY_D   = stop.bayD;
    const ROOF_H  = stop.roofH;
    const BENCH_W = stop.benchW;
    const bx0     = sx - BAY_W / 2;
    const bx1     = sx + BAY_W / 2;

    g.beginFill(GRAY_ROAD, 1);
    g.drawRect(bx0, ny, BAY_W, BAY_D);
    g.endFill();
    g.beginFill(0xd8d8d8, 1);
    g.drawRect(bx0 - 3, ny,             3,         BAY_D + 3);
    g.drawRect(bx1,     ny,             3,         BAY_D + 3);
    g.drawRect(bx0 - 3, ny + BAY_D,     BAY_W + 6, 3);
    g.endFill();
    g.beginFill(0xb2b2b0, 1);
    g.drawRect(bx0, ny + BAY_D, BAY_W, 2);
    g.endFill();

    const roofT   = BIKE_LANE_NEAR_BOTTOM;
    const pillarT = roofT + ROOF_H;
    const sn      = depthScale(ny);

    const benchY    = pillarT - 43;
    const benchHalf = BENCH_W / 2;
    g.beginFill(0x565654, 1);
    g.drawRect(sx - benchHalf, benchY, BENCH_W, 4 * sn);
    g.endFill();
    g.lineStyle(0.8 * sn, 0x181818, 0.7);
    g.drawRect(sx - benchHalf, benchY, BENCH_W, 4 * sn);
    g.lineStyle(1.5 * sn, 0x303030, 0.9);
    g.moveTo(sx - benchHalf + 12, benchY + 4 * sn); g.lineTo(sx - benchHalf + 12, benchY + 40 * sn);
    g.moveTo(sx + benchHalf - 12, benchY + 4 * sn); g.lineTo(sx + benchHalf - 12, benchY + 40 * sn);

    const poleX  = bx1 + 5;
    const poleTy = roofT + 10;
    const poleBy = BIKE_LANE_NEAR_BOTTOM + 50;
    g.lineStyle(2.2 * sn, 0x2e2e2e, 1);
    g.moveTo(poleX, poleTy); g.lineTo(poleX, poleBy);
    drawSign(poleX, poleTy);
  }

  _drawParkPaths(g) {
    const cc    = this.layout.chessPlaza;
    const mp    = this.layout.miniPark;
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
    for (const pts of paths) this._drawCurvedPath(g, pts, 26);
  }

  _drawCurvedPath(g, ctrl, width) {
    const pts = this._catmullRom(ctrl, 10);
    g.lineStyle(width, 0xdedede, 1);     this._strokePolyline(g, pts);
    g.lineStyle(width - 7, 0xe9e9e9, 1); this._strokePolyline(g, pts);
    g.lineStyle(0.8, 0xb6b6b6, 0.6);     this._strokePolyline(g, pts);
  }

  _strokePolyline(g, pts) {
    g.beginFill(0, 0);
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.endFill();
  }

  _catmullRom(ctrl, seg) {
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

  _drawChessPlaza(g) {
    const { cx, cy, rx, ry } = this.layout.chessPlaza;
    g.beginFill(0xebebeb, 0.4);
    g.drawEllipse(cx, cy, rx, ry);
    g.endFill();
    g.lineStyle(1, 0xcccccc, 0.9);
    g.drawEllipse(cx, cy, rx, ry);
    g.lineStyle(0.5, 0xd4d4d4, 0.35);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
  }

  _drawMiniPark(g) {
    const { cx, cy, rx, ry } = this.layout.miniPark;
    const seed = (i) => { const s = Math.sin(i * 57.3) * 43758.5; return s - Math.floor(s); };
    g.beginFill(0xe8e8e8, 1);
    g.drawEllipse(cx, cy, rx, ry);
    g.endFill();
    g.lineStyle(0.6, 0x8a8a8a, 0.28);
    for (let i = 0; i < 28; i++) {
      const a = seed(i * 2) * Math.PI * 2, rr = Math.sqrt(seed(i * 2 + 1));
      const gx = cx + Math.cos(a) * rx * 0.82 * rr;
      const gy = cy + Math.sin(a) * ry * 0.82 * rr;
      g.moveTo(gx, gy);       g.lineTo(gx, gy - 3);
      g.moveTo(gx, gy - 1.5); g.lineTo(gx - 1.5, gy - 3.5);
      g.moveTo(gx, gy - 1.5); g.lineTo(gx + 1.5, gy - 3.5);
    }
  }

  _drawSky() {
    const g = this.sky;
    g.clear();
    g.beginFill(GRAY_SKY, 1);
    g.drawRect(-300, 0, WORLD_WIDTH + 600, SKY_Y);
    g.endFill();
    this._drawFarSkyline(g);
    this._drawClouds(g);
  }

  _drawFarSkyline(g) {
    const seed = (i) => { const s = Math.sin(i * 73.13) * 43758.5; return s - Math.floor(s); };
    const base = BUILDING_BASE_Y;
    g.beginFill(0xf1f1f1, 1);
    for (let i = 0; i < 48; i++) {
      const bx = i * 46 - 30 + seed(i) * 12;
      const bw = 38 + seed(i + 9) * 26;
      const bh = 78 + seed(i + 3) * 60;
      g.drawRect(bx, base - bh, bw, bh);
    }
    g.endFill();
    for (let i = 0; i < 32; i++) {
      const bx = i * 70 - 20 + seed(i + 50) * 28;
      const bw = 44 + seed(i + 60) * 36;
      const bh = 110 + seed(i + 70) * 70;
      g.beginFill(0xe6e6e6, 1);
      g.drawRect(bx, base - bh, bw, bh);
      g.endFill();
      g.lineStyle(0.5, 0xd6d6d6, 0.5);
      g.drawRect(bx, base - bh, bw, bh);
      g.lineStyle(0.4, 0xdcdcdc, 0.4);
      for (let k = 1; k < 3; k++) { const lx = bx + bw * k / 3; g.moveTo(lx, base - bh + 6); g.lineTo(lx, base - 4); }
    }
  }

  _drawClouds(g) {
    for (const c of (this.layout.clouds || [])) {
      const { x: cx, y: cy, scale: s } = c;
      g.beginFill(0xffffff, 0.92);
      g.drawEllipse(cx,          cy,         35 * s, 13 * s);
      g.drawEllipse(cx - 28 * s, cy + 6 * s, 22 * s, 10 * s);
      g.drawEllipse(cx + 30 * s, cy + 5 * s, 24 * s, 10 * s);
      g.endFill();
      g.lineStyle(0.8, 0xd2d2d2, 0.6);
      g.drawEllipse(cx, cy, 35 * s, 13 * s);
    }
  }

  _drawParkPlaza(g) {
    const top = PARK_TOP, bot = WORLD_HEIGHT;
    const seed = (i) => { const s = Math.sin(i * 91.7) * 43758.5; return s - Math.floor(s); };
    g.lineStyle(0.6, 0x969696, 0.3);
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
        g.moveTo(gx, gy);       g.lineTo(gx, gy - 3);
        g.moveTo(gx, gy - 1.5); g.lineTo(gx - 1.5, gy - 3.5);
        g.moveTo(gx, gy - 1.5); g.lineTo(gx + 1.5, gy - 3.5);
      }
    }
    g.beginFill(0xdedede, 1);
    g.drawRect(0, top + 4, WORLD_WIDTH, 22);
    g.endFill();
    g.lineStyle(0.6, 0xb4b4b4, 0.5);
    g.moveTo(0, top + 4);  g.lineTo(WORLD_WIDTH, top + 4);
    g.moveTo(0, top + 26); g.lineTo(WORLD_WIDTH, top + 26);
  }

  _drawRoadMarkings(g) {
    g.beginFill(GRAY_CURB, 1);
    g.drawRect(0, FAR_Y - 3, WORLD_WIDTH, 3);
    g.endFill();
    g.lineStyle(LINE_FAR_WIDTH, 0x7a7a7a, 0.65);
    g.moveTo(0, FAR_Y - 3); g.lineTo(WORLD_WIDTH, FAR_Y - 3);
    g.moveTo(0, FAR_Y);     g.lineTo(WORLD_WIDTH, FAR_Y);
    g.beginFill(0x888888, 0.85);
    g.drawRect(0, FAR_Y, WORLD_WIDTH, 4);
    g.endFill();

    g.beginFill(0xd8d8d8, 1);
    g.drawRect(0, NEAR_Y, WORLD_WIDTH, 4);
    g.endFill();
    g.lineStyle(LINE_NEAR_WIDTH * 0.7, LINE_NEAR_COLOR, 0.55);
    g.moveTo(0, NEAR_Y + 4); g.lineTo(WORLD_WIDTH, NEAR_Y + 4);

    const midY = Math.round((FAR_Y + NEAR_Y) / 2);
    const spacing = this.layout.roadStripeSpacing || 56;
    const length  = this.layout.roadStripeLength  || 28;
    g.lineStyle(2, 0xffffff, 0.6);
    for (let x = 0; x < WORLD_WIDTH; x += spacing) {
      g.moveTo(x, midY); g.lineTo(x + length, midY);
    }

    for (const cw of (this.layout.crosswalks || [])) {
      this._drawCrosswalk(g, cw.x);
    }
  }

  _drawRoadPatches(g) {
    const rand = (i) => { const s = Math.sin(i * 91.337) * 43758.5453; return s - Math.floor(s); };
    g.beginFill(0x8a8a8a, 0.4);
    for (let i = 0; i < 3; i++) {
      const px = (i + 0.5) * WORLD_WIDTH / 3 + (rand(i + 1) - 0.5) * 200;
      const py = FAR_Y + 18 + rand(i * 3 + 2) * (NEAR_Y - FAR_Y - 36);
      const pw = 30 + rand(i * 3 + 3) * 40;
      const ph = 6  + rand(i * 3 + 4) * 6;
      g.drawRect(px, py, pw, ph);
    }
    g.endFill();
  }

  _drawCrosswalk(g, cx) {
    const roadTop  = FAR_Y  + 5;
    const roadBot  = NEAR_Y - 5;
    const usable   = roadBot - roadTop;
    const count    = 5;
    const step     = Math.floor(usable / (count * 2 - 1));
    const cw       = 240;
    const x0       = Math.round(cx - cw / 2);
    g.beginFill(0xffffff, 0.68);
    for (let i = 0; i < count; i++) {
      const y  = roadTop + i * step * 2;
      const sh = step - 1 + i;
      g.drawRect(x0, y, cw, sh);
    }
    g.endFill();
  }

  _drawSidewalkTiles(g, topY, botY) {
    g.lineStyle(0.8, 0xcccccc, 0.3);
    for (let y = topY; y <= botY; y += 20) {
      g.moveTo(0, y); g.lineTo(WORLD_WIDTH, y);
    }
  }
}
