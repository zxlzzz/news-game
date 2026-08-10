/** 落地接触面半宽/半深 — 对应 drawFountainPool 的 outerRx/outerRy */
export function footprint(e) {
  const rx = 300 * (e.scale ?? 1) * 0.775;
  return { shape: 'ellipse', rx, ry: rx * 0.5, blocks: true, sortDY: 0 };
}

// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawFountainPool, drawFountainNozzle } from './drawFountain.js';
registerProp('fountain', {
  draw:       drawFountainNozzle,   // 主通道：喷嘴 + 水柱
  drawGround: drawFountainPool,     // 地面预通道：水池（贴地，Y 排序前）
  footprint,
  obstacle:   true,
  // 300·0.775 半宽；喷柱顶 −outerRy·1.1；池底 +outerRy（数值源 = drawFountain 内硬编码尺寸）
  visual:     { hw: 232.5, up: 128, down: 116 },
});
