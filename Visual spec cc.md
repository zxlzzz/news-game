# 视觉规范 — 实施参考（CC 用）

> 阅读本文件前先阅读 `docs/visual-design-spec.md` 了解设计原则。
> 本文件提供代码模板和合规检查清单。

---

## 公共函数

以下两个函数在改造期间每个 draw 文件内部复制使用，后续架构重构时统一提取到 `js/core/DrawUtil.js`。

### lenv — 环境线 lineStyle

```js
import {
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}
```

`drawBuilding.js` 已有此函数，视为标准实现。其他 draw 文件对齐。

### drawGroundShadow — 地面投影

```js
function drawGroundShadow(g, x, y, halfW) {
  g.lineStyle(0);
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(x, y, halfW * 1.1, halfW * 0.33);
  g.endFill();
}
```

`halfW` = 实体正面宽度的一半。调用时机：draw 函数内所有其他绘制之前。

---

## 三面体模板

三面法作用于每个独立体块，不只是最大的主体。一个实体由多个体块叠加时（底座+主体+顶部），每个体块各自画侧面和顶面。

浅色材质方块（光源左上）：

```js
export function drawExample(g, p) {
  g.lineStyle(0);                        // ← 铁律

  const { x, y } = p;
  const s     = p.scale ?? 1;
  const baseY = y;
  const W = 30 * s, H = 40 * s;
  const D = W * 0.2;                     // 侧面深度
  const DY = D * 0.6;                    // 顶面纵向缩短

  // 0. 地面阴影
  drawGroundShadow(g, x, y, W / 2);

  // 1. 侧面（FILL_MID）
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(x + W/2,     y);
  g.lineTo(x + W/2 + D, y - DY);
  g.lineTo(x + W/2 + D, y - H - DY);
  g.lineTo(x + W/2,     y - H);
  g.closePath();
  g.endFill();

  // 2. 正面（FILL_LIGHT）
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(x - W/2, y - H, W, H);
  g.endFill();

  // 3. 顶面（FILL_PAPER）
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(x - W/2,       y - H);
  g.lineTo(x - W/2 + D,   y - H - DY);
  g.lineTo(x + W/2 + D,   y - H - DY);
  g.lineTo(x + W/2,       y - H);
  g.closePath();
  g.endFill();

  // 4. 内部细节（按需）
  // ...

  // 5. 轮廓线（最后）
  lenv(g, baseY, 0.85);
  g.moveTo(x - W/2, y);
  g.lineTo(x - W/2, y - H);
  g.lineTo(x + W/2, y - H);
  g.lineTo(x + W/2, y);
  // 侧面轮廓
  g.moveTo(x + W/2, y - H);
  g.lineTo(x + W/2 + D, y - H - DY);
  g.lineTo(x + W/2 + D, y - DY);
  g.lineTo(x + W/2, y);
  // 顶面轮廓
  g.moveTo(x - W/2, y - H);
  g.lineTo(x - W/2 + D, y - H - DY);
  g.lineTo(x + W/2 + D, y - H - DY);
}
```

深色材质：将上面的 `FILL_PAPER → FILL_LIGHT`、`FILL_LIGHT → FILL_MID`、`FILL_MID → FILL_SHADE`。

---

## 树冠明暗半球法

不用三面。每个 blob 画两层：

```js
// 暗底
g.lineStyle(0);
g.beginFill(FILL_MID, 1);
g.drawCircle(cx + dx, cy + dy, blobR);
g.endFill();

// 亮面（偏左上，略小）
g.beginFill(FILL_LIGHT, 1);
g.drawCircle(cx + dx - blobR * 0.15, cy + dy - blobR * 0.15, blobR * 0.85);
g.endFill();
```

外轮廓保持现有算法。

---

## 车辆顶面条

车辆保持侧视轮廓，在车顶区域加一条亮带：

```js
// 沿车顶曲线内侧，画一条 FILL_PAPER 窄带（高度 ≈ 车高 * 0.08）
```

轮子改用 `FILL_SHADE`（轮胎）+ `FILL_MID`（轮毂），线条用 `lenv`。

---

## 建筑侧面

在现有 `_facade` 之后、轮廓线之前插入：

```js
// 侧面（右侧）
const sideW = Math.round(w * 0.15);
g.lineStyle(0);
g.beginFill(FILL_MID, 1);
g.drawRect(x + w, building.y, sideW, H);
g.endFill();
```

屋顶相应延伸为平行四边形顶面。

---

## 需要改造的文件清单

以下文件存在硬编码颜色或缺少体积表达，需要按规范改造：

| 文件 | 问题 |
|------|------|
| `drawHydrant.js` | 5 个硬编码灰值，无体积，无阴影 |
| `drawFountain.js` | 4 个硬编码灰值，无阴影 |
| `drawPhoneBooth.js` | 6 个硬编码灰值，无体积，无阴影 |
| `drawVending.js` | 7 个硬编码灰值，无体积，无阴影 |
| `drawStall.js` | 4 个硬编码灰值，无阴影 |
| `drawMailbox.js` | 4 个硬编码灰值，无体积，无阴影 |
| `drawLamp.js` | 灯箱/底座硬编码灰值，无阴影 |
| `drawNewsRack.js` | 待审计 |
| `drawPlanter.js` | 待审计 |
| `drawTrash.js` | 待审计 |
| `drawBench.js` | 待审计 |
| `drawBusStopBench.js` | 待审计 |
| `drawChairL/R.js` | 待审计 |
| `drawSign.js` | 待审计 |
| `drawBusStopRoof.js` | 待审计 |
| `drawChessTable.js` | 待审计 |
| `drawTree.js` | 无体积（单色 blob），无阴影 |
| `drawVehicle.js` | `_wheel` 硬编码灰值，无顶面条 |
| `drawBuilding.js` | 无侧面（其他均已合规） |

---

## 合规检查清单

改造或新建任何 draw 文件时逐条检查：

```
□ 第一行 g.lineStyle(0)
□ 所有 beginFill 只用 FILL_ 常量（+ alpha 微调）
□ 唯一例外色：0x000000 / 0xffffff（低 alpha 叠加）
□ 所有线条通过 lenv() 设置
□ lenv 内 depthLineColor 使用 ENV_LINE_LIGHT / ENV_LINE_DARK
□ 有体积实体画了三面（或明暗半球）
□ 绘制顺序：阴影 → 侧面 → 正面 → 顶面 → 细节 → 轮廓
□ 有地面阴影（0x000000, 0.12）
□ 侧面 D ≈ W * 0.2
□ 顶面缩短 = D * 0.6
```