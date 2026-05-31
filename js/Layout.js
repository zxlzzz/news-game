/**
 * Layout.js — 场景骨架常量（纵向分带 / 世界尺寸 / 颜色 / 深度辅助）
 *
 * 装饰性几何数据（树、云、广场、公交站）已迁移至 assets/scene.json 的 layout key。
 * 本文件只保留行为系统和渲染引擎共用的结构性常量。
 */

// ─── 世界尺寸 ─────────────────────────────────────────────────────────────────
export const WORLD_WIDTH  = 2000;
export const WORLD_HEIGHT = 520;

// ─── 纵向分带边界 ─────────────────────────────────────────────────────────────
export const SKY_Y           = 100;
export const BUILDING_BASE_Y = 210;
export const FAR_Y           = 268;
export const NEAR_Y          = 333;
export const PARK_TOP        = 353;
export const PARK_BOTTOM     = WORLD_HEIGHT;

// 非机动车道边界
export const BIKE_LANE_FAR_TOP     = 248;
export const BIKE_LANE_FAR_BOTTOM  = 268;
export const BIKE_LANE_NEAR_TOP    = 333;
export const BIKE_LANE_NEAR_BOTTOM = 353;

// 步行带（NPC 典型 Y）
export const SIDEWALK_FAR_Y  = 240;
export const SIDEWALK_NEAR_Y = 508;

// ─── 区域内插值辅助函数 ───────────────────────────────────────────────────────

export const roadY = (f) => Math.round(FAR_Y + (NEAR_Y - FAR_Y) * f);
export const sidewalkFarY = (f) => Math.round(BUILDING_BASE_Y + (FAR_Y - BUILDING_BASE_Y) * f);
export const parkY = (f) => Math.round(PARK_TOP + (PARK_BOTTOM - PARK_TOP) * f);
export const worldX = (f) => Math.round(WORLD_WIDTH * f);
export const bikeLaneFarY  = (f) => Math.round(BIKE_LANE_FAR_TOP  + (BIKE_LANE_FAR_BOTTOM  - BIKE_LANE_FAR_TOP)  * f);
export const bikeLaneNearY = (f) => Math.round(BIKE_LANE_NEAR_TOP + (BIKE_LANE_NEAR_BOTTOM - BIKE_LANE_NEAR_TOP) * f);

// ─── 建筑出口 X（行为系统 ExitRegistry 用） ──────────────────────────────────
export const BUILDING_EXIT_XS = [
  worldX(0.10),   // building_a ≈ 200
  worldX(0.30),   // building_b ≈ 600
  worldX(0.55),   // building_c ≈ 1100
  worldX(0.85),   // building_d ≈ 1700
];

// ─── 纯黑白灰画风调色板 ───────────────────────────────────────────────────────

export const GRAY_SKY         = 0xf4f4f4;
export const GRAY_FAR_PAVE    = 0xe2e2e2;
export const GRAY_BUILDING_HI = 0xdadada;
export const GRAY_BUILDING_MID= 0xc8c8c8;
export const GRAY_BUILDING_LO = 0xb4b4b4;
export const GRAY_ROAD        = 0x9a9a9a;
export const GRAY_NEAR_PAVE   = 0xbcbcbc;
export const GRAY_CURB        = 0xe8e8e8;

export const LINE_FAR_COLOR  = 0x9a9a9a;
export const LINE_FAR_WIDTH  = 0.8;
export const LINE_MID_COLOR  = 0x5a5a5a;
export const LINE_MID_WIDTH  = 1.4;
export const LINE_NEAR_COLOR = 0x1f1f1f;
export const LINE_NEAR_WIDTH = 2.2;

// 兼容旧名
export const SHADE_BG            = GRAY_SKY;
export const SHADE_FAR           = GRAY_FAR_PAVE;
export const SHADE_FAR_ALT       = GRAY_BUILDING_MID;
export const SHADE_ROAD          = GRAY_ROAD;
export const SHADE_NEAR          = GRAY_NEAR_PAVE;
export const SHADE_CURB          = GRAY_CURB;
export const BUILDING_FILL_LIGHT = GRAY_BUILDING_HI;
export const BUILDING_FILL_MID   = GRAY_BUILDING_MID;
export const BUILDING_FILL_DARK  = GRAY_BUILDING_LO;

// ─── 深度辅助函数 ─────────────────────────────────────────────────────────────

export function depthGray(y, opts = {}) {
  const minY  = opts.minY  ?? BUILDING_BASE_Y;
  const maxY  = opts.maxY  ?? PARK_BOTTOM;
  const light = opts.light ?? 0xb0;
  const dark  = opts.dark  ?? 0x2c;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  const g = Math.round(light + (dark - light) * t);
  return (g << 16) | (g << 8) | g;
}

export function depthLineWidth(y, opts = {}) {
  const minY = opts.minY ?? BUILDING_BASE_Y;
  const maxY = opts.maxY ?? PARK_BOTTOM;
  const wMin = opts.wMin ?? 0.8;
  const wMax = opts.wMax ?? 2.2;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  return wMin + (wMax - wMin) * t;
}

export function depthLineColor(y, opts = {}) {
  const minY = opts.minY ?? BUILDING_BASE_Y;
  const maxY = opts.maxY ?? PARK_BOTTOM;
  const light = opts.light ?? 0x80;
  const dark  = opts.dark  ?? 0x10;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  const v = Math.round(light + (dark - light) * t);
  return (v << 16) | (v << 8) | v;
}
