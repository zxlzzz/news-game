/**
 * Layout.js — 场景骨架参数（纵向分带 / 世界尺寸 / 颜色 / 深度辅助）
 *
 * 装饰性几何数据（树、云、广场、公交站）已迁移至 assets/scene.json 的 layout key。
 * 本文件只保留行为系统和渲染引擎共用的结构性参数。
 *
 * ─── 参数化（Z-2a）─────────────────────────────────────────────────────────
 * 世界尺寸、Y 分带、深度锚点是 `export let`，由 `initLayout(sceneData)` 从
 * scene.json 的 `world` / `yBands` / `depth` 字段注入；此处字面量是 fallback 默认值。
 * 借 ES module live binding，`import { NEAR_Y }` 的站点无需改动即可看到注入后的值。
 *
 * 颜色仍是 `export const`：颜色是画风，不是场景结构，不参数化。
 *
 * ⚠️ live binding 的边界：注入发生在 `StreetScene.create()`，而所有模块的顶层代码
 * 早于它求值。因此**在模块顶层从这些值派生出的量会冻结在 fallback 默认值上**，
 * 不随注入更新。现存三处（Z-2a 时注入值与默认值相同，故无行为差异，但改值前必须处理）：
 *   - `NavGrid.js` `COLS/ROWS`（由 WORLD_WIDTH/HEIGHT 算格数）
 *   - `VehicleSpawner.js` `LANES`（roadY() / WORLD_WIDTH）
 *   - `WaitForBusLayer.js` `WAIT_ZONES`（SIDEWALK_FAR_Y / BIKE_LANE_FAR_TOP / PARK_TOP）
 * 新增派生量请写成函数或在 init 之后计算，勿放模块顶层。
 */

// ─── 世界尺寸 ─────────────────────────────────────────────────────────────────
export let WORLD_WIDTH  = 2000;
export let WORLD_HEIGHT = 520;

// ─── 纵向分带边界 ─────────────────────────────────────────────────────────────
export let SKY_Y           = 100;
export let BUILDING_BASE_Y = 210;
export let FAR_Y           = 268;
export let NEAR_Y          = 333;
export let PARK_TOP        = 353;
export let PARK_BOTTOM     = WORLD_HEIGHT;

// 非机动车道边界
export let BIKE_LANE_FAR_TOP     = 248;
export let BIKE_LANE_FAR_BOTTOM  = 268;
export let BIKE_LANE_NEAR_TOP    = 333;
export let BIKE_LANE_NEAR_BOTTOM = 353;

// 步行带（NPC 典型 Y）
export let SIDEWALK_FAR_Y  = 240;
export let SIDEWALK_NEAR_Y = 508;

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

// ─── 建筑出口 X（行为系统 ExitRegistry 用） ──────────────────────────────────
// 依赖 WORLD_WIDTH，initLayout 末尾就地重算（保持数组身份不变，供已持有引用者）
export let BUILDING_EXIT_XS = [
  worldX(0.10),   // building_a ≈ 200
  worldX(0.30),   // building_b ≈ 600
  worldX(0.55),   // building_c ≈ 1100
  worldX(0.85),   // building_d ≈ 1700
];

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

// ─── 天际线 / 云（SceneRenderer 用） ──────────────────────────────────────────
export const SKYLINE_BACK  = 0xf1f1f1;
export const SKYLINE_FRONT = 0xe6e6e6;
export const SKYLINE_LINE  = 0xd6d6d6;
export const CLOUD_LINE    = 0xd2d2d2;

export const LINE_FAR_WIDTH  = 0.8;
export const LINE_NEAR_COLOR = 0x1f1f1f;
export const LINE_NEAR_WIDTH = 2.2;

// ─── 深度辅助函数 ─────────────────────────────────────────────────────────────

// 分段锚点：[y, t]。y 范围外夹取到 [0,1]。由 initLayout 从 config.depth.anchors 覆盖。
let _SEG = [
  [BUILDING_BASE_Y, 0.00],
  [FAR_Y,           0.30],
  [NEAR_Y,          0.50],
  [PARK_TOP,        0.55],
  [PARK_BOTTOM,     1.00],
];

/** Y 坐标 → 景深参数 t∈[0,1]（分段线性，0=最远，1=最近） */
export function depthT(y) {
  if (y <= BUILDING_BASE_Y) return 0;
  if (y >= PARK_BOTTOM)     return 1;
  for (let i = 1; i < _SEG.length; i++) {
    const [y0, t0] = _SEG[i - 1];
    const [y1, t1] = _SEG[i];
    if (y <= y1) return t0 + (y - y0) / (y1 - y0) * (t1 - t0);
  }
  return 1;
}

export function depthGray(y, opts = {}) {
  const light = opts.light ?? 0xb0;
  const dark  = opts.dark  ?? 0x2c;
  const g = Math.round(light + (dark - light) * depthT(y));
  return (g << 16) | (g << 8) | g;
}

export function depthLineWidth(y, opts = {}) {
  const wMin = opts.wMin ?? 0.8;
  const wMax = opts.wMax ?? 2.2;
  return wMin + (wMax - wMin) * depthT(y);
}

export function depthLineColor(y, opts = {}) {
  const light = opts.light ?? 0x80;
  const dark  = opts.dark  ?? 0x10;
  const v = Math.round(light + (dark - light) * depthT(y));
  return (v << 16) | (v << 8) | v;
}

let _FAR_SCALE  = 0.182;
let _NEAR_SCALE = 0.434;

/** Y → screen scale */
export function depthScale(y) {
  return _FAR_SCALE + depthT(y) * (_NEAR_SCALE - _FAR_SCALE);
}

// ─── 场景注入 ─────────────────────────────────────────────────────────────────

/**
 * 从 scene config 注入布局参数。必须在任何 entity 创建 / 场景绘制之前调用一次
 * （`StreetScene.create()` 内，SceneRenderer / SceneInitializer 之前）。
 *
 * 缺字段即保留上方的 fallback 默认值——config 是覆盖，不是全量替换。
 *
 * @param {{world?:{width,height}, yBands?:Object<string,number>,
 *          depth?:{anchors:Array<[number,number]>, scaleFar?:number, scaleNear?:number}}} config
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

  if (config.depth) {
    if (config.depth.anchors) _SEG = config.depth.anchors.map(([y, t]) => [y, t]);
    _FAR_SCALE  = config.depth.scaleFar  ?? _FAR_SCALE;
    _NEAR_SCALE = config.depth.scaleNear ?? _NEAR_SCALE;
  }

  // 依赖 WORLD_WIDTH 的派生量：就地重算（不重建数组，保持引用身份）
  BUILDING_EXIT_XS[0] = worldX(0.10);
  BUILDING_EXIT_XS[1] = worldX(0.30);
  BUILDING_EXIT_XS[2] = worldX(0.55);
  BUILDING_EXIT_XS[3] = worldX(0.85);
}
