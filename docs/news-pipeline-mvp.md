# 新闻管线 MVP — 设计文档

> 版本：T1 初稿  
> 分支：`claude/news-pipeline-mvp`  
> 范围：T2 取景截图 · T3 Provider 层 · T4 成稿流与存档

---

## 1. 取景框交互方案

### 1.1 现有基础

`js/camera/Viewfinder.js` 已实现常驻可拖拽/可缩放取景框（世界坐标系），挂到 `vfGraphics`（worldContainer zIndex=4）。`updateCapture(entities)` 每帧检测框内实体，`getCapturedTags()` 聚合标签。

### 1.2 MVP 输入流

```
[常驻取景框] ──拖动调整位置/大小──> 按 C 键 / 点"拍照"按钮
    │
    ▼
_takePhoto()
 ├─ 收集 entitySnapshot（ids + tags + 坐标 + 时间戳）
 ├─ 隐藏 vfGraphics，renderer.extract 出框内区域 PNG，恢复 vfGraphics
 └─ 打开成稿面板 NewsUI.openComposer(photoData)
```

**不新增"取景模式"开关**：取景框始终可见、可操作，降低模式切换认知负担。实体高亮描边在框捕获到实体时自动激活（`Viewfinder.draw()` 扩展），无需显式进入模式。

### 1.3 实体高亮描边

在 `Viewfinder.draw(g)` 尾部：对每个 `capturedEntities[i]`，用 `getBounds()` 取世界坐标包围盒，绘制 `lineStyle(2, 0xffcc00, 0.7)` 外框。纯绘制扩展，不改行为文件。

### 1.4 现有按钮映射

| 现有 | MVP 角色 |
|------|----------|
| `btnCapture`（拍照）| 触发 `_takePhoto()`，开启成稿面板 |
| `btnPublish`（发布新闻）| 移入成稿面板内部，改为"生成文章"按钮 |
| `headlinePanel` | 废弃（由成稿面板取代）|

---

## 2. 截图技术路径

### 2.1 核心 API

PixiJS 5 `renderer.extract.base64(target, format, quality, frame)` — `frame` 为屏幕像素空间 `PIXI.Rectangle`，直接裁剪 target 渲染结果。

### 2.2 实现步骤

```js
_extractViewfinderPng() {
  const vf = this.viewfinder;
  const z  = this.zoom;

  // 1. 世界坐标 → 屏幕像素坐标
  const sx = Math.round((vf.x - this.scrollX) * z);
  const sy = Math.round((vf.y - this.scrollY) * z);
  const sw = Math.max(1, Math.round(vf.width  * z));
  const sh = Math.max(1, Math.round(vf.height * z));

  // 2. 隐藏取景框自身（不污染截图）
  this.vfGraphics.visible = false;

  // 3. 截图（含 sky + bg + entity，所见即所得）
  const frame  = new PIXI.Rectangle(sx, sy, sw, sh);
  const base64 = this.app.renderer.extract.base64(
    this.app.stage, 'image/png', 1, frame
  );

  // 4. 恢复
  this.vfGraphics.visible = true;
  return base64;  // "data:image/png;base64,..."
}
```

**边界保护**：若取景框部分超出视口（sx < 0 等），`extract` 会静默裁剪，无需额外处理。

### 2.3 盲看原则

live 模式下，PNG 直接发给 vision provider 分析——vision 不接收 entitySnapshot。entitySnapshot 仅供 mock 模板填空和事后评估对照，不作为 prompt 输入。

---

## 3. Provider 接口签名

文件路径：`js/news/providers.js`

```js
// ── 接口契约 ──────────────────────────────────────────────────────────
//   vision.describe(pngBase64: string): Promise<string>
//     pngBase64 — data:image/png;base64,… 字符串
//     返回一段中性观察描述（中文），供玩家和 text provider 使用
//
//   text.compose(params): Promise<string>
//     params.visionReport  string   — vision 描述
//     params.playerStance  string   — 'neutral'|'incite'|'sympathy'
//     params.playerDraft   string   — 玩家可选附加文字（可为空串）
//     params.testimony     any[]    — 证词列表（MVP 恒为 []，接口预留）
//     返回完整文章文本（中文）
// ─────────────────────────────────────────────────────────────────────

export const vision = { describe };
export const text   = { compose  };
```

### 3.1 live 实现

| Provider | key localStorage 键 | 接口格式 |
|----------|---------------------|----------|
| vision   | `news_vision_key`   | OpenAI chat completions（图文，gpt-4o-mini 兼容） |
| text     | `news_text_key`     | OpenAI chat completions（文本，DeepSeek 兼容） |

key 只读写 `localStorage`，永不落磁盘、永不进 repo。key 缺失或请求失败 → 自动降级 mock，并在成稿面板顶部显示 `[MOCK]` 标注。

vision 请求体（OpenAI 图文格式）：
```js
{
  model: 'gpt-4o-mini',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: '请用中文简短描述图中所见，保持中性观察，不超过 80 字。' },
      { type: 'image_url', image_url: { url: pngBase64 } },
    ]
  }]
}
```

text 请求体（DeepSeek / OpenAI 兼容）：
```js
{
  model: 'deepseek-chat',
  messages: [{
    role: 'system',
    text: `你是一个新闻记者，根据现场描述、立场和记者草稿撰写 100~150 字的新闻报道。
立场枚举：neutral=客观中性 / incite=激进煽动 / sympathy=同情立场。`
  }, {
    role: 'user',
    text: `现场描述：${visionReport}\n立场：${playerStance}\n记者草稿：${playerDraft || '（无）'}`
  }]
}
```

### 3.2 mock 实现

**vision mock**：用 entitySnapshot.tags 填模板，不调网络。

```
"画面中[N]个人物，[activity tag]，背景有[near:tag]。场景气氛[时段词]。"
```

示例：`"画面中 2 个人物，正在下棋，背景有石凳。场景气氛平静。"`

**text mock**：返回固定格式文章。

```
标题：[stance词] + 主体tag
正文：套用 3 句话模板（地点 + 现象 + 立场点评）
```

---

## 4. 文章对象 schema

```js
// js/news/NewsArchive.js
{
  id:             string,   // `art_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
  photoRef:       string,   // data:image/png;base64,…（完整 data URL）
  visionReport:   string,   // vision.describe() 返回值
  entitySnapshot: {
    ids:       string[],    // entity.id（有 id 者）或 entity.propType
    tags:      string[],    // getCapturedTags() 汇总
    rect:      { x: number, y: number, w: number, h: number },  // 世界坐标
    timestamp: number,      // Date.now()
  },
  playerStance:  'neutral' | 'incite' | 'sympathy',
  playerDraft:   string,    // 可为空串
  articleText:   string,    // text.compose() 返回值
  provider:      'live' | 'mock',
  timestamp:     number,    // 发布时刻
}
```

`publishArticle(article)` 是唯一咽喉函数：`newsArchive.push(article)`。后续扩展（世界反馈、事件触发）只在此函数内增加逻辑，外部无感知。

---

## 5. UI 挂载点

### 5.1 为何用 HTML overlay 而非 PixiJS

成稿面板需要：`<textarea>`（草稿）+ `<select>` / radio（立场）+ 异步等待状态 + 缩略图 `<img>`。PixiJS Text 不支持原生 input，实现成本高于 HTML div。

### 5.2 DOM 结构

在 `index.html` `<body>` 内追加：
```html
<div id="news-ui-root" style="position:absolute;inset:0;pointer-events:none;z-index:999;"></div>
```
`pointer-events:none` 默认不拦截 PixiJS 事件；面板显示时内部 `pointer-events:auto`。

### 5.3 模块：js/news/NewsUI.js

```js
export class NewsUI {
  constructor(root, archive, providers) { ... }

  // 打开成稿面板（拍照后调用）
  openComposer({ photoRef, entitySnapshot }) { ... }

  // 打开存档面板（按 A 键）
  openArchive() { ... }

  // 关闭所有面板
  close() { ... }
}
```

面板采用纯 JS 动态创建 DOM（无外部 CSS 文件依赖），内联 style，字体继承全局 `Noto Sans SC`。

### 5.4 成稿面板布局（示意）

```
┌──────────────────────────────────────────────┐
│ [MOCK]  新闻成稿                          ✕  │
├──────────┬───────────────────────────────────┤
│ 照片缩图 │ 现场描述（vision 报告，只读）      │
│ 80×60   │ "画面中 2 人于桌旁对坐…"           │
├──────────┴───────────────────────────────────┤
│ 立场：○中立  ○煽动  ○同情                  │
│ 记者草稿（可选）：[textarea]                │
│                          [ 生成文章 → ]      │
├──────────────────────────────────────────────┤
│ ── 文章 ──────────────────────────────────── │
│ （生成后显示全文）                           │
│                          [ 发布存档 ]        │
└──────────────────────────────────────────────┘
```

### 5.5 存档面板

纯滚动列表，每条显示：缩略图 + 时间戳 + 文章首行 + `[MOCK]`/`[LIVE]` 标注。按 `A` 键切换显示/隐藏。

---

## 6. 文件结构

```
js/news/
  providers.js       T3  — vision/text Provider（live+mock）
  NewsArchive.js     T4  — newsArchive[] + publishArticle()
  NewsUI.js          T4  — HTML overlay：成稿面板 + 存档面板
js/scenes/
  StreetScene.js     T2/T4 — _takePhoto 扩展、键盘绑定(C/A)、NewsUI 集成
js/camera/
  Viewfinder.js      T2  — 高亮描边扩展
index.html           T4  — 追加 #news-ui-root div
```

---

## 7. 数据流总览

```
玩家拖框 → C键/拍照按钮
  │
  ├─ entitySnapshot ←── viewfinder.capturedEntities.map(getTags)
  ├─ photoRef       ←── renderer.extract.base64(stage, frame)
  │
  └─▶ NewsUI.openComposer()
        │  玩家选立场 + 可选草稿
        │
        ├─▶ vision.describe(photoRef)  ──[盲看]──▶ visionReport
        └─▶ text.compose({ visionReport, playerStance, playerDraft, testimony:[] })
              │
              └─▶ publishArticle(article) → newsArchive.push(article)
                    └─▶ NewsUI.openArchive() / 存档列表更新
```

---

## 8. 验收标准

- [ ] mock 模式：拖框对准棋桌场景 → C 键拍摄 → 成稿面板出现 → 选立场"同情" → 点"生成文章" → 文章文本出现 → "发布存档" → A 键打开存档可见该文章，全程 `console` 无错
- [ ] live 模式降级：localStorage 无 key → 自动 mock，面板顶部显示 `[MOCK]`
- [ ] 关闭面板后取景框、滚动、快捷键恢复正常

---

*T3-2（棋桌比例）暂挂起，待 visual-design-spec.md 补充后处理。*
