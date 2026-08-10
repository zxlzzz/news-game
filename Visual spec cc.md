# 视觉规范 — 实施参考（CC 用）

> 先读 `Visual design spec.md`。本文件给代码模板和改造清单。
> 历史核心变更（已被 O 系列取代）：曾经"删掉所有三面体积和阴影，回归纯 2D
> 平面"——O-1 起本项目重新引入三面体积（O-3 `drawObliqueBox` 盒子模板）与
> 斜投影（O-2 `Projection.js`），这条不再是当前画风承诺，具体规则以
> `docs/roadmap.md` O 系列落地状态为准，本文件其余模板/改造清单仍按纯 2D
> 平贴画法编写，尚未随 O 系列更新。

---

## 公共函数

### lenv

O-1 起 `lenv()` 收编成 `js/core/Layout.js` 的单一 export（原 28 份文件各自复制的
同一份实现已删除），各 draw 文件直接 import，不再本地定义：

```js
import { lenv } from '../../core/Layout.js';

// 用法不变：
const lc = lenv(g, baseY, wScale);  // 设置 g.lineStyle，返回线色供后续 stroke 复用
```

---

## draw 函数模板（纯 2D）

```js
export function drawExample(g, p) {
  g.lineStyle(0);                        // ← 铁律

  const { x, y } = p;                   // y = 物体最低点
  const s = p.scale ?? 1;

  // 1. 填充（用 FILL_ 常量）
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(x - W/2, y - H, W, H);
  g.endFill();

  // 2. 细节 / 材质纹理
  // ...

  // 3. 轮廓线（最后）
  lenv(g, y, 0.85);
  g.drawRect(x - W/2, y - H, W, H);
}
```

---

## 材质纹理代码参考

```js
// 砖/石 — 细横线
lenv(g, baseY, 0.3);
for (let ly = top; ly < bottom; ly += 8 * s) {
  g.moveTo(left, ly); g.lineTo(right, ly);
}

// 金属 — 转折高光线（例外：不走 lenv）
g.lineStyle(0.5 * s, 0xffffff, 0.25);
g.moveTo(edgeX, top); g.lineTo(edgeX, bottom);

// 玻璃 — 反射块（例外：0xffffff）
g.lineStyle(0);
g.beginFill(0xffffff, 0.15);
g.drawRect(gx, gy, gw * 0.4, gh * 0.3);
g.endFill();

// 植物 — 明暗叠色
g.lineStyle(0);
g.beginFill(FILL_MID, 1);
g.drawCircle(cx, cy, r);
g.endFill();
g.beginFill(FILL_LIGHT, 1);
g.drawCircle(cx - r*0.15, cy - r*0.15, r*0.85);
g.endFill();
```

---

## 改造清单

**所有文件统一操作：**

1. 删掉 `drawGroundShadow` 函数及其调用
2. 删掉所有侧面绘制代码（注释中标注 `side` / `侧面` 的段落）
3. 删掉所有顶面绘制代码（注释中标注 `top` / `顶面` 的段落）
4. 保留正面填充 + 细节 + 轮廓线
5. 确认所有 `beginFill` 用 FILL_ 常量
6. 确认所有线条用 lenv
7. 确认 `g.lineStyle(0)` 在函数第一行

**逐文件特殊修复：**

| 文件 | 额外修复 |
|------|----------|
| `drawBusStopBench.js` | y 锚点错误。当前 y = 座面顶部，腿向下画到 y+34\*s。改为 y = 腿底部（地面），座面在 y-34\*s 处 |
| `drawChessTable.js` | 桌面厚度 th=20\*s 太厚、桌腿 5\*s 太短。改为桌面厚度 ≈ 5\*s，桌腿高度 ≈ 20\*s |
| `drawFountain.js` | y 锚点是中心，应改为底部。但 fountain 是地面件（椭圆），中心作锚点可接受，不强制改 |
| `drawDrain.js` | 同 fountain，地面件中心锚点可接受 |
| `drawManhole.js` | 同上 |

---

## 合规检查清单

```
□ 第一行 g.lineStyle(0)
□ 所有 beginFill 只用 FILL_ 常量（+ alpha）
□ 例外色仅 0x000000 / 0xffffff（低 alpha 纹理/高光/反射）
□ 环境线通过 lenv()；高光线（0xffffff）允许手写
□ depthLineColor 用 ENV_LINE_LIGHT / ENV_LINE_DARK
□ 无侧面、无顶面、无 drawGroundShadow
□ y = 物体最低点（地面件椭圆除外）
□ 绘制顺序：填充 → 细节/纹理 → 轮廓线
```