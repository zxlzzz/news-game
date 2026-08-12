import { FILL_MID, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

/**
 * 候车亭顶棚。O-4 第一批转换，同时修掉几何表达方式：
 *
 * 旧版把顶棚位置写成两个**绝对世界 y**（`roofTopY` / `pillarBottomY`），竖直
 * 跨度靠两者相减得到——这是 O-2 之前"世界 y 就是屏幕 y"时代的写法，把高度和
 * 纵深混成了同一个量。接上真投影后必须拆开：`p.y` = 柱脚落地点（纵深量），
 * `p.roofClearH` = 棚底离地高度、`p.roofH` = 棚板厚度（都是平长度）。
 * 顺带修掉两个既有毛病（见 busstop.js 的常量注释）：
 *   - 远端站的 `pillarBottomY` 因 `stop.bayD` 未定义算出 NaN，整个顶棚画不出来；
 *   - 近端站的竖直跨度只有 60 骨架单位 ≈ 0.71 m，是"扁平视图看着对"的数字，
 *     当成真实高度就成了要爬进去的亭子。
 *
 * 棚板是悬空体块，走 drawObliqueBox 的 baseH 抬升；柱子是正面细节里的两条线。
 */
export function drawBusStopRoof(g, p) {
  g.lineStyle(0);

  const s     = p.scale ?? 1;
  const rW    = (p.roofW ?? 800) * s;
  const rH    = (p.roofH ?? 21) * s;
  const clear = p.roofClearH * s;              // 棚底离地高度
  const pOff  = (p.pillarOffset ?? 325) * s;
  const depth = PROP_DEPTH['busstop-roof'] * s;

  // 柱子先画，棚板后画压住柱顶
  const fg = frontFaceGraphics(g, p.x, p.y);
  lenv(fg, p.y, 1.2);
  fg.moveTo(p.x - pOff, p.y); fg.lineTo(p.x - pOff, p.y - clear);
  fg.moveTo(p.x + pOff, p.y); fg.lineTo(p.x + pOff, p.y - clear);

  drawObliqueBox(g, p.x, p.y, rW, depth, rH, FILL_MID, clear);
}

// ─── 自注册（Z-2d propRegistry）──────────────────────────────────────────────
// 注册写在本 draw 文件而非 busstop.js：后者 import PropEntity，
// 而 PropEntity import props.all barrel —— 放那儿会成环。
import { registerProp } from '../../core/propRegistry.js';
registerProp('busstop-roof', {
  draw: drawBusStopRoof,
  // 顶棚几何由 spawnBusStop 经 config 传入（y = 柱脚落地点，其余是高度/厚度）
  config: ['roofW', 'roofH', 'roofClearH', 'pillarOffset'],
  // 贴地竖直广告牌盒（语义见 Entity.getBounds()）：下沿贴柱脚地面线，
  // 高度 = 棚底离地 + 棚板厚度。
  bounds: (e, s) => {
    const hw = ((e.roofW ?? 800) / 2) * s;
    const h  = (e.roofClearH + (e.roofH ?? 21)) * s;
    return { x: e.x - hw, y: e.y - h, width: hw * 2, height: h };
  },
});
