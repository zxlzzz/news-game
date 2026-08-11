/**
 * Projection.js — O 系列（斜投影）全项目唯一投影住址（O-2）。
 *
 * 世界坐标（骨架单位，各向同性，见 O-1／CLAUDE.md「世界单位」）→ 屏幕像素。
 * 任何 draw 函数不许自带 sin/cos／斜切算式——一律经这里的函数换算。
 *
 * 核心区分（整个 O 系列建立在这条上）：
 *   纵深（世界 y，前后方向）经 shear + sin(TILT_DEG) 换算——toScreen()。
 *   高度/宽度这类"竖直或水平的平长度"只经 PX_PER_UNIT 换算，不参与
 *   shear/tilt——toScreenLength()。
 * 原因：一个 worldContainer 级别的仿射变换（scale/skew）没法同时正确处理
 * 这两种量纲——高度不该跟着纵深一起被斜切/被 sin(TILT) 压扁。所以本项目
 * 放弃了"容器整体做仿射变换"的老路（O-1 的 worldContainer.scale=zoom*
 * PX_PER_UNIT 那一套），改成每个 draw 调用显式把世界坐标经 toScreen() 换算
 * 成绝对屏幕像素，容器（worldContainer）自己只再叠加 zoom + 相机 pan，见
 * StreetScene.js `_applyCamera`。
 *
 * O-2 只验证这一层几何本身（倾角/相机高度对不对），不画三面体积——
 * drawObliqueBox 三面模板、圆→椭圆/矩形→平行四边形在 O-3 真正接上盒子渲染
 * 前，这里先导出两个形状助手供 SceneRenderer 的地面带（本补丁）和 O-3
 * 用；调用方目前是 O-2 的占位盒子（EntityManager）和 SceneRenderer。
 */
import { PX_PER_UNIT, BUILDING_BASE_Y, WORLD_WIDTH, WORLD_HEIGHT } from './Layout.js';

export const TILT_DEG = 20;                      // 倾角（暂定值，O-2 落地后跑实机再调）
const TILT_RAD  = TILT_DEG * Math.PI / 180;
export const SIN_TILT = Math.sin(TILT_RAD);
export const SHEAR = 0.2;                         // 纵深方向在屏幕上的水平偏移比例（暂定值）

/** 世界坐标 → 屏幕像素。原点取 BUILDING_BASE_Y（沿用 O-1 depthT 的原点选择）。 */
export function toScreen(x, y) {
  return {
    x: (x + (y - BUILDING_BASE_Y) * SHEAR) * PX_PER_UNIT,
    y: (y - BUILDING_BASE_Y) * PX_PER_UNIT * SIN_TILT,
  };
}

/** toScreen() 的逆变换：屏幕像素 → 世界坐标。供鼠标拾取/取景框拖拽/相机换算用。 */
export function toWorld(screenX, screenY) {
  const y = BUILDING_BASE_Y + screenY / (PX_PER_UNIT * SIN_TILT);
  const x = screenX / PX_PER_UNIT - (y - BUILDING_BASE_Y) * SHEAR;
  return { x, y };
}

/**
 * "平"长度（高度、宽度——不是纵深）→ 屏幕像素。见文件头核心区分。
 * toScreenHeight 是同一函数的语义别名：调用点大多是在换算高度，读起来更直白。
 */
export function toScreenLength(v) {
  return v * PX_PER_UNIT;
}
export const toScreenHeight = toScreenLength;

/**
 * 地面上半径 r 的圆 → 屏幕椭圆的竖直半轴（横轴半径就是 toScreenLength(r)）。
 * 供 O-3 drawObliqueBox 的地面形状助手用；圆心本身仍要过 toScreen() 换算。
 */
export function circleToEllipseRy(r) {
  return r * PX_PER_UNIT * SIN_TILT;
}

/**
 * 地面矩形（世界坐标，对角两点 x0,y0 – x1,y1）→ 屏幕平行四边形顶点，
 * flat array [x,y, x,y, x,y, x,y]（PIXI Graphics#drawPolygon 的入参形状），
 * 顶点顺序 = (x0,y0)→(x1,y0)→(x1,y1)→(x0,y1)。
 */
export function projectGroundRect(x0, y0, x1, y1) {
  const p0 = toScreen(x0, y0), p1 = toScreen(x1, y0);
  const p2 = toScreen(x1, y1), p3 = toScreen(x0, y1);
  return [p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y];
}

/**
 * 整个世界地面（x:[0,WORLD_WIDTH] y:[0,WORLD_HEIGHT]）投影后的屏幕包围盒，
 * 外加 maxFacadeH（世界最高楼的实际高度，骨架单位）预留的屋顶余量——屋顶
 * 的 screenY 是负数，相机需要能滚到负区间才看得到楼顶。找不到最高楼数据
 * 就传 0（退化为只包含地面本身，不留屋顶余量）。供 StreetScene._clampScroll 用。
 */
export function sceneScreenBounds(maxFacadeH = 0) {
  const corners = [
    toScreen(0, 0), toScreen(WORLD_WIDTH, 0),
    toScreen(0, WORLD_HEIGHT), toScreen(WORLD_WIDTH, WORLD_HEIGHT),
  ];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  minY -= toScreenHeight(maxFacadeH);
  return { minX, minY, maxX, maxY };
}
