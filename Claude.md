# CLAUDE.md

## 项目概述

新闻记者模拟器游戏，灵感来自 "We Become What We Behold"。玩家在横版/2.5D街道场景中用取景框捕捉NPC，通过断章取义制造新闻。最终目标是接入Claude API生成新闻标题和社会反应。

当前阶段：基础demo，实现场景渲染、NPC活动、取景框交互。

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
    ├── StickRenderer.js    # 火柴人渲染器，读JSON画骨骼线条
    ├── NPC.js              # 单个NPC类（位置、动画、行为、标签）
    ├── NPCManager.js       # NPC的生成、更新、深度排序绘制
    ├── Viewfinder.js       # 取景框（拖拽、碰撞检测、标签收集）
    └── scenes/
        └── StreetScene.js  # 主场景（背景、NPC、取景框、摄像机）
```

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

- **运行时渲染而非sprite sheet**：StickRenderer用Graphics对象每帧画线条，性能无问题（10条线+1个圆/NPC），好处是动画数据改JSON就生效
- **NPC语义标签系统**：每个NPC带tags数组（如['pedestrian']），取景框通过getCapturedTags()收集框内标签，为后续API调用准备
- **2.5D纵深**（待实现）：NPC可在Y轴移动，按Y排序绘制，Y越大scale越大，制造纵深感

## 待开发功能

- [ ] 2.5D视角改造（NPC Y轴移动、深度排序、动态缩放）
- [ ] 背景改为俯视角广场/街道
- [ ] 拍照/发布按钮
- [ ] 接入Claude API生成新闻标题
- [ ] NPC语义标签组合 → AI生成新闻
- [ ] 社会稳定度 + 个人财富数值系统
- [ ] 更多NPC动画和行为类型

## 编码规范

- 中文注释
- 类用PascalCase，函数和变量用camelCase
- 每个模块职责单一，通过构造函数注入依赖
- 修改StickRenderer时注意：多个NPC共享同一份动画数据，renderer本身无状态