> **SNAPSHOT** — 审计日期 2026-07-11. 本报告不再更新；后续视觉合规问题以新审计文件替代。

# v3 视觉合规审计

扫描范围：`js/entity/**/draw*.js` + `js/scenes/SceneRenderer.js`

图例：`[ ]` 待修 · `[x]` 已修 · `[~]` 灰色地带（见备注）

---

## (a) 非 FILL_PAPER/LIGHT/MID/SHADE 的硬编码填充色

### drawBuilding.js
- [x] L316 `beginFill(0x000000, 0.07)` — 立面左侧"阴影"竖条 → 删除（伪3D方向光，见b）
- [x] L361 `beginFill(0x000000, 0.14)` — 楼间小巷阴影 → 删除（伪3D，见b）

### drawHydrant.js
- [x] L98 `lineStyle(hWidth, 0xffffff, 0.2)` — 金属高光线 → 删除（伪3D specular，见b）

### drawMailbox.js
- [x] L36 `beginFill(0x000000, 0.6)` — 投信口凹槽 → 改为 `FILL_SHADE`（最深档位，保留几何）

### drawNewsRack.js
- [x] L48 `beginFill(0x000000, 0.6)` — 投币/退票口凹槽 → 改为 `FILL_SHADE`

### drawPhoneBooth.js
- [x] L35 `beginFill(0xffffff, 0.16)` — 玻璃反光条 → 删除（伪3D，见b）
- [x] L43 `beginFill(0x000000, 0.7)` — 听筒/电话机体 → 改为 `FILL_SHADE`

### drawSign.js
- [~] L31 `lineStyle(1.7*s, 0xffffff, 0.7)` — 模拟文字行 → **保留**（白色低 alpha 模拟文字是表意用途，非光照模拟）

### drawVehicle.js
- [x] L87  `beginFill(0xffffff, 0.15)` — 轿车后窗眩光 → 删除（伪3D，见b）
- [x] L112 `beginFill(0xffffff, 0.15)` — 轿车前窗眩光 → 删除
- [x] L146 `beginFill(0xffffff, 0.5)` — 轿车大灯 → 改为 `FILL_PAPER`（最亮档）
- [x] L174 `beginFill(0x000000, 0.06)` — 轿车地面投影椭圆 → 删除（伪3D，见b）
- [x] L251 `beginFill(0x000000, 0.05)` — 公交车地面投影椭圆 → 删除
- [x] L286 `beginFill(0xffffff, 0.15)` — 公交车窗眩光 → 删除
- [x] L303 `beginFill(0xffffff, 0.15)` — 公交车门窗眩光 → 删除
- [x] L318 `beginFill(0xffffff, 0.5)` — 公交车大灯 → 改为 `FILL_PAPER`
- [x] L421 `beginFill(0xffffff, 0.55)` — 摩托车大灯 → 改为 `FILL_PAPER`

### drawVending.js
- [x] L37 `beginFill(0xffffff, 0.18)` — 玻璃前面板反光 → 删除（伪3D，见b）
- [x] L55 `beginFill(0x000000, 0.9)` — 出货口凹槽 → 改为 `FILL_SHADE`

### SceneRenderer.js
- [~] L119 `beginFill(0xffffff, 0.92)` — 云朵 → **保留**（白云是表意色，非光照模拟）
- [~] L149 `lineStyle(2, 0xffffff, 0.6)` — 道路中心线 → **保留**（道路白线是真实交通标记）
- [~] L180 `beginFill(0xffffff, 0.68)` — 斑马线 → **保留**（同上）
- [x] L161 `beginFill(0x000000, 0.04)` — 路面补丁/磨损纹理 → 删除（地面纹理伪3D）
- [x] L198 `lineStyle(0.7, 0x000000, 0.05)` — 公园草地线条 → 改为 `lenv(g, gy, 0.15)` 用环境线系统

---

## (b) 伪 3D 残留（侧面/顶面几何、手绘阴影形状）

### drawBuilding.js
- [x] L315–318 `beginFill(0x000000, 0.07)` — 立面左侧方向光"阴影"竖条（宽 3px，全高）→ **删除**
- [x] L359–364 `beginFill(0x000000, 0.14)` — 楼间小巷手绘阴影矩形 → **删除**

### drawHydrant.js — `drawCylinder` 内局
- [x] L29–37 `drawCylinder`: 将矩形切左右两半分别填 `FILL_LIGHT`/`FILL_MID` 来模拟圆柱明暗 → **改为单色**（`FILL_MID` 整体，一次 `drawRect`）
- [x] L53–75 Dome 梯形同样左半 `FILL_LIGHT` / 右半 `FILL_MID` 模拟球面反射 → **改为单色** `FILL_MID`
- [x] L95–108 `lineStyle(hWidth, 0xffffff, 0.2)` 高光线 → **删除**

### drawPhoneBooth.js
- [x] L34–37 `beginFill(0xffffff, 0.16)` — 玻璃反光矩形覆盖层 → **删除**

### drawVehicle.js
- [x] L87, L112 `beginFill(0xffffff, 0.15)` 于车窗内 — 玻璃眩光覆盖层 → **删除**
- [x] L174–176 `beginFill(0x000000, 0.06); drawEllipse` — 轿车轮下地面投影 → **删除**（EntityManager.drawShadows 统一处理阴影）
- [x] L251–253 `beginFill(0x000000, 0.05); drawEllipse` — 公交车地面投影 → **删除**
- [x] L286 `beginFill(0xffffff, 0.15)` — 公交窗眩光 → **删除**
- [x] L303 `beginFill(0xffffff, 0.15)` — 公交门窗眩光 → **删除**

### drawVending.js
- [x] L36–39 `beginFill(0xffffff, 0.18)` — 玻璃前面板反光矩形 → **删除**

### SceneRenderer.js
- [x] L159–169 `_drawRoadPatches` `beginFill(0x000000, 0.04)` — 路面磨损贴片 → **删除**（地面纹理是环境层任务，不属于 entity draw）

---

## (c) draw 函数入口缺 `g.lineStyle(0)`

### drawBuilding.js
- [x] `drawBuilding` L339 — 补 `g.lineStyle(0)` 首行

### drawBusStopBay.js
- [x] `drawBusStopBays` L104 — 补 `g.lineStyle(0)` 首行
- [x] `_drawFarBusStop`  L44  — 补 `g.lineStyle(0)` 首行
- [x] `_drawNearBusStop` L75  — 补 `g.lineStyle(0)` 首行

### drawTree.js
- [x] `drawTree` L59 — 补 `g.lineStyle(0)` 首行

### drawVehicle.js
- [x] `_car`  L159 — 补 `g.lineStyle(0)` 首行
- [x] `_taxi` L198 — 直接调 `_car`，`_car` 已补，无需单独处理
- [x] `_bus`  L236 — 补 `g.lineStyle(0)` 首行
- [x] `_moto` L328 — 补 `g.lineStyle(0)` 首行

### drawParkPath.js
- [x] `drawParkPaths` L57 — 补 `g.lineStyle(0)` 首行

### SceneRenderer.js（私有方法）
- [x] `_drawGround`       — 补 `g.lineStyle(0)` 首行
- [x] `_drawRoadMarkings` — 补 `g.lineStyle(0)` 首行
- [x] `_drawRoadPatches`  — 方法整体删除
- [x] `_drawParkGrass`    — 改用 `lenv(g, gy, 0.15)`（每笔深度自适应，替代固定 lineStyle）
- [x] `_drawCrosswalk`    — 补 `g.lineStyle(0)` 首行

---

## T3 已知修复点

### T3-1 drawBusStopBench 锚点（对照 entity/seat 惯例）
- [x] `bench.dy` 修正为 `0`（scene.json 两处：far `dy: -14 → 0`，near `dy: -4 → 0`）
  - `entity.y` 即腿底接地线；`anchorY`（`FAR_Y`/`NEAR_Y`）即地面，无需额外偏移

### T3-2 drawChessTable 比例（依赖 docs/visual-design-spec.md v3）
- [ ] **暂挂** — `docs/visual-design-spec.md` 不存在，请补充规格文件或注明目标比例后继续

---

## 汇总统计

| 类别 | 总计 | 已修 | 灰色地带 | 待修 |
|------|------|------|----------|------|
| (a) 硬编码色 | 22 | 17 | 5 | 0 |
| (b) 伪3D几何 | 12 | 12 | 0 | 0 |
| (c) 缺 lineStyle(0) | 14 | 14 | 0 | 0 |
| T3 锚点/比例 | 2 | 1 | 0 | 1 |
| **合计** | **50** | **44** | **5** | **1** |

唯一未完成项：T3-2 棋桌比例，待规格文件。
