import {
  WORLD_WIDTH, WORLD_HEIGHT, SKY_Y, FAR_Y, NEAR_Y, BUILDING_BASE_Y,
  PARK_TOP,
  GRAY_SKY, GRAY_FAR_PAVE, GRAY_ROAD, GRAY_NEAR_PAVE, GRAY_CURB, GRAY_PARK,
  FILL_MID,
  LINE_FAR_WIDTH, LINE_NEAR_COLOR, LINE_NEAR_WIDTH,
  BIKE_LANE_FAR_TOP, BIKE_LANE_NEAR_BOTTOM,
  SKY_COLOR_TOP, SKY_COLOR_HOR, FOG_COLOR, FOG_ALPHA,
} from '../core/Layout.js';
import { drawBusStopBays }  from '../entity/busstop/drawBusStopBay.js';
import { drawChessPlaza }   from '../entity/chess-table/drawChessPlaza.js';
import { drawMiniPark }     from '../entity/mini-park/drawMiniPark.js';
import { drawParkPaths, drawParkPlaza } from '../entity/park-path/drawParkPath.js';

export class SceneRenderer {
  constructor(bgGraphics, skyGraphics, layout) {
    this.bg     = bgGraphics;
    this.sky    = skyGraphics;
    this.layout = layout;
  }

  drawAll() {
    this._drawSky();
    this._drawGround();
    drawBusStopBays(this.bg, this.layout.busStops);
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
    g.beginFill(GRAY_PARK, 1);
    g.drawRect(0, PARK_TOP, WORLD_WIDTH, WORLD_HEIGHT - PARK_TOP);
    g.endFill();
    g.lineStyle(1.5, 0x888888, 1);
    g.moveTo(0, BIKE_LANE_FAR_TOP);      g.lineTo(WORLD_WIDTH, BIKE_LANE_FAR_TOP);
    g.moveTo(0, BIKE_LANE_NEAR_BOTTOM);  g.lineTo(WORLD_WIDTH, BIKE_LANE_NEAR_BOTTOM);

    this._drawRoadMarkings(g);
    this._drawSidewalkTiles(g, BUILDING_BASE_Y + 3, BIKE_LANE_FAR_TOP - 3);
    this._drawRoadPatches(g);
    drawParkPlaza(g);
    drawMiniPark(g, this.layout.miniPark);
    drawChessPlaza(g, this.layout.chessPlaza);
    drawParkPaths(g, this.layout.chessPlaza, this.layout.miniPark);
  }

  _drawSky() {
    const g = this.sky;
    g.clear();

    // 5-band vertical gradient: SKY_COLOR_TOP → SKY_COLOR_HOR over full sky height
    const skyH  = BUILDING_BASE_Y;
    const bands = 5;
    const rT = (SKY_COLOR_TOP >> 16) & 0xff, gT = (SKY_COLOR_TOP >> 8) & 0xff, bT = SKY_COLOR_TOP & 0xff;
    const rH = (SKY_COLOR_HOR >> 16) & 0xff, gH = (SKY_COLOR_HOR >> 8) & 0xff, bH = SKY_COLOR_HOR & 0xff;
    for (let i = 0; i < bands; i++) {
      const t  = (i + 0.5) / bands;
      const r  = Math.round(rT + (rH - rT) * t);
      const gc = Math.round(gT + (gH - gT) * t);
      const b  = Math.round(bT + (bH - bT) * t);
      g.beginFill((r << 16) | (gc << 8) | b, 1);
      g.drawRect(-300, Math.round(i / bands * skyH), WORLD_WIDTH + 600, Math.ceil(skyH / bands) + 1);
      g.endFill();
    }

    // Horizon fog band: atmospheric haze over the skyline baseline
    g.beginFill(FOG_COLOR, FOG_ALPHA);
    g.drawRect(-300, BUILDING_BASE_Y - 20, WORLD_WIDTH + 600, 32);
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
    const cw       = 200;
    const x0       = 100;
    g.beginFill(0xffffff, 0.68);
    for (let i = 0; i < count; i++) {
      const y  = roadTop + i * step * 2;
      const sh = step - 1 + i;
      g.drawRect(x0, y, cw, sh);
    }
    g.endFill();
  }

  _drawSidewalkTiles(g, topY, botY) {
    g.lineStyle(0.8, FILL_MID, 0.45);
    for (let y = topY; y <= botY; y += 20) {
      g.moveTo(0, y); g.lineTo(WORLD_WIDTH, y);
    }
  }
}
