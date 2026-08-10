/**
 * Layout.js — 场景骨架参数（纵向分带 / 世界尺寸 / 颜色 / 深度辅助）
 *
 * 装饰性几何数据（树、云、广场、公交站）已迁移至 assets/scene.json 的 layout key。
 * 本文件只保留行为系统和渲染引擎共用的结构性参数。
 *
 * ─── 参数化（Z-2a）─────────────────────────────────────────────────────────
 * 世界尺寸、Y 分带是 `export let`，由 `initLayout(sceneData)` 从
 * scene.json 的 `world` / `yBands` 字段注入；此处字面量是 fallback 默认值。
 * 借 ES module live binding，`import { NEAR_Y }` 的站点无需改动即可看到注入后的值。
 *
 * 颜色仍是 `export const`：颜色是画风，不是场景结构，不参数化。
 *
 * ⚠️ live binding 的边界：注入发生在 `StreetScene.create()`，而所有模块的顶层代码
 * 早于它求值。因此**在模块顶层从这些值派生出的量会冻结在 fallback 默认值上**，
 * 不随注入更新。新增派生量请写成函数或在 init 之后计算，勿放模块顶层。
 * 原有三处冻结均已收口（世界可频繁重新生成、尺寸各异，冻结会导致导航/车道错位）：
 *   - `NavGrid.js` `COLS/ROWS`：改 fallback let + 构造函数按注入尺寸现算覆写。
 *   - `VehicleSpawner.js` `LANES`：改 `buildLanes()`，构造函数内现算。
 *   - `WaitForBusLayer.js` 原 `WAIT_ZONES`：随公交站坐标收口，构造函数内按 busStops 现算。
 *
 * ─── 世界单位（O-1）─────────────────────────────────────────────────────────
 * 世界坐标是骨架单位、各向同性（不再有随 y 变化的景深缩放坡——
 * 那套坡把纵深压扁成不到 12 米，且让 x/y 两个方向的"一米"不等长，见
 * docs/roadmap.md O-1 条目）。屏幕像素只在渲染最后一步经 PX_PER_UNIT 换算，
 * 是全项目唯一的屏幕缩放常量。
 */

// ─── 世界单位换算（O-1，唯一住址）───────────────────────────────────────────────
export const UNITS_PER_METER    = 84.70588;  // 骨架 144 单位 = 1.7 米
export const PX_PER_UNIT        = 0.388889;  // 人高 56px ÷ 144 单位；唯一的屏幕缩放常量
export const UNIT_REBASE_FACTOR = 5.294118;  // 迁移脚本用（旧世界像素 → 新骨架单位），落地后可删

// ─── 世界尺寸 ─────────────────────────────────────────────────────────────────
export let WORLD_WIDTH  = 10588;
export let WORLD_HEIGHT = 3072;

// ─── 纵向分带边界 ─────────────────────────────────────────────────────────────
export let SKY_Y           = 333;
export let BUILDING_BASE_Y = 700;
export let FAR_Y           = 1166;
export let NEAR_Y          = 1928;
export let PARK_TOP        = 2098;
export let PARK_BOTTOM     = WORLD_HEIGHT;

// 非机动车道边界
export let BIKE_LANE_FAR_TOP     = 996;
export let BIKE_LANE_FAR_BOTTOM  = 1166;
export let BIKE_LANE_NEAR_TOP    = 1928;
export let BIKE_LANE_NEAR_BOTTOM = 2098;

// 步行带（NPC 典型 Y）
export let SIDEWALK_FAR_Y  = 934;
export let SIDEWALK_NEAR_Y = 3014;

// ─── Y 分带符号解析（数据驱动配置用）─────────────────────────────────────────
// scene.json 的 zones / ground 用分带**名字**表达边界（`"to": "FAR_Y"`），
// 数值仍只有 yBands 一处；此处 getter 每次调用读模块变量，故注入后自动生效。

const _Y_BAND_GETTERS = {
  SKY_Y:                 () => SKY_Y,
  BUILDING_BASE_Y:       () => BUILDING_BASE_Y,
  SIDEWALK_FAR_Y:        () => SIDEWALK_FAR_Y,
  BIKE_LANE_FAR_TOP:     () => BIKE_LANE_FAR_TOP,
  BIKE_LANE_FAR_BOTTOM:  () => BIKE_LANE_FAR_BOTTOM,
  FAR_Y:                 () => FAR_Y,
  NEAR_Y:                () => NEAR_Y,
  BIKE_LANE_NEAR_TOP:    () => BIKE_LANE_NEAR_TOP,
  BIKE_LANE_NEAR_BOTTOM: () => BIKE_LANE_NEAR_BOTTOM,
  PARK_TOP:              () => PARK_TOP,
  SIDEWALK_NEAR_Y:       () => SIDEWALK_NEAR_Y,
  PARK_BOTTOM:           () => PARK_BOTTOM,
};

/** 合法 yBands 键名（initLayout 校验 + 静态检查用） */
export const Y_BAND_NAMES = Object.keys(_Y_BAND_GETTERS);

/**
 * 解析 Y 坐标：数字原样返回，字符串按 yBands 名查当前值。
 * 未知名字直接抛错——配置拼写错误应在场景加载时炸掉，不该静默变 undefined。
 */
export function resolveY(v) {
  if (typeof v === 'number') return v;
  const get = _Y_BAND_GETTERS[v];
  if (!get) throw new Error(`Layout.resolveY: unknown Y band name '${v}'`);
  return get();
}

// ─── 区域内插值辅助函数 ───────────────────────────────────────────────────────
// 函数体每次调用时读模块变量，故注入后自动生效。

export const roadY = (f) => Math.round(FAR_Y + (NEAR_Y - FAR_Y) * f);
export const worldX = (f) => Math.round(WORLD_WIDTH * f);
export const bikeLaneFarY  = (f) => Math.round(BIKE_LANE_FAR_TOP  + (BIKE_LANE_FAR_BOTTOM  - BIKE_LANE_FAR_TOP)  * f);
export const bikeLaneNearY = (f) => Math.round(BIKE_LANE_NEAR_TOP + (BIKE_LANE_NEAR_BOTTOM - BIKE_LANE_NEAR_TOP) * f);

// ─── 统一填充色阶（4 档，全场景 draw 文件共用，禁止额外随手灰） ──────────────────
// 目标：从亮到暗四档，眯眼可分辨四个层次
//   天空/天际线 > FILL_PAPER(建筑立面) > FILL_LIGHT(窗/玻璃) > FILL_MID(屋顶/雨棚)
//   > 地面(GRAY_*) ≈ FILL_SHADE > NPC(最深)
export const FILL_PAPER = 0xd8d8d8;   // 建筑立面底色（LIGHT-MID 区间上沿）
export const FILL_LIGHT = 0xc4c4c4;   // 窗户、玻璃面（立面内次级）
export const FILL_MID   = 0xaaaaaa;   // 屋顶、门楣、雨棚（中灰）
export const FILL_SHADE = 0x888888;   // 最深环境填充：门板、百叶格

// ─── 环境线颜色参数（比 NPC 浅一档，与 depthLineColor 配合使用） ──────────────
export const ENV_LINE_LIGHT = 0x90;
export const ENV_LINE_DARK  = 0x40;

// ─── 天空 / 地平线明度带（SceneRenderer 用） ──────────────────────────────────
export const SKY_COLOR_TOP    = 0xf9f9f9;   // 天空顶端
export const SKY_COLOR_HOR    = 0xe8e8e4;   // 近地平线（轻微暖色）
export const FOG_COLOR        = 0xffffff;   // 地平线雾霭
export const FOG_ALPHA        = 0.28;       // 雾霭透明度

// ─── 纯黑白灰画风调色板 ───────────────────────────────────────────────────────

export const GRAY_SKY         = 0xf4f4f4;   // 天空（保持最亮）
export const GRAY_FAR_PAVE    = 0xcccccc;   // 远端人行道（was 0xe2，压 MID 上方）
export const GRAY_BUILDING_HI = 0xdadada;
export const GRAY_BUILDING_MID= 0xc8c8c8;
export const GRAY_BUILDING_LO = 0xb4b4b4;
export const GRAY_ROAD        = 0x888888;   // 路面（was 0x9a，比人行道深，≈ FILL_SHADE）
export const GRAY_NEAR_PAVE   = 0xb0b0b0;   // 近端人行道（was 0xbc）
export const GRAY_CURB        = 0xd8d8d8;   // 路缘石（was 0xe8，略亮于 FAR_PAVE）
export const GRAY_PARK        = 0xaaaaaa;   // 公园地面（≈ FILL_MID）
export const CURB_EDGE_LINE   = 0x7a7a7a;   // 路缘上边缘线（介于 FAR/MID 线色之间）
export const MARKING_PAINT    = 0xffffff;   // 车道虚线 / 斑马线条纹漆色（E-1）

// ─── 天际线 / 云（SceneRenderer 用） ──────────────────────────────────────────
export const SKYLINE_BACK  = 0xf1f1f1;
export const SKYLINE_FRONT = 0xe6e6e6;
export const SKYLINE_LINE  = 0xd6d6d6;
export const CLOUD_LINE    = 0xd2d2d2;

// O-1：容器整体乘 PX_PER_UNIT 渲染，线宽须先除以 PX_PER_UNIT 补偿，
// 否则会细到 <1px 而消失。数值 = 旧世界像素值 / PX_PER_UNIT。
export const LINE_FAR_WIDTH  = 2.06;
export const LINE_NEAR_COLOR = 0x1f1f1f;
export const LINE_NEAR_WIDTH = 5.66;

// ─── 调色板符号解析（数据驱动配置用）─────────────────────────────────────────
// scene.json 的 ground 用颜色**名字**（`"color": "GRAY_ROAD"`）而非 hex：
// 场景配置说「这条带用路面色」，具体是哪个灰仍由本文件说了算——画风不外流。

const _PALETTE = {
  FILL_PAPER, FILL_LIGHT, FILL_MID, FILL_SHADE,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
  SKY_COLOR_TOP, SKY_COLOR_HOR, FOG_COLOR,
  GRAY_SKY, GRAY_FAR_PAVE, GRAY_BUILDING_HI, GRAY_BUILDING_MID, GRAY_BUILDING_LO,
  GRAY_ROAD, GRAY_NEAR_PAVE, GRAY_CURB, GRAY_PARK, CURB_EDGE_LINE, MARKING_PAINT,
  SKYLINE_BACK, SKYLINE_FRONT, SKYLINE_LINE, CLOUD_LINE, LINE_NEAR_COLOR,
};

/** 合法调色板名（静态检查用） */
export const PALETTE_NAMES = Object.keys(_PALETTE);

/** 解析颜色：数字原样返回，字符串按调色板名查；未知名抛错 */
export function resolveColor(v) {
  if (typeof v === 'number') return v;
  const c = _PALETTE[v];
  if (c == null) throw new Error(`Layout.resolveColor: unknown palette name '${v}'`);
  return c;
}

// ─── 深度辅助函数（画风，非几何缩放）───────────────────────────────────────────
// O-1 删掉了随 y 变化的屏幕缩放坡：世界坐标各向同性，不再有近大远小。
// depthT 现在只喂 depthGray/depthLineWidth/depthLineColor 三个画风消费者
// （"远处偏灰、线更细"），在 [BUILDING_BASE_Y, PARK_BOTTOM] 上线性。

/** Y 坐标 → 景深参数 t∈[0,1]（线性，0=最远，1=最近） */
export function depthT(y) {
  if (y <= BUILDING_BASE_Y) return 0;
  if (y >= PARK_BOTTOM)     return 1;
  return (y - BUILDING_BASE_Y) / (PARK_BOTTOM - BUILDING_BASE_Y);
}

export function depthGray(y, opts = {}) {
  const light = opts.light ?? 0xb0;
  const dark  = opts.dark  ?? 0x2c;
  const g = Math.round(light + (dark - light) * depthT(y));
  return (g << 16) | (g << 8) | g;
}

/** wMin/wMax 默认值已按 O-1 除以 PX_PER_UNIT 补偿容器缩放（见 LINE_FAR/NEAR_WIDTH 注释） */
export function depthLineWidth(y, opts = {}) {
  const wMin = opts.wMin ?? 2.06;
  const wMax = opts.wMax ?? 5.66;
  return wMin + (wMax - wMin) * depthT(y);
}

export function depthLineColor(y, opts = {}) {
  const light = opts.light ?? 0x80;
  const dark  = opts.dark  ?? 0x10;
  const v = Math.round(light + (dark - light) * depthT(y));
  return (v << 16) | (v << 8) | v;
}

/**
 * lenv — 环境线统一 lineStyle 辅助（O-1 收编：原 28 份文件内各自复制的同一份
 * 实现，现在唯一住址在此）。设置 g.lineStyle 并返回线色供调用方复用 stroke。
 */
export function lenv(g, baseY, wScale = 1.0) {
  // wMin/wMax 是旧世界像素覆盖值 0.5/1.3 按 O-1 除以 PX_PER_UNIT 补偿容器缩放。
  const lw = depthLineWidth(baseY, { wMin: 1.29, wMax: 3.34 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

// ─── 场景注入 ─────────────────────────────────────────────────────────────────

/**
 * 从 scene config 注入布局参数。必须在任何 entity 创建 / 场景绘制之前调用一次
 * （`StreetScene.create()` 内，SceneRenderer / SceneInitializer 之前）。
 *
 * 缺字段即保留上方的 fallback 默认值——config 是覆盖，不是全量替换。
 *
 * @param {{world?:{width,height}, yBands?:Object<string,number>}} config
 */
export function initLayout(config) {
  if (!config) return;

  if (config.world) {
    WORLD_WIDTH  = config.world.width  ?? WORLD_WIDTH;
    WORLD_HEIGHT = config.world.height ?? WORLD_HEIGHT;
  }

  if (config.yBands) {
    const b = config.yBands;
    for (const k of Object.keys(b)) {
      if (!_Y_BAND_GETTERS[k]) throw new Error(`initLayout: unknown yBands key '${k}'`);
    }
    SKY_Y                 = b.SKY_Y                 ?? SKY_Y;
    BUILDING_BASE_Y       = b.BUILDING_BASE_Y       ?? BUILDING_BASE_Y;
    SIDEWALK_FAR_Y        = b.SIDEWALK_FAR_Y        ?? SIDEWALK_FAR_Y;
    BIKE_LANE_FAR_TOP     = b.BIKE_LANE_FAR_TOP     ?? BIKE_LANE_FAR_TOP;
    BIKE_LANE_FAR_BOTTOM  = b.BIKE_LANE_FAR_BOTTOM  ?? BIKE_LANE_FAR_BOTTOM;
    FAR_Y                 = b.FAR_Y                 ?? FAR_Y;
    NEAR_Y                = b.NEAR_Y                ?? NEAR_Y;
    BIKE_LANE_NEAR_TOP    = b.BIKE_LANE_NEAR_TOP    ?? BIKE_LANE_NEAR_TOP;
    BIKE_LANE_NEAR_BOTTOM = b.BIKE_LANE_NEAR_BOTTOM ?? BIKE_LANE_NEAR_BOTTOM;
    PARK_TOP              = b.PARK_TOP              ?? PARK_TOP;
    SIDEWALK_NEAR_Y       = b.SIDEWALK_NEAR_Y       ?? SIDEWALK_NEAR_Y;
    PARK_BOTTOM           = b.PARK_BOTTOM           ?? PARK_BOTTOM;
  }
}
