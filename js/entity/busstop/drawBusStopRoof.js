import {
  depthLineWidth, depthLineColor,
  FILL_MID,
  ENV_LINE_LIGHT, ENV_LINE_DARK, lenv,
} from '../../core/Layout.js';

export function drawBusStopRoof(g, p) {
  g.lineStyle(0);

  const s  = p.scale ?? 1;
  const rW = 800 * s, rH = 30 * s;
  const rX = p.x - rW / 2;
  const rY = p.roofTopY;

  // 1. Roof front — FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(rX, rY, rW, rH);
  g.endFill();

  // 2. Support pillars
  const pillarT = rY + rH;
  const pOff    = 325 * s;
  lenv(g, rY, 1.2);
  g.moveTo(p.x - pOff, pillarT); g.lineTo(p.x - pOff, p.pillarBottomY);
  g.moveTo(p.x + pOff, pillarT); g.lineTo(p.x + pOff, p.pillarBottomY);

  // 3. Outline (last)
  lenv(g, rY, 0.85);
  g.drawRect(rX, rY, rW, rH);
}

// ─── 自注册（Z-2d propRegistry）──────────────────────────────────────────────
// 注册写在本 draw 文件而非 busstop.js：后者 import PropEntity，
// 而 PropEntity import props.all barrel —— 放那儿会成环。
import { registerProp } from '../../core/propRegistry.js';
registerProp('busstop-roof', {
  draw: drawBusStopRoof,
  // 顶棚几何由 spawnBusStop 经 config 传入（y = 柱子落地点）
  config: ['roofW', 'roofH', 'roofTopY', 'pillarOffset', 'pillarBottomY'],
  // 横向 800·s（drawBusStopRoof 硬编码），纵向用实例绝对坐标
  bounds: (e, s) => {
    const hw  = 400 * s;
    const top = Math.min(e.roofTopY ?? e.y, e.y);
    const bot = Math.max(e.y, e.pillarBottomY ?? e.y);
    return { x: e.x - hw, y: top, width: hw * 2, height: Math.max(1, bot - top) };
  },
});
