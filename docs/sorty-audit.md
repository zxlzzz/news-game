# sortY 审计报告

审计日期：2026-07-11  
分支：`claude/animation-cleanup-batch-slhxuf` / `news-pipeline-mvp`  
排序规则：`EntityManager` 按 `_sortY ?? y` 升序绘制，排序键应等于实体视觉最低点（地面接触线）的世界 Y。

---

## 实体排序表

| 实体类型 | 排序键 | 视觉最低点 | diff(px) | 判定 | 依据（文件:行号） |
|---|---|---|---|---|---|
| bench | `y` | `y`（腿底部=y） | 0 | ✅ 一致 | `drawBench.js:34` |
| chair-l | `y` | `y`（腿底=y） | 0 | ✅ 一致 | `drawChairL.js:22` |
| chair-r | `y` | `y`（腿底=y） | 0 | ✅ 一致 | `drawChairR.js:22` |
| lamp | `y` | `y`（底座底=y） | 0 | ✅ 一致 | `drawLamp.js:18` |
| trash | `y` | `y`（梯形底=y） | 0 | ✅ 一致 | `drawTrash.js:24` |
| hydrant | `y` | `y`（底座底=y） | 0 | ✅ 一致 | `drawHydrant.js:15` |
| mailbox | `y` | `y`（立柱从y向上） | 0 | ✅ 一致 | `drawMailbox.js:14` |
| planter | `y` | `y`（花箱底=y） | 0 | ✅ 一致 | `drawPlanter.js:18` |
| phonebooth | `y` | `y`（主体底=y） | 0 | ✅ 一致 | `drawPhoneBooth.js:30` |
| vending | `y` | `y`（主体底=y） | 0 | ✅ 一致 | `drawVending.js:16` |
| chess-table | `y` | `y`（外腿底=y） | 0 | ✅ 一致 | `drawChessTable.js:20` |
| manhole | `y` | `y`（椭圆中心=y，地面预通道渲染） | 0 | ✅ 一致（预通道） | `drawManhole.js:10` |
| busstop-bench | `y`（bench entity y） | `y`（腿底=entity.y） | 0 | ✅ entity内部一致；但见"锚点漂移"注 | `drawBusStopBench.js:18` |
| NPC（行走） | `npc.y` | `npc.y`（脚底） | 0 | ✅ 一致 | `Npc.js`, `BaseStateMachine` |
| NPC（坐下） | `bench.y ± 1` | `bench.y`（视觉与长椅齐） | ≤1 | ✅ 设计偏移 | `SocialLayer.js` sitDown |
| chess NPC | `y + 1` | `y`（与棋台对齐） | +1 | ✅ 设计偏移 | `SocialLayer.js` chessAssign |
| tree | `y - height*0.35` | `y`（树干底=y） | `-height*0.35`（负值） | ✅ 设计偏移（树冠遮挡逻辑） | `drawTree.js:12`; `SceneInitializer` |
| stall | `y`（`_sortY = y` explicit） | `y`（摊位极底=y） | 0 | ✅ 设计偏移（已显式赋值） | `drawStall.js:8` |
| busstop-roof | `pillarBottomY` | `pillarBottomY`（柱子落地） | 0 | ✅ 设计偏移（显式赋值） | `busstop.js` spawnBusStop |
| building | `y + facadeH`（`BuildingEntity._sortY`） | `y + facadeH ≈ BUILDING_BASE_Y` | 0 | ✅ 设计偏移（立面底） | `BuildingEntity.js:12` |
| sign（路牌） | `y = 202`（`BUILDING_BASE_Y - 8`） | `y = 202`（面板底） | 0（entity内） | ⚠️ 空气锚（详见下） | `SceneInitializer.js:83` |
| newsrack | `y` | `y + 9s`（脚线向下9步） | `+9s` | 🐛 空气锚 | `drawNewsRack.js:52-54` |
| drain（地漏） | `y` | `y + h/2 ≈ y + 13s` | `+h/2 ≈ +13s` | 🐛 锚点漂移（居中锚，非底锚） | `drawDrain.js:12` |
| fountain | `y` | `y + 6s`（喷嘴圆底） | `+6s` | 🐛 空气锚（次要） | `drawFountain.js:57` |
| busstop-bench（远站，dy=-14） | `bench.y = FAR_Y - 14 = 254` | `254`（腿底） | 0（entity内） | 🐛 锚点漂移（详见下） | `scene.json` bench.dy=-14 |
| busstop-sign（公交站牌） | N/A（bgGraphics直绘） | N/A | N/A | ℹ️ 不参与entity排序 | `drawBusStopBay.js` bgGraphics pass |

> **s = `depthScale(y)`**，场景中间位置约 1.0。所有 diff 单位为缩放后像素（视觉像素）。

---

## Bug 详述

### 🐛 sign — 空气锚（高风险）

**现象**：路牌实体 `y = BUILDING_BASE_Y - 8 = 202`，sortY = 202。建筑实体 `_sortY = y + facadeH ≈ BUILDING_BASE_Y = 210`。

因此路牌先于建筑绘制（sortY 202 < 210），建筑立面（`drawRect(bx, by, bw, facadeH)`）会把路牌覆盖掉，路牌在建筑前方却被建筑立面完全遮挡。

**根因**：`SceneInitializer.js:83` 将 sign y 设为 `BUILDING_BASE_Y - 8 = 202`，意图让路牌贴墙，但排序键应 ≥ `building._sortY` 才能画在建筑之上。

---

### 🐛 newsrack — 空气锚（中风险）

**现象**：`drawNewsRack.js:52-54` 画了两条脚线 `g.lineTo(x - hw*0.3, y + 9*s)` / `g.lineTo(x + hw*0.3, y + 9*s)`，视觉最低点 = `y + 9s`，但 sortY = `y`。

**影响**：当路人从报刊亭前经过（NPC y ≈ y+9s）时，路人会正确压在报刊亭之上（NPC sortY > newsrack.y），但脚线实际悬在 NPC 之下，偶发脚线被 NPC 遮挡的穿帮感。

---

### 🐛 drain — 锚点漂移（中风险）

**现象**：`drawDrain.js:12` 使用 `py = p.y - h/2`，矩形从 `y - h/2` 到 `y + h/2`，地漏以 y 为**几何中心**而非底部锚点。视觉最低点 = `y + h/2 ≈ y + 13s`，比 sortY 低约 13s。

**影响**：走过地漏附近的 NPC 若 y 落在 `[drain.y, drain.y + 13s]` 区间，NPC 会被地漏的下半截遮挡（地漏绘制在 NPC 之上），与深度预期相反。

---

### 🐛 fountain — 空气锚（低风险）

**现象**：`drawFountain.js:57` 喷嘴外圈 `drawCircle(x, y - 2*s, 8*s)`，圆心在 `y - 2s`，半径 `8s`，底部 = `y + 6s`。sortY = `y`（主池 prepass 渲染，不参与entity排序；但喷嘴若为entity则存在+6s漂移）。

**影响**：喷泉目前作为背景道具在 prepass 绘制，NPC 可与喷泉正确互动；但若未来将 fountain 提升为 PropEntity，需修正 sortY = y + 6s。

---

### 🐛 busstop-bench（远站，dy=-14）— 锚点漂移（中风险）

**现象**：`scene.json` 远站公交椅 `dy = -14`，导致 `bench.y = FAR_Y - 14 = 254`。椅腿着地点为 y = 254，但远行人道地面实际为 `FAR_Y = 268`，椅子悬空 14px。

**影响**：
1. 公交椅视觉上悬浮于地面之上 14px。
2. NPC 落座时 `npc._sortY = bench.y ± 1 = 254`，但路人漫游区 y ≈ 240，坐着的 NPC sortY 反而高于站立行人，偶发遮挡错误。

**注**：此 bug 已在 animation-cleanup 分支积压清单中记录，本报告仅确认现状。

---

## 修复建议（按风险排序）

| 优先级 | 实体 | 建议修复方式 |
|---|---|---|
| P1 | sign（路牌） | 将 sign entity 的 `_sortY` 设为 `BUILDING_BASE_Y + 1`（或直接 `y + panelHeight`），保证路牌绘于建筑立面之上；或将路牌改为 bgGraphics 先绘（建筑之后、地面之前）。 |
| P2 | busstop-bench（dy=-14） | `scene.json` 将远站 bench `dy` 改为 `0`（或匹配真实地面偏移），使 bench.y = FAR_Y = 268。 |
| P2 | drain | 改 `drawDrain.js` 使用底锚：`py = p.y`，矩形 `drawRect(x - w/2, y - h, w, h)`；或将 PropEntity.y 定义为中心并在 spawn 时 +h/2 补偿。 |
| P3 | newsrack | 改 `drawNewsRack.js` 脚线终点为 `y`（去掉 `+ 9*s`），或将 spawnNewsRack 的 y 下移 9s，或显式设 `entity._sortY = entity.y + 9 * depthScale(entity.y)`。 |
| P4 | fountain | 暂不修改；若 fountain 升级为 PropEntity 时，设 `_sortY = y + 8 * depthScale(y)`（包住喷嘴底部）。 |

---

*本报告为只读分析，不含任何代码修改。*
