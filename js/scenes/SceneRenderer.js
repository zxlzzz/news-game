/**
 * SceneRenderer — 天空 + 地面底图绘制
 *
 * 地面**色带**（填充带、带边界线、人行道砖缝、草丛散布范围）Z-2c 起由
 * scene.json 的 `ground` 配置驱动：本文件不含地面色带的 Y 数值，也不直接引用
 * GRAY_* 名字画带——颜色名写在配置里，经 `Layout.resolveColor` 解析成本项目的灰阶。
 *
 * ⚠️ ground 色带与 NavGrid 的 zone 是**两套不同的划分**，不可互相套用：
 * 远侧人行道的铺装色一路画到 FAR_Y（含远端自行车道 248-268），而那段在导航上是
 * ZONE.ROAD。视觉分带按"看起来是什么材质"切，zone 按"能不能走/多贵"切。
 *
 * 路缘石唇口 / 车道虚线 / 斑马线条纹（`_drawRoadMarkings` / `_drawCrosswalk`）
 * 的几何数值 E-1 起由 `layout.roadMarkings` 驱动，同样不是地面色带、不套用
 * `ground` 的 bands 结构——这三者是"沿路"的逐要素装饰几何，`ground` 是横跨
 * 整个 Y 分带的色带，两者形状不同，配置各自独立。
 *
 * 天际线与云仍是纯代码几何（seed 生成的随机化建筑轮廓 / clouds 位置来自
 * `layout.clouds`），不在本刀范围。
 */
import {
  WORLD_WIDTH, WORLD_HEIGHT, SKY_Y, FAR_Y, NEAR_Y, BUILDING_BASE_Y,
  GRAY_SKY, GRAY_ROAD, GRAY_CURB,
  LINE_FAR_WIDTH, LINE_NEAR_COLOR, LINE_NEAR_WIDTH,
  SKY_COLOR_TOP, SKY_COLOR_HOR, FOG_COLOR, FOG_ALPHA,
  SKYLINE_BACK, SKYLINE_FRONT, SKYLINE_LINE, CLOUD_LINE,
  CURB_EDGE_LINE,
  depthLineColor, depthLineWidth, ENV_LINE_LIGHT, ENV_LINE_DARK,
  resolveY, resolveColor,
} from '../core/Layout.js';

function _need(v, what) {
  if (v == null) throw new Error(`SceneRenderer: scene config 缺 ${what}`);
  return v;
}

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
}
import { drawBusStopBays }  from '../entity/busstop/drawBusStopBay.js';
import { drawChessPlaza }   from '../entity/chess-table/drawChessPlaza.js';
import { drawMiniPark }     from '../entity/mini-park/drawMiniPark.js';
import { drawParkPaths, drawParkPlaza } from '../entity/park-path/drawParkPath.js';

export class SceneRenderer {
  /**
   * @param bgGraphics  地面层 Graphics
   * @param skyGraphics 天空层 Graphics
   * @param layout      sceneData.layout（busStops / clouds / plaza 几何）
   * @param ground      sceneData.ground（地面色带配置；缺则抛错，无硬编码 fallback）
   */
  constructor(bgGraphics, skyGraphics, layout, ground) {
    this.bg     = bgGraphics;
    this.sky    = skyGraphics;
    this.layout = layout;
    this.ground = _need(ground, 'ground');
  }

  drawAll() {
    this._drawSky();
    this._drawGround();
    drawBusStopBays(this.bg, this.layout.busStops);
  }

  _drawGround() {
    const g  = this.bg;
    const cf = this.ground;

    // 1. 填充色带（按配置数组顺序绘制，后者盖前者）
    g.lineStyle(0);
    for (const b of _need(cf.bands, 'ground.bands')) {
      const y0 = resolveY(_need(b.from, `ground.bands[${b.name}].from`));
      const y1 = resolveY(_need(b.to,   `ground.bands[${b.name}].to`));
      g.beginFill(resolveColor(_need(b.color, `ground.bands[${b.name}].color`)), 1);
      g.drawRect(0, y0, WORLD_WIDTH, y1 - y0);
      g.endFill();
    }

    // 2. 带边界线（线色由该 Y 的景深决定）
    for (const e of (cf.edgeLines ?? [])) {
      const y  = resolveY(_need(e.at, 'ground.edgeLines[].at'));
      const lc = depthLineColor(y, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
      g.lineStyle(e.width ?? 1.5, lc, 1);
      g.moveTo(0, y); g.lineTo(WORLD_WIDTH, y);
    }

    this._drawRoadMarkings(g);
    if (cf.tiling) this._drawSidewalkTiles(g, cf.tiling);
    if (cf.grass)  this._drawParkGrass(g, cf.grass);
    drawParkPlaza(g, this.layout.parkTrees || []);
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
    g.beginFill(SKYLINE_BACK, 1);
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
      g.beginFill(SKYLINE_FRONT, 1);
      g.drawRect(bx, base - bh, bw, bh);
      g.endFill();
      g.lineStyle(0.5, SKYLINE_LINE, 0.5);
      g.drawRect(bx, base - bh, bw, bh);
      g.lineStyle(0.4, SKYLINE_LINE, 0.4);
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
      g.lineStyle(0.8, CLOUD_LINE, 0.6);
      g.drawEllipse(cx, cy, 35 * s, 13 * s);
    }
  }

  /** 路缘石唇口 / 车道虚线：几何数值全部来自 scene.json layout.roadMarkings（E-1） */
  _drawRoadMarkings(g) {
    const rm     = _need(this.layout.roadMarkings, 'layout.roadMarkings');
    const curbF  = _need(rm.curbFar,    'layout.roadMarkings.curbFar');
    const edge   = _need(rm.roadEdge,   'layout.roadMarkings.roadEdge');
    const curbN  = _need(rm.curbNear,   'layout.roadMarkings.curbNear');
    const stripe = _need(rm.laneStripe, 'layout.roadMarkings.laneStripe');

    g.lineStyle(0);
    g.beginFill(GRAY_CURB, 1);
    g.drawRect(0, FAR_Y - curbF.thickness, WORLD_WIDTH, curbF.thickness);
    g.endFill();
    g.lineStyle(LINE_FAR_WIDTH, CURB_EDGE_LINE, curbF.edgeLineAlpha);
    g.moveTo(0, FAR_Y - curbF.thickness); g.lineTo(WORLD_WIDTH, FAR_Y - curbF.thickness);
    g.moveTo(0, FAR_Y);                   g.lineTo(WORLD_WIDTH, FAR_Y);
    g.beginFill(GRAY_ROAD, edge.alpha);
    g.drawRect(0, FAR_Y, WORLD_WIDTH, edge.height);
    g.endFill();

    g.beginFill(GRAY_CURB, 1);
    g.drawRect(0, NEAR_Y, WORLD_WIDTH, curbN.thickness);
    g.endFill();
    g.lineStyle(LINE_NEAR_WIDTH * curbN.lineWidthFactor, LINE_NEAR_COLOR, curbN.lineAlpha);
    g.moveTo(0, NEAR_Y + curbN.thickness); g.lineTo(WORLD_WIDTH, NEAR_Y + curbN.thickness);

    const midY = Math.round((FAR_Y + NEAR_Y) / 2);
    g.lineStyle(stripe.width, resolveColor(stripe.color), stripe.alpha);
    for (let x = 0; x < WORLD_WIDTH; x += stripe.spacing) {
      g.moveTo(x, midY); g.lineTo(x + stripe.length, midY);
    }

    for (const cw of (this.layout.crosswalks || [])) {
      this._drawCrosswalk(g, cw.x, _need(rm.crosswalk, 'layout.roadMarkings.crosswalk'));
    }
  }

  /** 斑马线条纹：几何数值全部来自 scene.json layout.roadMarkings.crosswalk（E-1） */
  _drawCrosswalk(g, cx, cf) {
    g.lineStyle(0);
    const roadTop = FAR_Y  + cf.roadMargin;
    const roadBot = NEAR_Y - cf.roadMargin;
    const usable  = roadBot - roadTop;
    const count   = cf.stripeCount;
    const step    = Math.floor(usable / (count * 2 - 1));
    const x0      = cx + cf.xOffset;
    g.beginFill(resolveColor(cf.color), cf.alpha);
    for (let i = 0; i < count; i++) {
      const y  = roadTop + i * step * 2;
      const sh = step - 1 + i;
      g.drawRect(x0, y, cf.stripeLength, sh);
    }
    g.endFill();
  }

  /** 人行道砖缝横线：带内 inset 收边，spacing 间距 */
  _drawSidewalkTiles(g, cf) {
    const topY = resolveY(_need(cf.from, 'ground.tiling.from')) + (cf.inset ?? 0);
    const botY = resolveY(_need(cf.to,   'ground.tiling.to'))   - (cf.inset ?? 0);
    g.lineStyle(cf.width ?? 0.8, resolveColor(_need(cf.color, 'ground.tiling.color')), cf.alpha ?? 0.06);
    for (let y = topY; y <= botY; y += _need(cf.spacing, 'ground.tiling.spacing')) {
      g.moveTo(0, y); g.lineTo(WORLD_WIDTH, y);
    }
  }

  /** 草丛散布：带内 inset 收边，tufts 根数（确定性 seed，非随机） */
  _drawParkGrass(g, cf) {
    const seed = (i) => { const s = Math.sin(i * 91.337) * 43758.5453; return s - Math.floor(s); };
    const top  = resolveY(_need(cf.from, 'ground.grass.from')) + (cf.inset ?? 0);
    const span = resolveY(_need(cf.to, 'ground.grass.to')) - resolveY(cf.from) - 2 * (cf.inset ?? 0);
    for (let i = 0; i < _need(cf.tufts, 'ground.grass.tufts'); i++) {
      const gx  = seed(i * 3 + 1) * WORLD_WIDTH;
      const gy  = top + seed(i * 3 + 2) * span;
      const len = 4 + seed(i * 3 + 3) * 2;
      const ang = (seed(i * 5 + 7) - 0.3) * 0.8;
      lenv(g, gy, 0.15);
      g.moveTo(gx, gy);
      g.lineTo(gx + Math.sin(ang) * len, gy - Math.cos(ang) * len);
    }
  }
}
