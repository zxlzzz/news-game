/** 街道标牌 — 不阻挡；Y 排序偏移 +9（贴墙时 y=BUILDING_BASE_Y-8，sortY=BUILDING_BASE_Y+1）。 */
export function footprint(_e) {
  return { shape: 'rect', rx: 0, ry: 0, blocks: false, sortDY: 9 };
}
