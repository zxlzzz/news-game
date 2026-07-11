# photo2entity — 现实照片 → AI 生成场景物体（设计草案 v0）

> 状态：占位草案。正式设计在 AI 场景生成阶段展开（前置：PropEntity 拆解 + Layout 进 scene.json schema）。

## 目标

从现实拍摄的照片中提取一个游戏里没有的物体（如奇怪的雕塑、小吃车、路障），
由 AI 生成其绘制代码与交互行为，经确定性校验后入库，全程不需要人手写绘制代码。

## 管线（五段）

```
照片 → ①视觉抽象 → ②生成 → ③确定性校验 → ④渲染目检 → ⑤交互接线
```

1. **视觉抽象**：vision 模型描述物体的结构分解（几何块、比例、地面接触线），
   输出受约束的中间描述，不直接出代码。
2. **生成**：优先走声明式 draw-ops JSON（复用 attachment schema 的解释器思路：
   op 枚举 ellipse/rect/poly/arc/line，颜色仅 FILL 常量 + lenv，y-anchor=最低点）。
   超出 draw-ops 表达力的复杂物体，降级为生成 JS（以 `entity/seat/` 为模板），但需人审。
3. **确定性校验**：schema / 坐标界 / 顶点数 / op 数 / 颜色枚举，硬性闸门，不过即拒
   （与 attachment、新闻管线共用校验基建）。
4. **渲染目检**：生成 → 渲染 PNG →（可选）视觉模型批注 → 人工终审。
5. **交互接线**：交互不生成新代码，只做**声明**——tags（affordance 语义）、
   slot 定义（复用 seat/smart-prop 槽位系统）、obstacle AABB。
   涉及 NPC 姿势的交互一律走角度空间 → fk_bake.py，禁止直出关节坐标。

## 铁律（继承自 CLAUDE.md）

- LLM 不出关节坐标；颜色不出 FILL 枚举之外的值；y-anchor = 视觉最低点 = 地面接触线。
- 生成物必须过校验器才进 repo；校验器不过 = 拒，不修补。

## 待定

- draw-ops 表达力上限在哪（曲线多的物体是否值得加 op）
- 交互动作声明的 schema（slot + 进入/退出姿势 clip id 引用）
- 与 scene.json schema 化的合流点