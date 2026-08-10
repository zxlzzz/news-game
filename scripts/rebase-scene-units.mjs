#!/usr/bin/env node
/**
 * rebase-scene-units.mjs — 一次性迁移脚本（O-1 世界单位重标）
 *
 * 把 assets/scene.json 从"屏幕像素 + 随 y 变化的景深缩放坡"坐标系
 * 原地重写成"骨架单位、各向同性"坐标系。数值换算见 tasks.md O-1 条目 /
 * docs/roadmap.md O-1 条目。运行一次即可，落地后本脚本保留在仓库供复核，
 * 不再被其他代码引用。
 *
 * 用法：node scripts/rebase-scene-units.mjs
 *
 * 换算规则（按字段语义分类，非盲目按字段名匹配——道具 w/h、树冠半径 r 等
 * "尺寸"字段刻意不缩放，见下方 NOTE-PROPS）：
 *   x 类（位置横坐标）      × UNIT_REBASE_FACTOR(5.294118)，四舍五入取整
 *   y 类（位置纵坐标）      走 yBands 新旧映射表分段线性插值，取整
 *   ry（椭圆纵半轴，纵深方向长度） × 7.652，取整
 *   yOffset/dy（相对偏移）  按其所在 y 分段的局部斜率线性变换（不是绝对位置查表）
 *   world/yBands/depth      直接替换为新固定值 / 整体删除（不走通用映射）
 *   符号引用（yBand 名字、zone 名字、颜色名、prop ref 等字符串）  原样保留
 *
 * NOTE-PROPS：props.*.w / props.*.h（含 at[] 内的 w/h 覆盖值）以及
 * layout.sidewalkTrees/parkTrees 的半径 r 保持不变——CLAUDE.md/tasks.md O-1
 * 条目已核实：这些几何在无量纲空间声明、绘制时乘 prop.scale；O-1 起
 * prop.scale 恒为 1（不再乘 depthScale），道具因此不需要改尺寸，只有
 * position（x/y）需要跟着世界坐标系一起搬。
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));
const SCENE_PATH = join(ROOT, 'assets', 'scene.json');

const UNIT_REBASE_FACTOR = 5.294118;
const RY_FACTOR = 7.652;

// ─── y 分段线性映射表（旧 y → 新 y，锚点见 tasks.md O-1 yBands 表 + (0,0) 原点）──
const Y_ANCHORS = [
  [0,   0],
  [210, 700],   // BUILDING_BASE_Y
  [240, 934],   // SIDEWALK_FAR_Y
  [248, 996],   // BIKE_LANE_FAR_TOP
  [268, 1166],  // BIKE_LANE_FAR_BOTTOM / FAR_Y
  [333, 1928],  // NEAR_Y / BIKE_LANE_NEAR_TOP
  [353, 2098],  // BIKE_LANE_NEAR_BOTTOM / PARK_TOP
  [381, 2394],  // 近人行道 overlay 下沿（zones.overlays.park_entry 下边界）
  [508, 3014],  // SIDEWALK_NEAR_Y
  [520, 3072],  // PARK_BOTTOM / WORLD_HEIGHT
];

function _segmentFor(y) {
  if (y <= Y_ANCHORS[0][0]) return [Y_ANCHORS[0], Y_ANCHORS[1]];
  for (let i = 1; i < Y_ANCHORS.length; i++) {
    if (y <= Y_ANCHORS[i][0]) return [Y_ANCHORS[i - 1], Y_ANCHORS[i]];
  }
  return [Y_ANCHORS[Y_ANCHORS.length - 2], Y_ANCHORS[Y_ANCHORS.length - 1]];
}

function mapY(y) {
  const [[x0, y0], [x1, y1]] = _segmentFor(y);
  return Math.round(y0 + (y - x0) / (x1 - x0) * (y1 - y0));
}

/**
 * 局部斜率（供 yOffset/dy/height 这类"相对偏移/长度"换算，而非绝对位置查表）。
 * 偏移方向 dir 决定锚点重合时取哪一段——offset 是往锚点前方（y 增大）还是
 * 后方（y 减小）量的，直接决定 y=锚点值 究竟该用入段斜率还是出段斜率
 * （二者在非锚点处相同，只在恰好落在锚点上时分叉；height 字段恒为正=前方）。
 */
function localSlope(yOld, dir = 1) {
  const probe = yOld + (dir >= 0 ? 0.5 : -0.5);
  const [[x0, y0], [x1, y1]] = _segmentFor(probe);
  return (y1 - y0) / (x1 - x0);
}

const mapX  = (v) => Math.round(v * UNIT_REBASE_FACTOR);
const mapRy = (v) => Math.round(v * RY_FACTOR);

const log = [];
function rec(path, oldV, newV) {
  log.push(`${path}: ${oldV} → ${newV}`);
  return newV;
}

// ─── 读取原始 scene.json（OLD 保留只读快照，供 yOffset 等需要"旧上下文"的换算引用）──
const RAW = readFileSync(SCENE_PATH, 'utf8');
const scene = JSON.parse(RAW);
const OLD   = JSON.parse(RAW);

// ── world（固定新值；height 对应 yBands 表的 PARK_BOTTOM 映射，不是简单 ×factor）──
rec('world.width',  OLD.world.width,  10588);
rec('world.height', OLD.world.height, 3072);
scene.world = { width: 10588, height: 3072 };

// ── depth：整体删除（depthScale 已删，Layout.initLayout 不再读这个字段） ──
log.push('depth: [整段删除，原值 ' + JSON.stringify(OLD.depth) + ']');
delete scene.depth;

// ── yBands：固定新值（与 js/core/Layout.js fallback 一致） ──
const NEW_YBANDS = {
  SKY_Y: 333, BUILDING_BASE_Y: 700, SIDEWALK_FAR_Y: 934,
  BIKE_LANE_FAR_TOP: 996, BIKE_LANE_FAR_BOTTOM: 1166, FAR_Y: 1166,
  NEAR_Y: 1928, BIKE_LANE_NEAR_TOP: 1928, BIKE_LANE_NEAR_BOTTOM: 2098,
  PARK_TOP: 2098, SIDEWALK_NEAR_Y: 3014, PARK_BOTTOM: 3072,
};
for (const k of Object.keys(NEW_YBANDS)) rec(`yBands.${k}`, OLD.yBands[k], NEW_YBANDS[k]);
scene.yBands = NEW_YBANDS;

// ── ground：bands[].from/to 与 edgeLines[].at 是符号引用（字符串），不动；
//    edgeLines[].width / tiling.{inset,spacing,width} / grass.inset 走 x 类映射 ──
scene.ground.edgeLines.forEach((e, i) => {
  e.width = rec(`ground.edgeLines[${i}](at=${e.at}).width`, OLD.ground.edgeLines[i].width, mapX(OLD.ground.edgeLines[i].width));
});
{
  const t = scene.ground.tiling, o = OLD.ground.tiling;
  t.inset   = rec('ground.tiling.inset',   o.inset,   mapX(o.inset));
  t.spacing = rec('ground.tiling.spacing', o.spacing, mapX(o.spacing));
  t.width   = rec('ground.tiling.width',   o.width,   mapX(o.width));
}
{
  const g = scene.ground.grass, o = OLD.ground.grass;
  g.inset = rec('ground.grass.inset', o.inset, mapX(o.inset));
}

// ── exits ──
scene.exits.edges.forEach((e, i) => {
  const o = OLD.exits.edges[i];
  e.margin = rec(`exits.edges[${o.id}].margin`, o.margin, mapX(o.margin));
});
{
  const d = scene.exits.buildingDoor, o = OLD.exits.buildingDoor;
  const bandOldY = OLD.yBands[o.yBand];
  const slope    = localSlope(bandOldY, o.yOffset);
  const newOff   = Math.round(o.yOffset * slope);
  d.yOffset = rec(`exits.buildingDoor.yOffset (yBand=${o.yBand}, slope=${slope.toFixed(3)})`, o.yOffset, newOff);
  // yBand（字符串）、yZone（yBand 名字数组）不动
}

// ── spawnPoints ──
scene.spawnPoints.forEach((p, i) => {
  const o = OLD.spawnPoints[i];
  p.margin = rec(`spawnPoints[${i}].margin`, o.margin, mapX(o.margin));
  if (o.yOffset != null) {
    const bandOldY = OLD.yBands[o.yBand];
    const slope    = localSlope(bandOldY, o.yOffset);
    const newOff   = Math.round(o.yOffset * slope);
    p.yOffset = rec(`spawnPoints[${i}].yOffset (yBand=${o.yBand}, slope=${slope.toFixed(3)})`, o.yOffset, newOff);
  }
});

// ── features ──
scene.features.forEach((f, i) => {
  const o = OLD.features[i];
  if (f.radius != null)           f.radius           = rec(`features[${i}:${o.type}].radius`, o.radius, mapX(o.radius));
  if (f.benchAvoidRadius != null) f.benchAvoidRadius  = rec(`features[${i}:${o.type}].benchAvoidRadius`, o.benchAvoidRadius, mapX(o.benchAvoidRadius));
  if (f.xMargin != null)          f.xMargin           = rec(`features[${i}:${o.type}].xMargin`, o.xMargin, mapX(o.xMargin));
  if (f.runners) {
    f.runners.forEach((r, j) => {
      const ro = o.runners[j];
      r.spawnX = rec(`features[${i}:athletes].runners[${j}].spawnX`, ro.spawnX, mapX(ro.spawnX));
      r.margin = rec(`features[${i}:athletes].runners[${j}].margin`, ro.margin, mapX(ro.margin));
      // speed 显式在"不动"清单（features[].runners[].speed）
    });
  }
  // dur/weight/count/countRange/midYFrac/lifespanRange/ageTimerMax/agendaTemplate/
  // minYBand/maxYBand/plaza/tags/use/arrivalState/kind/_speedUnit 均不动
});

// ── zones ──
{
  const z = scene.zones, o = OLD.zones;
  z.overlays.forEach((ov, i) => {
    const oo = o.overlays[i];
    // height 是"从 from 往下量"的长度：按 from 旧值所在分段局部斜率线性变换
    const bandOldY = OLD.yBands[oo.from] ?? (() => { throw new Error(`rebase: zones.overlays[${i}].from '${oo.from}' 不是已知 yBand 名`); })();
    const slope    = localSlope(bandOldY, 1); // height 恒为正：从 from 往 y 增大方向量
    ov.height = rec(`zones.overlays[${i}:${oo.name}].height (from=${oo.from}, slope=${slope.toFixed(3)})`, oo.height, Math.round(oo.height * slope));
  });
  z.paving.pathTubeRadius = rec('zones.paving.pathTubeRadius', o.paving.pathTubeRadius, mapX(o.paving.pathTubeRadius));
  z.crossings.halfWidth   = rec('zones.crossings.halfWidth',   o.crossings.halfWidth,   mapX(o.crossings.halfWidth));
  // bands[].to、paving.from/zone、paving.plazas[].ref/shrink、crossings.over/ref/zone/from/to 不动
}

// ── buildings：x / bWidth / bDepth / facadeH / door 全部 x 类；waterTower/solar/billboard/kind 不动 ──
scene.buildings.forEach((b, i) => {
  const o = OLD.buildings[i];
  b.x       = rec(`buildings[${i}:${o.kind}].x`,       o.x,       mapX(o.x));
  b.bWidth  = rec(`buildings[${i}:${o.kind}].bWidth`,  o.bWidth,  mapX(o.bWidth));
  b.bDepth  = rec(`buildings[${i}:${o.kind}].bDepth`,  o.bDepth,  mapX(o.bDepth));
  b.facadeH = rec(`buildings[${i}:${o.kind}].facadeH`, o.facadeH, mapX(o.facadeH));
  b.door    = rec(`buildings[${i}:${o.kind}].door`,    o.door,    mapX(o.door));
});

// ── props：位置（x/y，含 at[] 二元数组与 {x,y,...} 对象两种写法）走 x/y 类映射；
//    w/h（含 at[] 内的覆盖值）刻意不动，见文件头 NOTE-PROPS ──
for (const [propType, def] of Object.entries(scene.props)) {
  const oldDef = OLD.props[propType];
  def.at = def.at.map((entry, i) => {
    const oldEntry = oldDef.at[i];
    if (Array.isArray(entry)) {
      const [x, y] = entry;
      const nx = rec(`props.${propType}.at[${i}] x`, x, mapX(x));
      const ny = rec(`props.${propType}.at[${i}] y`, y, mapY(y));
      return [nx, ny];
    }
    const nx = rec(`props.${propType}.at[${i}].x`, oldEntry.x, mapX(oldEntry.x));
    const ny = rec(`props.${propType}.at[${i}].y`, oldEntry.y, mapY(oldEntry.y));
    entry.x = nx; entry.y = ny;
    // entry.w / entry.smartDef 等覆盖字段不动
    return entry;
  });
  // def.w / def.h（每种 prop 的共享默认尺寸）不动
}

// ── layout.sidewalkTrees / parkTrees：[x, y, r] 三元组，r（树冠半径，尺寸）不动 ──
for (const key of ['sidewalkTrees', 'parkTrees']) {
  scene.layout[key] = scene.layout[key].map((t, i) => {
    const [x, y, r] = OLD.layout[key][i];
    const nx = rec(`layout.${key}[${i}].x`, x, mapX(x));
    const ny = rec(`layout.${key}[${i}].y`, y, mapY(y));
    return [nx, ny, r];
  });
}

// ── layout.clouds：x 走 x 类；y < 210，用同一分段表（首段 (0,0)-(210,700)）；scale 不动 ──
scene.layout.clouds = scene.layout.clouds.map((c, i) => {
  const o = OLD.layout.clouds[i];
  const nx = rec(`layout.clouds[${i}].x`, o.x, mapX(o.x));
  const ny = rec(`layout.clouds[${i}].y`, o.y, mapY(o.y));
  return { ...c, x: nx, y: ny };
});

// ── layout.crosswalks：x 类 ──
scene.layout.crosswalks = scene.layout.crosswalks.map((cw, i) => {
  const o = OLD.layout.crosswalks[i];
  return { x: rec(`layout.crosswalks[${i}].x`, o.x, mapX(o.x)) };
});

// ── layout.roadMarkings ──
{
  const rm = scene.layout.roadMarkings, o = OLD.layout.roadMarkings;
  rm.curbFar.thickness  = rec('layout.roadMarkings.curbFar.thickness',  o.curbFar.thickness,  mapX(o.curbFar.thickness));
  rm.curbNear.thickness = rec('layout.roadMarkings.curbNear.thickness', o.curbNear.thickness, mapX(o.curbNear.thickness));
  rm.laneStripe.spacing      = rec('layout.roadMarkings.laneStripe.spacing',      o.laneStripe.spacing,      mapX(o.laneStripe.spacing));
  rm.laneStripe.length       = rec('layout.roadMarkings.laneStripe.length',       o.laneStripe.length,       mapX(o.laneStripe.length));
  rm.laneStripe.width        = rec('layout.roadMarkings.laneStripe.width',        o.laneStripe.width,        mapX(o.laneStripe.width));
  rm.crosswalk.roadMargin    = rec('layout.roadMarkings.crosswalk.roadMargin',    o.crosswalk.roadMargin,    mapX(o.crosswalk.roadMargin));
  rm.crosswalk.stripeLength  = rec('layout.roadMarkings.crosswalk.stripeLength',  o.crosswalk.stripeLength,  mapX(o.crosswalk.stripeLength));
  rm.crosswalk.xOffset       = rec('layout.roadMarkings.crosswalk.xOffset',       o.crosswalk.xOffset,       mapX(o.crosswalk.xOffset));
  // roadEdge.height、curbNear.lineWidthFactor/lineAlpha、crosswalk.stripeCount/color/alpha 等
  // 不在 x/y/ry/不动 四类清单字面出现——保守起见原样保留，不猜语义
}

// ── layout.chessPlaza / miniPark：cx 类 x，cy 类 y，rx 类 x，ry 特殊 × RY_FACTOR ──
for (const key of ['chessPlaza', 'miniPark']) {
  const p = scene.layout[key], o = OLD.layout[key];
  p.cx = rec(`layout.${key}.cx`, o.cx, mapX(o.cx));
  p.cy = rec(`layout.${key}.cy`, o.cy, mapY(o.cy));
  p.rx = rec(`layout.${key}.rx`, o.rx, mapX(o.rx));
  p.ry = rec(`layout.${key}.ry`, o.ry, mapRy(o.ry));
}

// ── layout.walkPaths：waypoints[].x/y；pause/loop 不动 ──
for (const [pathName, path] of Object.entries(scene.layout.walkPaths)) {
  const oldPath = OLD.layout.walkPaths[pathName];
  path.waypoints = path.waypoints.map((w, i) => {
    const o = oldPath.waypoints[i];
    const nx = rec(`layout.walkPaths.${pathName}.waypoints[${i}].x`, o.x, mapX(o.x));
    const ny = rec(`layout.walkPaths.${pathName}.waypoints[${i}].y`, o.y, mapY(o.y));
    return { ...w, x: nx, y: ny };
  });
}

// ── layout.busStops：x 类；bench.dx 类 x，bench.dy 类 y（两处皆为 0，无论按绝对
//    位置查表还是按局部斜率处理都得 0，故直接走 mapY／mapX 亦安全）；bench.width x 类 ──
scene.layout.busStops = scene.layout.busStops.map((s, i) => {
  const o = OLD.layout.busStops[i];
  const nx = rec(`layout.busStops[${i}].x`, o.x, mapX(o.x));
  const bench = { ...s.bench };
  bench.dx    = rec(`layout.busStops[${i}].bench.dx`,    o.bench.dx,    mapX(o.bench.dx));
  bench.dy    = rec(`layout.busStops[${i}].bench.dy`,    o.bench.dy,    mapY(o.bench.dy));
  bench.width = rec(`layout.busStops[${i}].bench.width`, o.bench.width, mapX(o.bench.width));
  return { ...s, x: nx, bench };
});

// ─── 写回 + 打印报告 ────────────────────────────────────────────────────────
writeFileSync(SCENE_PATH, JSON.stringify(scene, null, 2) + '\n', 'utf8');
console.log(log.join('\n'));
console.log(`\n共 ${log.length} 个字段完成迁移。scene.json 已原地重写：${SCENE_PATH}`);
