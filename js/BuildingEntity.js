/**
 * BuildingEntity
 * 俯视角建筑实体：替代原先在 StreetScene 中硬编码的建筑绘制。
 * 每栋建筑带语义 tags（如 ['bank','finance','building']），可被取景框识别。
 *
 * 坐标约定：
 *   this.x = 建筑左边缘 X（非中心）
 *   this.y = 建筑临街底边 Y（面向道路的一侧，默认 130）
 *   bWidth = 建筑宽度（X方向）
 *   bDepth = 建筑纵深（从 y-bDepth 到 y，即俯视时的"楼顶"范围）
 */

import { Entity } from './Entity.js';
import {
  BUILDING_FILL_LIGHT, BUILDING_FILL_MID, BUILDING_FILL_DARK,
  LINE_FAR_COLOR, LINE_FAR_WIDTH,
} from './SceneConfig.js';

// 将任意颜色压成灰度，再映射到建筑用的浅灰区间（180–215）
function toBuildingGray(color) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b =  color        & 0xff;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const v   = Math.round(180 + (lum / 255) * 35);
  return (v << 16) | (v << 8) | v;
}

export class BuildingEntity extends Entity {
  /**
   * @param {object} config
   * @param {number}   config.x          - 建筑左边缘 X
   * @param {number}   config.y          - 临街底边 Y（通常为 130）
   * @param {number}   config.bWidth     - 建筑宽度
   * @param {number}   config.bDepth     - 建筑纵深（俯视高度）
   * @param {number}   config.color      - 楼顶主色
   * @param {boolean}  config.waterTower - 是否有水塔
   * @param {string[]} config.tags       - 语义标签
   */
  constructor(config) {
    super({
      ...config,
      // Entity.width/height 映射到包围盒，建筑用 getBounds 覆盖
      width:  config.bWidth ?? 100,
      height: config.bDepth ?? 70,
      static: true,
    });
    this.bWidth     = config.bWidth     ?? 100;
    this.bDepth     = config.bDepth     ?? 70;
    // 原始 color 用作灰度种子，让每栋楼有细微差异；最终颜色统一压成浅灰
    this.color      = toBuildingGray(config.color ?? 0xa09a92);
    this.waterTower = config.waterTower ?? false;
  }

  /**
   * 包围盒：建筑在俯视图中的矩形占地
   * x=左边缘，y_top=y−bDepth，到 y=底边
   */
  getBounds() {
    return {
      x:      this.x,
      y:      this.y - this.bDepth,
      width:  this.bWidth,
      height: this.bDepth,
    };
  }

  draw(g) {
    if (!this.visible) return;
    const { x, bWidth: w, bDepth: d, color } = this;
    const top = this.y - d;

    // 楼顶主体（浅灰）
    g.fillStyle(color, 1);
    g.fillRect(x, top, w, d);

    // 背街侧极淡高光
    g.fillStyle(0xffffff, 0.10);
    g.fillRect(x, top, w, Math.floor(d * 0.38));

    // 临街侧阴影
    g.fillStyle(0x000000, 0.10);
    g.fillRect(x, top + d * 0.62, w, d * 0.38);

    // 轮廓（远端薄浅）
    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 0.95);
    g.strokeRect(x, top, w, d);

    // 屋顶中脊线
    g.lineStyle(0.8, LINE_FAR_COLOR, 0.45);
    g.lineBetween(x + w / 2, top, x + w / 2, this.y);

    // 临街阴影线（让建筑根部更稳）
    g.lineStyle(1.6, 0x303030, 0.50);
    g.lineBetween(x, this.y, x + w, this.y);

    if (this.waterTower) this._drawWaterTower(g, top, d);

    // ── 建筑前立面（面向道路的正面墙体） ──────────────────────────────
    this._drawFacade(g, x, w);

    // 取景框高亮
    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }

  _drawFacade(g, x, w) {
    const FACADE_H = 34;
    const fc = this.color;
    // 正面墙比屋顶略深（约 0.78），保持在浅灰区间
    const facadeColor = (
      (Math.floor(((fc >> 16) & 0xff) * 0.78) << 16) |
      (Math.floor(((fc >>  8) & 0xff) * 0.78) <<  8) |
       Math.floor( (fc        & 0xff) * 0.78)
    );

    // 主墙体
    g.fillStyle(facadeColor, 1);
    g.fillRect(x, this.y, w, FACADE_H);

    // 左侧窄阴影（立体边缘感）
    g.fillStyle(0x000000, 0.12);
    g.fillRect(x, this.y, 3, FACADE_H);

    // 顶部高光条（屋檐投影）
    g.fillStyle(0x000000, 0.18);
    g.fillRect(x, this.y, w, 3);

    // 底边线（落地线，远端薄浅）
    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 0.85);
    g.lineBetween(x, this.y + FACADE_H, x + w, this.y + FACADE_H);

    // 窗户（均匀排布）— 纯黑白灰
    const winW = 7, winH = 10, winGap = 6;
    const nWin = Math.max(1, Math.floor((w - 14) / (winW + winGap)));
    const startX = x + Math.round((w - nWin * (winW + winGap) + winGap) / 2);
    const winY   = this.y + 9;
    for (let i = 0; i < nWin; i++) {
      const wx = startX + i * (winW + winGap);
      // 玻璃（深灰）
      g.fillStyle(0x2a2a2a, 0.78);
      g.fillRect(wx, winY, winW, winH);
      // 窗户高光（白）
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(wx, winY, 2, winH);
      // 窗框
      g.lineStyle(0.6, 0x000000, 0.6);
      g.strokeRect(wx, winY, winW, winH);
    }
  }

  _drawWaterTower(g, roofTop, d) {
    const wx = this.x + this.bWidth * 0.38;
    const wy = roofTop + d * 0.35;
    g.fillStyle(0x8a8a8a, 1);
    g.fillCircle(wx, wy, 10);
    g.lineStyle(LINE_FAR_WIDTH, LINE_FAR_COLOR, 1);
    g.strokeCircle(wx, wy, 10);
    g.fillStyle(0xbcbcbc, 0.7);
    g.fillCircle(wx - 2, wy - 2, 4);
    // 塔腿
    g.lineStyle(1.2, 0x4a4a4a, 0.9);
    g.lineBetween(wx - 6, wy + 8, wx - 6, wy + 14);
    g.lineBetween(wx + 6, wy + 8, wx + 6, wy + 14);
  }
}
