# CLAUDE.md

## 项目概述

新闻记者模拟器游戏，灵感来自 "We Become What We Behold"。玩家在2.5D俯视角街道场景中用取景框捕捉场景中的实体（NPC、建筑、道具），通过断章取义制造新闻。最终目标是接入Claude API生成新闻标题和社会反应。

当前阶段：Entity架构demo，场景中所有可见元素均可被取景框识别和标记。

## 技术栈

- **Phaser 3.80** — 从CDN加载，全局变量 `Phaser`
- **ES Modules** — 所有JS文件用 import/export
- **纯前端** — 无构建工具，本地 `python -m http.server 8080` 启动
- **火柴人动画** — 运行时用Phaser Graphics直接画，不用sprite sheet

## 项目结构

```
news-game/
├── index.html              # 入口，加载Phaser CDN + js/main.js
├── start.bat               # Windows启动脚本
├── assets/
│   └── animations/         # StickPuppet格式的JSON动画文件
│       ├── walk.json
│       ├── run.json
│       └── idle.json
└── js/
    ├── main.js             # Phaser.Game 配置和启动
    ├── StickRenderer.js    # 火柴人渲染器，读JSON画骨骼线条（不改动）
    ├── Entity.js           # 所有场景实体的基类（position/size/tags/getBounds/draw）
    ├── NPC.js              # 继承Entity；动态人物（动画、X/Y移动、深度缩放）
    ├── BuildingEntity.js   # 继承Entity；俯视角建筑（带类型标签如bank/hotel）
    ├── PropEntity.js       # 继承Entity；静态道具（路灯/长椅/垃圾桶/招牌）
    ├── EntityManager.js    # 统一管理所有Entity；深度排序绘制；矩形区域查询
    ├── Viewfinder.js       # 取景框（拖拽、对所有Entity碰撞检测、标签收集）
    └── scenes/
        └── StreetScene.js  # 主场景（地面背景、实体生成、摄像机、UI）
```

## Entity 架构

所有场景可见/可交互元素都继承 `Entity` 基类：

```
Entity (基类)
├── NPC              — 动态人物，用StickRenderer绘制，EntityManager写入深度scale
├── BuildingEntity   — 静态建筑（俯视楼顶），带 ['bank','building'] 等标签
└── PropEntity       — 静态道具，propType 枚举决定绘制方式和碰撞盒
    ├── 'lamp-far' / 'lamp-near'  — 路灯，y=FAR_Y 或 NEAR_Y
    ├── 'bench'                   — 长椅，y≈216（远端人行道）
    ├── 'trash'                   — 垃圾桶
    └── 'sign'                    — 招牌，propColor 对应建筑类型
```

### 坐标约定

- `entity.y` = 实体"底部"接触点，用于深度排序（Y越大=越近=越后画）
- `BuildingEntity.x` = 建筑左边缘（非中心），`getBounds()` 有覆盖
- NPC.getBounds() 随 `scale` 动态变化；EntityManager.update() 每帧写入 `npc.scale`

### 深度渲染顺序（Y升序）

```
Y=130  建筑（临街底边）
Y=131  招牌（建筑门口）
Y≈216  长椅（远端人行道）
Y≈230  垃圾桶（远端）
Y=252  远端路沿路灯 ← FAR_Y
Y=252–458  NPC（按实时Y插值排序）
Y=458  近端路沿路灯 ← NEAR_Y
Y≈472  垃圾桶（近端）
```

### 取景框与标签系统

`Viewfinder.updateCapture(entities)` 对所有存活可见实体做AABB检测，
`getCapturedTags()` 聚合框内所有实体的tags，返回去重列表供新闻生成使用。

典型场景：
- 框住行人 + 警察 → `['pedestrian', 'officer']`
- 框住银行建筑 → `['bank', 'finance', 'building']`
- 框住银行门口 → `['bank', 'finance', 'building', 'sign', 'finance']`

## 动画数据格式

使用自研 StickPuppet 工具生成的JSON，格式：
```json
{
  "name": "walk",
  "fps": 8,
  "frames": [
    {
      "head": [x, y], "neck": [x, y],
      "l_elbow": [x, y], "r_elbow": [x, y],
      "l_hand": [x, y], "r_hand": [x, y],
      "body": [0, 0],
      "l_knee": [x, y], "r_knee": [x, y],
      "l_foot": [x, y], "r_foot": [x, y]
    }
  ]
}
```
坐标相对于body（髋部），body始终是[0,0]。y向下为正。火柴人总高约170px（head到foot）。

## 骨骼层级

```
body (root)
├── neck
│   ├── head
│   ├── l_elbow → l_hand
│   └── r_elbow → r_hand
├── l_knee → l_foot
└── r_knee → r_foot
```

## 关键设计决策

- **运行时渲染而非sprite sheet**：StickRenderer用Graphics对象每帧画线条，NPC将renderer引用存在自身，draw()自调用
- **统一Entity架构**：所有场景元素（NPC/建筑/道具）继承Entity，EntityManager统一管理、排序、绘制；取景框只需调用 `getAlive()` 即可检测任意类型
- **深度缩放只作用于动态实体**：EntityManager.update() 检查 `!e.static && 'scale' in e` 才写入深度scale，建筑和道具不受影响
- **分层渲染**：bgGraphics（地面，绘一次）+ entityGraphics（所有Entity，每帧清空重绘）+ vfGraphics（UI）
- **静态实体参与碰撞**：建筑和道具 `alive=true, visible=true`，始终参与 `getAlive()` 返回，可被取景框捕获并贡献标签
- **StickRenderer 不修改**：多个NPC共享同一份动画数据，renderer本身无状态

## 待开发功能

- [x] 2.5D视角改造（NPC Y轴移动、深度排序、动态缩放）
- [x] 背景改为俯视角广场/街道
- [x] 拍照/发布按钮
- [x] 统一Entity架构（建筑/道具/NPC均可被取景框识别）
- [ ] 接入Claude API生成新闻标题
- [ ] NPC语义标签组合 → AI生成新闻
- [ ] 社会稳定度 + 个人财富数值系统
- [ ] 更多NPC动画和行为类型
- [ ] NPC对事件的反应行为（看到警察走开，路人聚集围观等）

## 编码规范

- 中文注释
- 类用PascalCase，函数和变量用camelCase
- 每个模块职责单一，通过构造函数注入依赖
- 修改StickRenderer时注意：多个NPC共享同一份动画数据，renderer本身无状态
- 新增实体类型：继承Entity，覆盖 getBounds()/draw()，添加到 StreetScene._spawnXxx()
