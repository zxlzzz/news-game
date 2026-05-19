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

// ─── 纯黑白灰画风调色板（8 档灰度，由远到近递减） ────────────────────────────
// 远到近：sky / far-roof / far-pave / building / road / near-pave / mid / near
// 数字越小（越深）= 越靠近镜头

export const GRAY_SKY        = 0xf4f4f4;  // 建筑后底色（最浅，近白）
export const GRAY_FAR_PAVE   = 0xe2e2e2;  // 远端人行道
export const GRAY_BUILDING_HI = 0xdadada; // 建筑亮色
export const GRAY_BUILDING_MID= 0xc8c8c8; // 建筑中色
export const GRAY_BUILDING_LO = 0xb4b4b4; // 建筑深色
export const GRAY_ROAD        = 0x9a9a9a; // 道路
export const GRAY_NEAR_PAVE   = 0xbcbcbc; // 近端人行道
export const GRAY_CURB        = 0xe8e8e8; // 路沿石

// 线条三档：远（薄浅）/ 中 / 近（粗深）
export const LINE_FAR_COLOR  = 0x9a9a9a;
export const LINE_FAR_WIDTH  = 0.8;
export const LINE_MID_COLOR  = 0x5a5a5a;
export const LINE_MID_WIDTH  = 1.4;
export const LINE_NEAR_COLOR = 0x1f1f1f;
export const LINE_NEAR_WIDTH = 2.2;

// 兼容旧名（防误改）
export const SHADE_BG  = GRAY_SKY;
export const SHADE_FAR = GRAY_FAR_PAVE;
export const SHADE_FAR_ALT = GRAY_BUILDING_MID;
export const SHADE_ROAD = GRAY_ROAD;
export const SHADE_NEAR = GRAY_NEAR_PAVE;
export const SHADE_CURB = GRAY_CURB;
export const BUILDING_FILL_LIGHT = GRAY_BUILDING_HI;
export const BUILDING_FILL_MID   = GRAY_BUILDING_MID;
export const BUILDING_FILL_DARK  = GRAY_BUILDING_LO;

/**
 * 按 Y 坐标插值出灰度颜色（纯黑白灰用）
 * 默认范围：Y=130（建筑底）→ 浅灰 0xb0 ；Y=470（近景） → 深灰 0x2c
 */
export function depthGray(y, opts = {}) {
  const minY  = opts.minY  ?? BUILDING_BASE_Y;
  const maxY  = opts.maxY  ?? (NEAR_Y + 14);
  const light = opts.light ?? 0xb0;
  const dark  = opts.dark  ?? 0x2c;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  const g = Math.round(light + (dark - light) * t);
  return (g << 16) | (g << 8) | g;
}

/** 按 Y 取线宽（远薄近粗） */
export function depthLineWidth(y, opts = {}) {
  const minY = opts.minY ?? BUILDING_BASE_Y;
  const maxY = opts.maxY ?? (NEAR_Y + 14);
  const wMin = opts.wMin ?? 0.8;
  const wMax = opts.wMax ?? 2.2;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  return wMin + (wMax - wMin) * t;
}

/** 按 Y 取线条颜色（远浅近深） */
export function depthLineColor(y, opts = {}) {
  const minY = opts.minY ?? BUILDING_BASE_Y;
  const maxY = opts.maxY ?? (NEAR_Y + 14);
  const light = opts.light ?? 0x80;
  const dark  = opts.dark  ?? 0x10;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  const v = Math.round(light + (dark - light) * t);
  return (v << 16) | (v << 8) | v;
}
