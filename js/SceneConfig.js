/**
 * SceneConfig — 场景全局常量
 * 所有需要感知世界坐标的模块都从这里导入，避免分散的魔法数字。
 */

export const WORLD_WIDTH     = 2000;
export const WORLD_HEIGHT    = 500;

export const FAR_Y           = 252;   // 道路远端（NPC最小Y）
export const NEAR_Y          = 458;   // 道路近端（NPC最大Y）
export const BUILDING_BASE_Y = 130;   // 建筑临街底边Y

/** 远端人行道上 NPC 的典型 Y 坐标 */
export const SIDEWALK_FAR_Y  = 208;

/**
 * 按道路纵深分数换算世界 Y
 * @param {number} f  0 = 道路远端, 1 = 道路近端
 */
export const roadY = (f) => Math.round(FAR_Y + (NEAR_Y - FAR_Y) * f);

// ─── 纯黑白灰画风调色板 ──────────────────────────────────────────────────────
// 三层灰度纵深：远端浅灰薄线 / 中景中灰 / 近景深灰粗线

export const SHADE_BG       = 0xf0f0f0;  // 建筑后底色（最浅，近白）
export const SHADE_FAR      = 0xd8d8d8;  // 远端人行道
export const SHADE_FAR_ALT  = 0xcfcfcf;  // 远端微差异
export const SHADE_ROAD     = 0x8a8a8a;  // 道路中景
export const SHADE_NEAR     = 0xb4b4b4;  // 近端人行道
export const SHADE_CURB     = 0xe6e6e6;  // 路沿石

// 建筑灰阶（建筑都属远端，但有微差异制造层次）
export const BUILDING_FILL_LIGHT = 0xe0e0e0;
export const BUILDING_FILL_MID   = 0xd2d2d2;
export const BUILDING_FILL_DARK  = 0xbebebe;

export const LINE_FAR_COLOR  = 0x8a8a8a;
export const LINE_FAR_WIDTH  = 1;
export const LINE_MID_COLOR  = 0x4a4a4a;
export const LINE_MID_WIDTH  = 1.5;
export const LINE_NEAR_COLOR = 0x101010;
export const LINE_NEAR_WIDTH = 2.5;

/**
 * 按 Y 坐标插值出灰度颜色（纯黑白灰用）
 * 默认范围：Y=130（建筑底）→ 浅灰 0xa8 ；Y=470（近景） → 深灰 0x18
 */
export function depthGray(y, opts = {}) {
  const minY  = opts.minY  ?? BUILDING_BASE_Y;
  const maxY  = opts.maxY  ?? (NEAR_Y + 14);
  const light = opts.light ?? 0xa8;
  const dark  = opts.dark  ?? 0x18;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  const g = Math.round(light + (dark - light) * t);
  return (g << 16) | (g << 8) | g;
}

/** 取一种灰度对应的"线宽"（远薄近粗） */
export function depthLineWidth(y, opts = {}) {
  const minY  = opts.minY  ?? BUILDING_BASE_Y;
  const maxY  = opts.maxY  ?? (NEAR_Y + 14);
  const wMin  = opts.wMin  ?? 1;
  const wMax  = opts.wMax  ?? 2.5;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  return wMin + (wMax - wMin) * t;
}
