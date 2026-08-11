/** 街道标牌 — 不阻挡；Y 排序偏移 +9（贴墙时 y=BUILDING_BASE_Y-8，sortY=BUILDING_BASE_Y+1）。 */
export function footprint(_e) {
  return { shape: 'rect', rx: 0, ry: 0, blocks: false, sortDY: 9 };
}

// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawSign } from './drawSign.js';
// 有 footprint（sortDY +9）但 **不阻挡**：不在 Z-2d 前的 OBSTACLE_TYPES 集合里
registerProp('sign', { draw: drawSign, footprint, obstacle: false });
