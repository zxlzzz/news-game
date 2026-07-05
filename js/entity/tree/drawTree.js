/**
 * drawTree — 统一线稿树
 *
 * 3 种树冠变体（按 x seed 选），尺寸 ±15% 抖动。
 * 树冠 FILL_LIGHT 填充 + 环境线轮廓；树干 FILL_SHADE。
 * 整体对比度不超过建筑，不抢 NPC 视觉权重。
 */

import {
  FILL_LIGHT, FILL_SHADE,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function rand(x, salt = 0) {
  const s = Math.sin(x * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// 三种树冠形态（坐标以 r 为单位的比例值 [dx, dy, blobR]）
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
  const { x, y } = p;
  const s = p.scale ?? 1;

  // 尺寸抖动 ±15%
  const jitter = 0.85 + rand(x, 0) * 0.30;
  const r = 150 * s * jitter;

  const lw = depthLineWidth(y, { wMin: 0.6, wMax: 1.4 });
  const lc = depthLineColor(y, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });

  const trunkW     = Math.max(2.5 * s, r * 0.13);
  const trunkH     = r * 0.65;
  const crownBottom = y - trunkH;
  const crownCY    = crownBottom - r * 0.35;

  // 树干
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(x - trunkW / 2, crownBottom, trunkW, trunkH);
  g.endFill();
  g.lineStyle(lw * 0.65, lc, 0.9);
  g.drawRect(x - trunkW / 2, crownBottom, trunkW, trunkH);

  // 树冠形态选取
  const variant = Math.floor(rand(x, 1) * 3);
  const blobs   = VARIANTS[variant].map(([dx, dy, br]) => [dx * r, dy * r, br * r]);

  // 填充（所有 blob 合并为整体）
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  for (const [dx, dy, br] of blobs) g.drawCircle(x + dx, crownCY + dy, br);
  g.endFill();

  // 外轮廓：对每个 blob 的圆周采样，只保留"不被其他 blob 覆盖"的点，排序后连线
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

  g.lineStyle(lw, lc, 0.88);
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
}
