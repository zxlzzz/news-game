# 视觉规范 — 实施参考（CC 用）

> 先阅读 `docs/visual-design-spec.md` 理解原则。本文件提供代码模板和改造清单。
> 视角：侧视图。三面法是伪 3D 装饰，不是等轴投影。
> `s = p.scale ?? 1`：实体缩放系数，基于深度位置。所有像素尺寸乘以 s。

---

## 公共函数

改造期间每个 draw 文件内部复制使用，后续提取到 `js/core/DrawUtil.js`。

### lenv — 环境线

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

最终线宽 = `depthLineWidth(baseY) * wScale`。`depthLineWidth` 由 Y 位置决定（远细近粗，下限 0.5），`wScale` 是实体内部的层级缩放。

### drawGroundShadow — 软边地面投影

```js
/**
 * @param {Graphics} g
 * @param {number} cx      实体中心 X
 * @param {number} cy      实体地面 Y
 * @param {number} rx      内层椭圆 X 半径
 * @param {number} ry      内层椭圆 Y 半径
 */
function drawGroundShadow(g, cx, cy, rx, ry) {
  // 光源左上 → 阴影偏右下
  const ox = rx * 0.15;
  const oy = ry * 0.25;
  const sx = cx + ox;
  const sy = cy + oy;

  g.lineStyle(0);
  // 外层
  g.beginFill(0x000000, 0.03);
  g.drawEllipse(sx, sy, rx * 1.6, ry * 1.6);
  g.endFill();
  // 中层
  g.beginFill(0x000000, 0.05);
  g.drawEllipse(sx, sy, rx * 1.3, ry * 1.3);
  g.endFill();
  // 内层
  g.beginFill(0x000000, 0.08);
  g.drawEllipse(sx, sy, rx, ry);
  g.endFill();
}
```

**阴影形状要粗略匹配物体：**
- 方形物体：`ry ≈ rx * 0.3`
- 圆形物体：`ry ≈ rx * 0.5`
- 长条形物体：`ry ≈ rx * 0.15`
- `rx` 一般 ≈ 实体正面宽度的一半

---

## 三面体模板

浅色材质方块，**仅当体块宽度 ≥ 16\*s 时使用**：

```js
export function drawExample(g, p) {
  g.lineStyle(0);                        // ← 铁律

  const { x, y } = p;
  const s     = p.scale ?? 1;
  const W = 30 * s, H = 40 * s;
  const D = W * 0.2;                     // 侧面深度（W 是屏幕像素宽度）
  const DY = D * 0.6;                    // 顶面纵向缩短

  // 0. 地面阴影（最先）
  drawGroundShadow(g, x, y, W / 2, W / 2 * 0.3);

  // --- 体块A（如果有多个体块，每个重复以下模式） ---

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

  // 4. 内部细节 / 材质纹理（按需）
  // ...

  // 5. 该体块的轮廓线（体块完成后立即画，不等其他体块）
  lenv(g, y, 0.85);
  // ... 正面、侧面、顶面轮廓

  // --- 如有体块B，接着重复侧→正→顶→细节→轮廓 ---
}
```

**深色材质**：PAPER→LIGHT、LIGHT→MID、MID→SHADE。

**宽度 < 16\*s 的部件**：不画三面，只用 `lenv` 画线条 + 单色 `beginFill` 填充。

---

## 材质纹理参考

在填充面之后、轮廓线之前画纹理：

```js
// 砖/石 — 细横线
lenv(g, baseY, 0.3);
g.lineStyle(lw * 0.3, lc, 0.15);  // 极低 alpha
for (let ly = top; ly < bottom; ly += 8 * s) {
  g.moveTo(left, ly); g.lineTo(right, ly);
}

// 金属 — 转折高光线（例外：不走 lenv，直接手写 0xffffff）
g.lineStyle(0.5 * s, 0xffffff, 0.25);
g.moveTo(edgeX, top); g.lineTo(edgeX, bottom);

// 玻璃 — 白色反射块（例外：0xffffff 低 alpha）
g.lineStyle(0);
g.beginFill(0xffffff, 0.15);
g.drawRect(gx + 2*s, gy + 2*s, gw * 0.4, gh * 0.3);
g.endFill();
```

---

## 树冠明暗半球法

```js
// 暗底
g.lineStyle(0);
g.beginFill(FILL_MID, 1);
g.drawCircle(cx, cy, blobR);
g.endFill();

// 亮面（偏左上，略小）
g.beginFill(FILL_LIGHT, 1);
g.drawCircle(cx - blobR * 0.15, cy - blobR * 0.15, blobR * 0.85);
g.endFill();
```

---

## 当前文件修复清单

### 需要删除阴影的

这些文件的阴影尺寸/比例完全错误，先删掉阴影，按正确参数重新加：

| 文件 | 问题 |
|------|------|
| `drawBench.js` | radiusX=150*s，比长椅还大 |
| `drawBusStopBench.js` | 比例过大 |
| `drawChairL.js` / `drawChairR.js` | 椅子太小，阴影比椅子大 |
| `drawFountain.js` | 公式参数用错 |
| `drawStall.js` | 摊位不该用单椭圆 |

修复方式：用 `drawGroundShadow`，rx/ry 按实际物体轮廓匹配。长椅用极扁椭圆（ry ≈ rx * 0.15），椅子用很小的椭圆。

### 需要删除侧面的

| 文件 | 原因 |
|------|------|
| `drawSign.js` | 挂牌是薄片，不该有 8.6*s 宽的体积。删掉侧面和顶面，保持平面 + 轮廓线 |
| `drawLamp.js` 灯箱部分 | 灯箱在臂尖左侧延伸，侧面却画在右侧，位置矛盾。灯箱宽 28*s > 16*s 可以保留三面，但侧面方向要改到左侧，或改为只画顶面不画侧面 |

### 需要补充结构的

| 文件 | 问题 |
|------|------|
| `drawNewsRack.js` | 侧面是空白色块。真实报架侧面应该有层板/报纸边缘的水平线条纹理（用 lenv 0.3–0.4 档画 2-3 条细线） |
| `drawHydrant.js` | dome 和顶栓仍缺侧面 |

### 结构正确，只需微调的

| 文件 | 微调 |
|------|------|
| `drawVending.js` | 阴影替换为 drawGroundShadow；玻璃面已有反射 ✓ |
| `drawPhoneBooth.js` | 阴影替换；可加金属高光线在框架边缘 |
| `drawMailbox.js` | 阴影替换；cap 侧面 Dc = 46*s * 0.2 = 9.2*s 略大，可缩到 0.15 |
| `drawChessTable.js` | 阴影替换 |
| `drawTrash.js` | 阴影替换 |
| `drawPlanter.js` | 阴影替换 |
| `drawBusStopRoof.js` | 无阴影 ✓，结构 OK |

### 不需要改动的

| 文件 | 状态 |
|------|------|
| `drawDrain.js` | ✓ 地面件，干净 |
| `drawManhole.js` | ✓ 地面件，干净 |

---

## 绘制顺序提醒

⚠️ 绘制顺序是**逐体块**的，不是实体全局分层：

```
地面阴影（整个实体最先）
→ 体块A：侧面 → 正面 → 顶面 → 细节/纹理 → 轮廓线
→ 体块B：侧面 → 正面 → 顶面 → 细节/纹理 → 轮廓线
→ ...
```

**轮廓线在每个体块完成填充后立即绘制**，不是整个实体最后统一画。

实体间按**接地点的屏幕 Y 坐标**从远到近排序。悬空物体用附属地面位置的 Y 值。

---

## 合规检查清单

```
□ 第一行 g.lineStyle(0)
□ 所有 beginFill 只用 FILL_ 常量（+ alpha）
□ 唯一例外色：0x000000 / 0xffffff（低 alpha）
□ 环境线通过 lenv() 设置；高光线（0xffffff）允许手写 lineStyle
□ lenv 的 depthLineColor 使用 ENV_LINE_LIGHT / ENV_LINE_DARK
□ 宽度 ≥ 16*s 的体块画了三面（或明暗半球）
□ 宽度 < 16*s 的部件用线条 + 单色填充，没有三面
□ 薄片/挂件没有侧面
□ 凹陷/内部空间用 FILL_SHADE（门洞、内部、出货口等）
□ 绘制顺序：阴影(全局最先) → 每个体块各自(侧→正→顶→细节→轮廓)
□ 轮廓线在每个体块完成后立即画，不是实体全局最后统一画
□ 阴影用 drawGroundShadow（三层软边 + 右下偏移）
□ 阴影形状粗略匹配物体轮廓
□ 侧面 D ≈ W * 0.2（W = 屏幕像素宽度，s = p.scale ?? 1）
□ 顶面缩短 = D * 0.6
□ 地面件 / 悬空件 / 被遮蔽件没有阴影
```