# v3 视觉合规审计

扫描范围：`js/entity/**/draw*.js` + `js/scenes/SceneRenderer.js`

图例：`[ ]` 待修 · `[x]` 已修 · `[~]` 灰色地带（见备注）

---

## (a) 非 FILL_PAPER/LIGHT/MID/SHADE 的硬编码填充色

### drawBuilding.js
- [ ] L316 `beginFill(0x000000, 0.07)` — 立面左侧"阴影"竖条 → 删除（伪3D方向光，见b）
- [ ] L361 `beginFill(0x000000, 0.14)` — 楼间小巷阴影 → 删除（伪3D，见b）

### drawHydrant.js
- [ ] L98 `lineStyle(hWidth, 0xffffff, 0.2)` — 金属高光线 → 删除（伪3D specular，见b）

### drawMailbox.js
- [ ] L36 `beginFill(0x000000, 0.6)` — 投信口凹槽 → 改为 `FILL_SHADE`（最深档位，保留几何）

### drawNewsRack.js
- [ ] L48 `beginFill(0x000000, 0.6)` — 投币/退票口凹槽 → 改为 `FILL_SHADE`

### drawPhoneBooth.js
- [ ] L35 `beginFill(0xffffff, 0.16)` — 玻璃反光条 → 删除（伪3D，见b）
- [ ] L43 `beginFill(0x000000, 0.7)` — 听筒/电话机体 → 改为 `FILL_SHADE`

### drawSign.js
- [~] L31 `lineStyle(1.7*s, 0xffffff, 0.7)` — 模拟文字行 → **保留**（白色低 alpha 模拟文字是表意用途，非光照模拟）

### drawVehicle.js
- [ ] L87  `beginFill(0xffffff, 0.15)` — 轿车后窗眩光 → 删除（伪3D，见b）
- [ ] L112 `beginFill(0xffffff, 0.15)` — 轿车前窗眩光 → 删除
- [ ] L146 `beginFill(0xffffff, 0.5)` — 轿车大灯 → 改为 `FILL_PAPER`（最亮档）
- [ ] L174 `beginFill(0x000000, 0.06)` — 轿车地面投影椭圆 → 删除（伪3D，见b）
- [ ] L251 `beginFill(0x000000, 0.05)` — 公交车地面投影椭圆 → 删除
- [ ] L286 `beginFill(0xffffff, 0.15)` — 公交车窗眩光 → 删除
- [ ] L303 `beginFill(0xffffff, 0.15)` — 公交车门窗眩光 → 删除
- [ ] L318 `beginFill(0xffffff, 0.5)` — 公交车大灯 → 改为 `FILL_PAPER`
- [ ] L421 `beginFill(0xffffff, 0.55)` — 摩托车大灯 → 改为 `FILL_PAPER`

### drawVending.js
- [ ] L37 `beginFill(0xffffff, 0.18)` — 玻璃前面板反光 → 删除（伪3D，见b）
- [ ] L55 `beginFill(0x000000, 0.9)` — 出货口凹槽 → 改为 `FILL_SHADE`

### SceneRenderer.js
- [~] L119 `beginFill(0xffffff, 0.92)` — 云朵 → **保留**（白云是表意色，非光照模拟）
- [~] L149 `lineStyle(2, 0xffffff, 0.6)` — 道路中心线 → **保留**（道路白线是真实交通标记）
- [~] L180 `beginFill(0xffffff, 0.68)` — 斑马线 → **保留**（同上）
- [ ] L161 `beginFill(0x000000, 0.04)` — 路面补丁/磨损纹理 → 删除（地面纹理伪3D）
- [ ] L198 `lineStyle(0.7, 0x000000, 0.05)` — 公园草地线条 → 改为 `lenv(g, gy, 0.15)` 用环境线系统

---

## (b) 伪 3D 残留（侧面/顶面几何、手绘阴影形状）

### drawBuilding.js
- [ ] L315–318 `beginFill(0x000000, 0.07)` — 立面左侧方向光"阴影"竖条（宽 3px，全高）→ **删除**
- [ ] L359–364 `beginFill(0x000000, 0.14)` — 楼间小巷手绘阴影矩形 → **删除**

### drawHydrant.js — `drawCylinder` 内局
- [ ] L29–37 `drawCylinder`: 将矩形切左右两半分别填 `FILL_LIGHT`/`FILL_MID` 来模拟圆柱明暗 → **改为单色**（`FILL_MID` 整体，一次 `drawRect`）
- [ ] L53–75 Dome 梯形同样左半 `FILL_LIGHT` / 右半 `FILL_MID` 模拟球面反射 → **改为单色** `FILL_MID`
- [ ] L95–108 `lineStyle(hWidth, 0xffffff, 0.2)` 高光线 → **删除**

### drawPhoneBooth.js
- [ ] L34–37 `beginFill(0xffffff, 0.16)` — 玻璃反光矩形覆盖层 → **删除**

### drawVehicle.js
- [ ] L87, L112 `beginFill(0xffffff, 0.15)` 于车窗内 — 玻璃眩光覆盖层 → **删除**
- [ ] L174–176 `beginFill(0x000000, 0.06); drawEllipse` — 轿车轮下地面投影 → **删除**（EntityManager.drawShadows 统一处理阴影）
- [ ] L251–253 `beginFill(0x000000, 0.05); drawEllipse` — 公交车地面投影 → **删除**
- [ ] L286 `beginFill(0xffffff, 0.15)` — 公交窗眩光 → **删除**
- [ ] L303 `beginFill(0xffffff, 0.15)` — 公交门窗眩光 → **删除**

### drawVending.js
- [ ] L36–39 `beginFill(0xffffff, 0.18)` — 玻璃前面板反光矩形 → **删除**

### SceneRenderer.js
- [ ] L159–169 `_drawRoadPatches` `beginFill(0x000000, 0.04)` — 路面磨损贴片 → **删除**（地面纹理是环境层任务，不属于 entity draw）

---

## (c) draw 函数入口缺 `g.lineStyle(0)`

### drawBuilding.js
- [ ] `drawBuilding` L339 — 缺 `g.lineStyle(0)` 首行

### drawBusStopBay.js
- [ ] `drawBusStopBays` L104 — 缺 `g.lineStyle(0)` 首行
- [ ] `_drawFarBusStop`  L44  — 内部 draw 函数缺 `g.lineStyle(0)` 首行
- [ ] `_drawNearBusStop` L75  — 内部 draw 函数缺 `g.lineStyle(0)` 首行

### drawTree.js
- [ ] `drawTree` L59 — 缺 `g.lineStyle(0)` 首行（函数从 `const jitter = ...` 开始，未清残留线宽）

### drawVehicle.js
- [ ] `_car`  L159 — 内部 draw 缺 `g.lineStyle(0)` 首行
- [ ] `_taxi` L198 — 内部 draw 缺 `g.lineStyle(0)` 首行（直接调 `_car`，_car 补后可省）
- [ ] `_bus`  L236 — 内部 draw 缺 `g.lineStyle(0)` 首行
- [ ] `_moto` L328 — 内部 draw 缺 `g.lineStyle(0)` 首行

### drawParkPath.js
- [ ] `drawParkPaths` L57 — 缺 `g.lineStyle(0)` 首行

### SceneRenderer.js（私有方法）
- [ ] `_drawGround`      L31  — 无 `g.lineStyle(0)` 首行
- [ ] `_drawRoadMarkings` L129 — 无 `g.lineStyle(0)` 首行
- [ ] `_drawRoadPatches`  L159 — 无（将整体删除）
- [ ] `_drawParkGrass`    L196 — 无 `g.lineStyle(0)` 首行
- [ ] `_drawCrosswalk`    L172 — 无 `g.lineStyle(0)` 首行

---

## T3 已知修复点

### T3-1 drawBusStopBench 锚点（对照 entity/seat 惯例）
现状：`p.y` 由 `anchorY + bench.dy` 计算（`dy=-14` for far, `dy=-4` for near），
      导致腿底接触点位于 `anchorY + bench.dy`，与地面表面 (`FAR_Y` / `NEAR_Y`) 存在偏差。
目标：`p.y` 应等于实际地面接触 Y（far: `FAR_Y - bayD = 268 - 9 = 259` 或对应 bike lane 表面）。
      待查：`busstop.js` 中 bench spawn 的 `by` 计算，以及 `drawBusStopBench` 内腿部终止点。

### T3-2 drawChessTable 比例（依赖 docs/visual-design-spec.md v3）
现状：`tw=58*s, topH=18*s, th=5*s`（桌面宽58，总高18，桌面厚5）。
**⚠ docs/visual-design-spec.md 不存在**，T3-2 暂挂起 — 请补充规格文件或直接在本票注明目标比例。

---

## 汇总统计

| 类别 | 总计 | 待修 | 灰色地带 |
|------|------|------|----------|
| (a) 硬编码色 | 22 | 17 | 5 |
| (b) 伪3D几何 | 12 | 12 | 0 |
| (c) 缺 lineStyle(0) | 14 | 14 | 0 |
| **合计** | **48** | **43** | **5** |
