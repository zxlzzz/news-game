# NPC 映射预览

入口：`http://127.0.0.1:8096/sth/motion-study/`（仓库根目录启动 HTTP 服务）。

已接入 Hsinlung 定下的 [映射规格](../../docs/design-plans/npc-skeleton-mapping.md)，默认双手挥动；提供正面与自由视角、播放/暂停、逐帧、调参和恢复默认。

- `skeleton-mapping.mjs`：共用映射算法，不依赖浏览器。`createSkeletonMapper(names, standIdleFrame0)` 返回纯函数 `mapFrame(sourceFrame, params, clipOrigin)`；输入位置单位米、Y 向上，`clipOrigin` 是片段第一帧 Hips。返回 H、N、neckEnd、head 和线段列表 `segs`，每段为 `[起点, 终点, 线宽倍数]`。不修改输入，投影由绘制端负责。
- `skeleton-params.json`：已定的 12 项比例/画法参数；相机参数留在预览端。
- `study.mjs` / `index.html`：加载数据和参数，消费同一映射函数；沿用参考调参器的画法，不烘焙或写回映射坐标。
- `motions.json`：既有六条源动作（站立、走路看手机、挠头、蹲看、鞠躬、双手挥动），660 帧、26 个源关节；映射按名字只读取需要的 16 个。源 NPZ 保持不变。

原 `retarget.mjs` / `strokes.mjs` 与 `scripts/check-motion-study.mjs` 属于旧试作，当前页面不再调用；旧检查不能作为新映射的验收。

已检查参考数据全部 660 帧，新函数与参考 HTML 原函数输出坐标完全一致；现有六条源数据计算无无效坐标。游戏和其余动作尚未接入，不承诺通用防穿模或精确手掌接触。
