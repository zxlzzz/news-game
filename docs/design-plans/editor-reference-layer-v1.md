# 编辑器参照层设计 v1.0

> 冻结决策记录。日期：2026-07-25。
> **C-1b 补完记录**（日期：2026-08-02）：C-1 当时只实现了 D1 三种引用里的
> 「手持道具」「环境物件」两种的读侧渲染（`_drawContextRef`），`exportJSON`
> 三个分支（cycle/overlay、duet、variant）都没有写出 `context`，`index.html`
> 也没有设置面板——全库零 clip 带 `context`，D5 的交叉检查从未被真实数据
> 触发过。C-1b 补上了写路径（三个 exportJSON 分支 + 侧栏面板）、duet 分支
> 加载时不再无条件清空 `clipContext`，并补上第三种引用「对手方角色」
> （`context.counterpart`，取值来自 skeleton 名）——但 D3 的「两档画法」
> 只定义了道具/环境物件的几何渲染规格，没有给第三种定规格，所以
> `counterpart` 只在画布左上角标一行文字（"对手骨架: xxx"），不画完整的
> 第二具骨架，这不是偷懒漏做，是 D3 本来就没要求。第一个真实数据用例是
> `assets/animations/overlay/lift.json` 补的 `context:{held:'guitar'}`，
> 跟 A-1 新增的 `ATTACHMENT_DEFS.guitar.heldPose:'lift'` 互相指回，让
> D5 的交叉检查（`sth/tools/validate.mjs`）第一次被真实跑到并通过。

## 背景

clip 与它依赖的参照物分居两处声明，编辑器只显示人物，作画时看不到参照物。

例：`AttachmentDefs.js` 中 `broom` 为「`hand_r` 锚点、长 50px、角度 15°」。
要画扫地动作，需让这根 50px 的线正好扫到地面，但编辑器里看不到它
→ 只能盲摆、导出、进游戏、发现不对、返工。

后果可测量：`BehaviorScripts.js` 中唯一的 `tier: 1` 脚本 `sweep` 被注释掉，
注释为「需要 sweep clip 入库后启用」。**内容线卡在素材产出上。**

## 决策

### D1 — clip 增加 `context` 字段，只写引用

`context` 只写引用名，**不得抄录任何几何数值**。
扫帚长度住在 `AttachmentDefs.js`；抄进 clip 即产生第二住址，
改动后所有 clip 静默失效且无人报错。

三种引用：手持道具、环境物件、对手方角色。

### D2 — 参照物只读

参照层不提供拖拽手柄或任何编辑能力。参照物几何只能改数据表。

### D3 — 两档画法

- **手持道具：画准。** `AttachmentDefs.draw` 是纯数据描述符
  （`rect` / `circle` / `line` + 偏移），编辑器写一个解释器即可，不复制逻辑。
- **环境物件：只画示意。** 一个方框 + 一条关键高度线，
  数据取自 `PROP_DEFAULTS` 的 `w`/`h` 与 `smartDef.slots` 的 `dx`/`dy`。

理由：环境物件的绘制在 `js/entity/` 下是真实 PixiJS 实体代码，
搬进编辑器画布即复制出第二住址。而摆姿势需要的是
「桶口在多高、人站桶前多远」，不是外观。

### D4 — `context` 是作画期元数据

运行时不消费 `context`。运行时已通过 `ATTACHMENT_DEFS` / affordance 系统
知道 NPC 手里拿什么、站在哪。

附带收益：`context` 同时是目前完全缺失的文档
（"本 clip 假设右手持扫帚"这一事实当前不记录在任何地方）。

### D5 — 交叉检查

`validate.mjs`：`context` 进入顶层字段白名单；
声明了手持道具的 clip，若对应 `ATTACHMENT_DEFS` 条目的 `heldPose` 未指回本 clip，
输出警告。

## 明确不做

- 编辑器还原环境物件外观。
- 参照物可编辑。
- 运行时读取 `context`。