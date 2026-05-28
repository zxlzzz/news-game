/**
 * Layout.js — 场景几何的唯一真值来源
 *
 * 所有硬编码坐标/几何常量集中在此。其他模块通过 SceneConfig.js（re-export）导入，
 * 现有 import 路径无需修改。
 */

// ─── 世界尺寸 ─────────────────────────────────────────────────────────────────
export const WORLD_WIDTH  = 2000;
export const WORLD_HEIGHT = 500;

// ─── 纵向分带边界（轻微俯视 2.5D ~30°，Y 越大越靠近镜头）────────────────────
//   天空       0  – 100   纯装饰（蓝天白云→灰度，视差层）
//   建筑街墙 100  – 210   连续街墙
//   建筑前人行道 210 – 268 前人行道：行人/树/邮箱/售货机
//   双行道   268  – 333   机动车
//   公园广场 333  – 500   NPC 主活动区
export const SKY_Y           = 100;   // 天空区底边
export const BUILDING_BASE_Y = 210;   // 建筑街墙底边（= 前人行道顶边）
export const FAR_Y           = 268;   // 前人行道 / 道路 分界（curb）
export const NEAR_Y          = 333;   // 道路 / 公园 分界（curb）
export const PARK_TOP        = 333;   // 公园广场顶边
export const PARK_BOTTOM     = WORLD_HEIGHT;

// 步行带（NPC 典型 Y）
export const SIDEWALK_FAR_Y  = 240;   // 建筑前人行道步行 Y
export const SIDEWALK_NEAR_Y = 488;   // 公园主步行 Y（近镜头）

// ─── 区域内插值辅助函数 ───────────────────────────────────────────────────────

/** 道路纵深，f=0 远端，f=1 近端 */
export const roadY = (f) => Math.round(FAR_Y + (NEAR_Y - FAR_Y) * f);

/** 建筑前人行道纵深，f=0 靠建筑，f=1 靠路沿 */
export const sidewalkFarY = (f) => Math.round(BUILDING_BASE_Y + (FAR_Y - BUILDING_BASE_Y) * f);

/** 公园纵深，f=0 上沿，f=1 下沿 */
export const parkY = (f) => Math.round(PARK_TOP + (PARK_BOTTOM - PARK_TOP) * f);

/** 横向相对位置，f=0 左边，f=1 右边 */
export const worldX = (f) => Math.round(WORLD_WIDTH * f);

// ─── 场景几何具名常量 ─────────────────────────────────────────────────────────

/** 云朵：[worldX, y, scale] */
export const CLOUD_POSITIONS = [
  [worldX(0.09), 38, 1.0],
  [worldX(0.28), 26, 0.8],
  [worldX(0.50), 46, 1.15],
  [worldX(0.75), 30, 0.9],
  [worldX(0.92), 40, 1.0],
];

/** 建筑前人行道行道树 X 列表 */
export const SIDEWALK_TREE_XS = [
  0.086, 0.164, 0.241, 0.396, 0.474, 0.551,
  0.629, 0.706, 0.784, 0.861, 0.939,
].map(worldX);

/** 建筑前人行道行道树基线 Y（路沿石前方） */
export const SIDEWALK_TREE_Y = FAR_Y - 12;   // = 256

/** 公园后排树 X 列表 */
export const PARK_TREE_XS = [0.06, 0.15, 0.235, 0.49, 0.58, 0.82, 0.91, 0.98].map(worldX);

/** 公园后排树基线 Y */
export const PARK_TREE_Y = PARK_TOP + 17;    // = 350

/** 道路中心虚线：间距 / 线段长 */
export const ROAD_STRIPE_SPACING = 56;
export const ROAD_STRIPE_LENGTH  = 28;

/** 建筑出口 X（ExitRegistry 用） */
export const BUILDING_EXIT_XS = [
  worldX(0.10),   // building_a ≈ 200
  worldX(0.30),   // building_b ≈ 600
  worldX(0.55),   // building_c ≈ 1100
  worldX(0.85),   // building_d ≈ 1700
];

/** 公交站 X（Vehicles.js + StreetScene._drawBusStops 用） */
export const BUS_STOP_XS = [worldX(0.20), worldX(0.80)];

/** 棋摊广场（棋桌置于其中心，StreetScene 画图与 Chess 定位共用） */
export const CHESS_PLAZA = { cx: worldX(0.31), cy: parkY(0.52), rx: 130, ry: 56 };

/** 大公园内的"小公园"游园区（喷泉居中） */
export const MINI_PARK = { cx: worldX(0.575), cy: parkY(0.58), rx: 210, ry: 78 };

// ─── 纯黑白灰画风调色板 ───────────────────────────────────────────────────────

export const GRAY_SKY         = 0xf4f4f4;   // 建筑后底色（最浅，近白）
export const GRAY_FAR_PAVE    = 0xe2e2e2;   // 远端人行道
export const GRAY_BUILDING_HI = 0xdadada;   // 建筑亮色
export const GRAY_BUILDING_MID= 0xc8c8c8;   // 建筑中色
export const GRAY_BUILDING_LO = 0xb4b4b4;   // 建筑深色
export const GRAY_ROAD        = 0x9a9a9a;   // 道路
export const GRAY_NEAR_PAVE   = 0xbcbcbc;   // 近端人行道
export const GRAY_CURB        = 0xe8e8e8;   // 路沿石

// 线条三档：远（薄浅）/ 中 / 近（粗深）
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

/** 按 Y 坐标插值灰度颜色（纯黑白灰用） */
export function depthGray(y, opts = {}) {
  const minY  = opts.minY  ?? BUILDING_BASE_Y;
  const maxY  = opts.maxY  ?? PARK_BOTTOM;
  const light = opts.light ?? 0xb0;
  const dark  = opts.dark  ?? 0x2c;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  const g = Math.round(light + (dark - light) * t);
  return (g << 16) | (g << 8) | g;
}

/** 按 Y 取线宽（远薄近粗） */
export function depthLineWidth(y, opts = {}) {
  const minY = opts.minY ?? BUILDING_BASE_Y;
  const maxY = opts.maxY ?? PARK_BOTTOM;
  const wMin = opts.wMin ?? 0.8;
  const wMax = opts.wMax ?? 2.2;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  return wMin + (wMax - wMin) * t;
}

/** 按 Y 取线条颜色（远浅近深） */
export function depthLineColor(y, opts = {}) {
  const minY = opts.minY ?? BUILDING_BASE_Y;
  const maxY = opts.maxY ?? PARK_BOTTOM;
  const light = opts.light ?? 0x80;
  const dark  = opts.dark  ?? 0x10;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  const v = Math.round(light + (dark - light) * t);
  return (v << 16) | (v << 8) | v;
}
