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
import {
  PX_PER_UNIT, BUILDING_BASE_Y, WORLD_WIDTH, WORLD_HEIGHT,
  FILL_MID, FILL_SHADE, lenv,
} from './Layout.js';

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
 * 实体包围盒（`Entity.getBounds()` 的返回值）→ 屏幕矩形。
 *
 * `getBounds()` 的语义是**贴地竖直广告牌盒**，不是地面足迹（见 Entity.js 上
 * 该方法的注释）：`x`/`width` 是水平范围，`y`/`height` 是**离地高度**范围，
 * 盒子下沿 `y + height` 落在地面接触线上。所以换算时两个方向走的通道不同——
 * 地面接触线那个点是纵深量、过 `toScreen()`；宽和高是"平长度"、过
 * `toScreenLength()`，不参与 shear/tilt。这跟 StickRenderer 画人、
 * `frontFaceGraphics` 画正面细节是同一条「核心区分」（见文件头）。
 *
 * ⚠ 不要把 `getBounds()` 丢给 `projectGroundRect()`——那个函数假定两个角点
 * 都是地面上的位置，会把"高度"当成"纵深"投影：物体会被斜切着往后趴，越高
 * 的物体错得越离谱（楼最明显）。这是 O-2 之后很容易踩的坑。
 *
 * @returns {{x:number,y:number,w:number,h:number}} 屏幕像素轴对齐矩形
 *          （绝对投影坐标，未叠加相机 pan/zoom）
 */
export function billboardScreenBox(b) {
  const base = toScreen(b.x, b.y + b.height); // 下沿 = 地面接触线
  return {
    x: base.x,
    y: base.y - toScreenLength(b.height),
    w: toScreenLength(b.width),
    h: toScreenLength(b.height),
  };
}

/**
 * 地面矩形（世界坐标，对角两点 x0,y0 – x1,y1）→ 屏幕平行四边形顶点，
 * flat array [x,y, x,y, x,y, x,y]（PIXI Graphics#drawPolygon 的入参形状），
 * 顶点顺序 = (x0,y0)→(x1,y0)→(x1,y1)→(x0,y1)。
 * **两个角点都必须是地面上的位置**——竖直方向的范围请用
 * `billboardScreenBox()`，别把高度当纵深传进来。
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

// ─── O-3：盒子模板 ────────────────────────────────────────────────────────────

/**
 * 光照方向：全场唯一，光从左上来——所以侧面永远画在右边（世界 +x 那一侧）。
 * 任何 draw 函数手画阴影/选择哪一侧当阴影面都要遵守这个方向，不要各写各的。
 */
export const LIGHT_DIR = 'upper-left';

/**
 * 三面体积盒子模板：给底面矩形（中心 x、前沿 y、宽 w、进深 depth）和高度 h，
 * 生成正面/顶面/侧面三个面。灰度固定分配，不给调用方选择顶面/侧面颜色——
 * 顶面 FILL_MID、侧面 FILL_SHADE 写死；只有正面颜色由调用方传入
 * （fillFront，各 draw 文件原本就有自己的正面基调色，这里不替调用方决定）。
 *
 * 正面沿世界 y=front（常数）展开，不受 shear 影响——是唯一一个跟自身局部
 * 坐标系无畸变的面。返回值带一个 `front` 锚点，配合 frontFaceGraphics() 用，
 * 让调用方把原来"以 (x,y) 为锚点画局部细节"的代码几乎不改地迁移过来。
 *
 * `baseH`（O-4 新增，默认 0 = 贴地）把整个盒子抬离地面——雨棚、公交顶棚、
 * 站牌面板、招牌这类"悬在半空"的体块要用它，否则只能拿贴地盒子硬凑。抬升是
 * **高度**方向，所以走 `toScreenHeight`，不参与 shear/tilt；投影/描边仍以地面
 * 线 `y` 为参照（`lenv` 的深度画风取决于物体站在哪，不取决于它被举多高）。
 * 盒子底面在 `baseH` 处、顶面在 `baseH + h` 处；`baseH > 0` 时底面会露出来，
 * 但本项目视角永远俯视（TILT_DEG 为正、相机在上方），底面看不见，不画。
 *
 * @returns {{front:{x:number,y:number}}} 正面锚点（世界 (x,y) 投影后的屏幕坐标，
 *          注意是**地面**锚点，不含 baseH 抬升——frontFaceGraphics 也以地面为原点）
 */
export function drawObliqueBox(g, x, y, w, depth, h, fillFront, baseH = 0) {
  g.lineStyle(0);
  const hw = w / 2;
  const front  = toScreen(x, y);
  const frontL = toScreen(x - hw, y),          frontR = toScreen(x + hw, y);
  const backL  = toScreen(x - hw, y - depth),  backR  = toScreen(x + hw, y - depth);
  const dBase = toScreenHeight(baseH);
  const dTop  = toScreenHeight(baseH + h);
  const at = (p, d) => ({ x: p.x, y: p.y - d });
  const fbL = at(frontL, dBase), fbR = at(frontR, dBase);
  const bbL = at(backL,  dBase), bbR = at(backR,  dBase);
  const ftL = at(frontL, dTop),  ftR = at(frontR, dTop);
  const btL = at(backL,  dTop),  btR = at(backR,  dTop);

  // 顶面
  g.beginFill(FILL_MID, 1);
  g.drawPolygon([ftL.x, ftL.y, ftR.x, ftR.y, btR.x, btR.y, btL.x, btL.y]);
  g.endFill();
  lenv(g, y - depth, 0.7);
  g.drawPolygon([ftL.x, ftL.y, ftR.x, ftR.y, btR.x, btR.y, btL.x, btL.y]);

  // 侧面（光从左上来，侧面永远画在右边，即世界 +x 一侧）
  g.beginFill(FILL_SHADE, 1);
  g.drawPolygon([fbR.x, fbR.y, ftR.x, ftR.y, btR.x, btR.y, bbR.x, bbR.y]);
  g.endFill();
  lenv(g, y, 0.7);
  g.drawPolygon([fbR.x, fbR.y, ftR.x, ftR.y, btR.x, btR.y, bbR.x, bbR.y]);

  // 正面
  g.beginFill(fillFront, 1);
  g.drawPolygon([fbL.x, fbL.y, fbR.x, fbR.y, ftR.x, ftR.y, ftL.x, ftL.y]);
  g.endFill();
  lenv(g, y, 0.85);
  g.drawPolygon([fbL.x, fbL.y, fbR.x, fbR.y, ftR.x, ftR.y, ftL.x, ftL.y]);

  return { front };
}

/**
 * 正面代理 Graphics：把"以 (anchorX, groundY) 为地面锚点、局部沿用世界 x 当水平
 * 偏移、世界 y 当'离地高度'（越小越高，groundY 处为 0）"的老式扁平画法无缝接
 * 到投影后的正面。正面沿世界 y=常数展开不受 shear 影响，这层代理数学上只是
 * scale+translate（详见文件头核心区分），调用方内部逻辑一行都不用改。
 *
 * lineStyle 的线宽字面量原样转发，不再缩放——本项目线宽一律是最终屏幕像素值
 * （见 Layout.js 线宽常量 O-2 撤销 O-1 补偿的说明），跟位置换算无关。
 */
export function frontFaceGraphics(g, anchorX, groundY) {
  const base = toScreen(anchorX, groundY);
  const offX = base.x - PX_PER_UNIT * anchorX;
  const offY = base.y - PX_PER_UNIT * groundY;
  const sx = (v) => PX_PER_UNIT * v + offX;
  const sy = (v) => PX_PER_UNIT * v + offY;
  const sl = (v) => PX_PER_UNIT * v;
  return {
    lineStyle:   (...a) => g.lineStyle(...a),
    beginFill:   (...a) => g.beginFill(...a),
    endFill:     ()     => g.endFill(),
    closePath:   ()     => g.closePath(),
    drawRect:    (x, y, w, h) => g.drawRect(sx(x), sy(y), sl(w), sl(h)),
    drawCircle:  (x, y, r)    => g.drawCircle(sx(x), sy(y), sl(r)),
    drawEllipse: (x, y, rx, ry) => g.drawEllipse(sx(x), sy(y), sl(rx), sl(ry)),
    // 入参同 PIXI：扁平数组 [x,y, x,y, …]，逐点映射
    drawPolygon: (pts) => {
      const out = new Array(pts.length);
      for (let i = 0; i < pts.length; i += 2) { out[i] = sx(pts[i]); out[i + 1] = sy(pts[i + 1]); }
      g.drawPolygon(out);
    },
    moveTo: (x, y) => g.moveTo(sx(x), sy(y)),
    lineTo: (x, y) => g.lineTo(sx(x), sy(y)),
  };
}

/**
 * 地面代理 Graphics（O-4 第三批）：把"直接用世界坐标在地面上画"的老式扁平画法
 * 接到投影后的地面。井盖、排水沟、棋盘广场、公园小径、喷泉水盘这类**贴地**元素
 * 用它——它们没有高度，整块形状都躺在地面上，所以每个点都走 `toScreen()`，
 * 跟 `frontFaceGraphics`（立面，走 toScreenLength）正好是另一半。
 *
 * 与 `frontFaceGraphics` 的区别是这里**不做局部锚点平移**：这批函数本来就用
 * 绝对世界坐标作画，直接逐点投影即可。
 *
 * 形状换算：
 *   - `drawRect` → `drawPolygon`（地面矩形经 shear 后是平行四边形）
 *   - `drawCircle` / `drawEllipse` → 屏幕椭圆，竖半轴乘 `SIN_TILT`
 *     （地面上的圆俯视后被压扁）。**近似**：shear 还会把椭圆斜过来一点，但
 *     PIXI 的 `drawEllipse` 画不了斜椭圆，这里只压不斜——圆心位置是精确的，
 *     形状差一个小剪切量。同本项目其它"近似够用，不必算精确多边形"的取舍。
 *   - 线宽原样转发（O-2 起线宽一律是最终屏幕像素值）
 */
export function groundFaceGraphics(g) {
  const pt = (x, y) => toScreen(x, y);
  const ellipse = (cx, cy, rx, ry) => {
    const c = pt(cx, cy);
    g.drawEllipse(c.x, c.y, toScreenLength(rx), toScreenLength(ry) * SIN_TILT);
  };
  return {
    lineStyle: (...a) => g.lineStyle(...a),
    beginFill: (...a) => g.beginFill(...a),
    endFill:   ()     => g.endFill(),
    closePath: ()     => g.closePath(),
    drawRect:    (x, y, w, h) => g.drawPolygon(projectGroundRect(x, y, x + w, y + h)),
    drawCircle:  (cx, cy, r)  => ellipse(cx, cy, r, r),
    drawEllipse: ellipse,
    drawPolygon: (pts) => {
      const out = new Array(pts.length);
      for (let i = 0; i < pts.length; i += 2) {
        const p = pt(pts[i], pts[i + 1]);
        out[i] = p.x; out[i + 1] = p.y;
      }
      g.drawPolygon(out);
    },
    moveTo: (x, y) => { const p = pt(x, y); g.moveTo(p.x, p.y); },
    lineTo: (x, y) => { const p = pt(x, y); g.lineTo(p.x, p.y); },
  };
}

/**
 * 顶面代理 Graphics：老式画法里"以某个远端角为局部原点、(u,v) 落在进深范围内"
 * 的内容（如屋顶散件）搬到真正的顶面。顶面因 shear 是平行四边形，drawRect 在
 * 这里不能直接转发（会画成轴对齐矩形，跟实际抬升/斜切的顶面对不上），改画
 * drawPolygon；moveTo/lineTo 单点映射不受影响，照常转发。
 *
 * @param anchorX    局部 u=0 对应的世界 x
 * @param anchorFarY 局部 v=0 对应的世界 y（顶面远端边，即盒子的 y-depth）
 * @param liftH      顶面比地面抬升的高度（骨架单位），通常等于盒子的 h
 */
export function topFaceGraphics(g, anchorX, anchorFarY, liftH) {
  const dh = toScreenHeight(liftH);
  const map = (u, v) => {
    const p = toScreen(anchorX + u, anchorFarY + v);
    return { x: p.x, y: p.y - dh };
  };
  return {
    lineStyle: (...a) => g.lineStyle(...a),
    beginFill: (...a) => g.beginFill(...a),
    endFill:   ()     => g.endFill(),
    drawRect: (x, y, w, h) => {
      const p0 = map(x, y), p1 = map(x + w, y), p2 = map(x + w, y + h), p3 = map(x, y + h);
      g.drawPolygon([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]);
    },
    moveTo: (x, y) => { const p = map(x, y); g.moveTo(p.x, p.y); },
    lineTo: (x, y) => { const p = map(x, y); g.lineTo(p.x, p.y); },
  };
}
