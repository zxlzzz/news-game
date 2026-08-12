/**
 * drawTree — 统一线稿树
 *
 * 3 种树冠变体（按 x seed 选），尺寸 ±15% 抖动。
 * 树冠 FILL_LIGHT 填充 + 环境线轮廓；树干 FILL_SHADE。
 *
 * O-4 第一批的特例：树不是一个盒子。拆两半处理——
 *   树干  → drawObliqueBox（细长方柱，有真实体积，和其它立着的东西一致）
 *   树冠  → frontFaceGraphics 广告牌（原有 blob 轮廓算法一行未改）
 * 理由：树冠是一团有机形状，硬套三面体积会变成一个方盒子，跟本项目的线稿
 * 画风冲突；而"竖直广告牌站在斜地面上"正是 NPC 那条路子（见 StickRenderer
 * 文件头），树用同一套逻辑最自然。O-4 验收要求每个 draw 函数要么调
 * drawObliqueBox、要么调形状助手——本函数两者都调，满足要求。
 */

import { FILL_LIGHT, FILL_SHADE, depthLineWidth, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

function rand(x, salt = 0) {
  const s = Math.sin(x * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const VARIANTS = [
  // 0: 圆润球形
  [
    [  0.00, -0.30,  0.52 ],
    [ -0.38, -0.14,  0.42 ],
    [  0.38, -0.10,  0.40 ],
    [ -0.56,  0.14,  0.34 ],
    [  0.54,  0.16,  0.34 ],
    [ -0.24,  0.26,  0.36 ],
    [  0.26,  0.28,  0.36 ],
  ],
  // 1: 纵向椭圆（高挑）
  [
    [  0.00, -0.55,  0.42 ],
    [ -0.28, -0.26,  0.44 ],
    [  0.28, -0.22,  0.42 ],
    [ -0.40,  0.10,  0.36 ],
    [  0.40,  0.12,  0.34 ],
    [ -0.16,  0.30,  0.38 ],
    [  0.18,  0.32,  0.36 ],
  ],
  // 2: 横向开展（伸展型）
  [
    [  0.00, -0.20,  0.50 ],
    [ -0.52, -0.06,  0.40 ],
    [  0.50, -0.04,  0.38 ],
    [ -0.68,  0.18,  0.30 ],
    [  0.66,  0.20,  0.28 ],
    [ -0.28,  0.28,  0.38 ],
    [  0.30,  0.30,  0.38 ],
  ],
];

export function drawTree(g, p) {
  g.lineStyle(0);
  const { x, y } = p;
  const s = p.scale ?? 1;

  const jitter = 0.85 + rand(x, 0) * 0.30;
  const r = 150 * s * jitter;

  const trunkW = Math.max(2.5 * s, r * 0.13);
  const trunkH = r * 0.65;

  // 树干：细长方柱走盒子模板（进深取树干直径量级，见 PROP_DEPTH.tree）
  drawObliqueBox(g, x, y, trunkW, PROP_DEPTH.tree * s, trunkH, FILL_SHADE);

  // 树冠：广告牌，原算法整段未改，只换坐标映射
  _crown(frontFaceGraphics(g, x, y), x, y, r, trunkH);
}

// 老版本树冠部分的函数体，绘制逻辑一行未改（blob 填充 + 外轮廓采样连线）。
function _crown(g, x, y, r, trunkH) {
  const crownBottom = y - trunkH;
  const crownCY     = crownBottom - r * 0.35;

  // 线宽用于外轮廓点检测
  const lw = depthLineWidth(y, { wMin: 0.6, wMax: 1.4 });

  // 树冠形态选取
  const variant = Math.floor(rand(x, 1) * 3);
  const blobs   = VARIANTS[variant].map(([dx, dy, br]) => [dx * r, dy * r, br * r]);

  // 填充
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  for (const [dx, dy, br] of blobs) g.drawCircle(x + dx, crownCY + dy, br);
  g.endFill();

  // 外轮廓：对每个 blob 的圆周采样，只保留不被其他 blob 覆盖的点，排序后连线
  function isOuter(px, py, skipIdx) {
    for (let i = 0; i < blobs.length; i++) {
      if (i === skipIdx) continue;
      const [dx, dy, br] = blobs[i];
      if ((px - (x + dx)) ** 2 + (py - (crownCY + dy)) ** 2 < (br - lw) ** 2) return false;
    }
    return true;
  }

  const STEPS = 56;
  const pts   = [];
  for (let bi = 0; bi < blobs.length; bi++) {
    const [dx, dy, br] = blobs[bi];
    const cx = x + dx, cy = crownCY + dy;
    for (let i = 0; i < STEPS; i++) {
      const a  = (2 * Math.PI * i) / STEPS;
      const px = cx + Math.cos(a) * br;
      const py = cy + Math.sin(a) * br;
      if (isOuter(px, py, bi)) pts.push({ x: px, y: py });
    }
  }

  if (pts.length < 3) return;
  const mx = pts.reduce((acc, q) => acc + q.x, 0) / pts.length;
  const my = pts.reduce((acc, q) => acc + q.y, 0) / pts.length;
  pts.sort((a, b) => Math.atan2(a.y - my, a.x - mx) - Math.atan2(b.y - my, b.x - mx));

  lenv(g, y, 1.0);
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
}
