# 新闻管线 MVP — 设计文档

> 版本：T1-r2（审校修订）  
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
    ▼ _takePhoto()（async）
 ├─ ① 将取景框 clamp 进当前视口（防止截图与快照矩形不一致）
 ├─ ② 收集 entitySnapshot（entities:[{id,tags}] + rect + timestamp）
 ├─ ③ 隐藏 vfGraphics，renderer.extract 出框内区域 PNG，恢复 vfGraphics
 ├─ ④ 立即发起 vision.describe(photoRef)（不等用户选立场）
 └─ ⑤ 打开成稿面板 NewsUI.openComposer({ photoRef, entitySnapshot, visionPromise })
```

**不新增"取景模式"开关**：取景框始终可见、可操作，降低模式切换认知负担。实体高亮描边在框捕获到实体时自动激活（`Viewfinder.draw()` 扩展），无需显式进入模式。

### 1.3 实体高亮描边

在 `Viewfinder.draw(g)` 尾部：对每个 `capturedEntities[i]`，用 `getBounds()` 取世界坐标包围盒，绘制 `lineStyle(2, 0xffcc00, 0.7)` 外框。纯绘制扩展，不改行为文件。

### 1.4 现有按钮映射

| 现有 | MVP 角色 |
|------|----------|
| `btnCapture`（拍照）| 触发 `_takePhoto()`，开启成稿面板 |
| `btnPublish`（发布新闻）| 移入成稿面板内部，改为"发布存档"按钮 |
| `headlinePanel` | 废弃（由成稿面板取代）|

---

## 2. 截图技术路径

### 2.1 PIXI 版本确认

`index.html` 加载 **pixi.js@7.4.2**（非 v5）。v7 的 `extract` API 变化：
- `extract.canvas(target, frame?)` — **同步**，返回 HTMLCanvasElement ✓  
- `extract.base64(target, format, quality, frame)` — **异步**，返回 Promise\<string\>

MVP 优先使用 **canvas + toDataURL** 路径（同步，与现有 `_exportImage` 一致）：

### 2.2 实现步骤

```js
async _takePhoto() {
  // 1. clamp 取景框到当前视口（同时更新快照矩形）
  this._clampViewfinderToViewport();

  const vf = this.viewfinder;
  const z  = this.zoom;

  // 2. 世界坐标 → 屏幕像素坐标
  const sx = Math.round((vf.x - this.scrollX) * z);
  const sy = Math.round((vf.y - this.scrollY) * z);
  const sw = Math.max(1, Math.round(vf.width  * z));
  const sh = Math.max(1, Math.round(vf.height * z));

  // 3. 隐藏取景框自身（不污染截图）
  this.vfGraphics.visible = false;

  // 4. 截图（含 sky + bg + entity，所见即所得）
  //    extract.canvas 在 PIXI 7 为同步调用；frame 为屏幕像素矩形
  const frame  = new PIXI.Rectangle(sx, sy, sw, sh);
  const canvas = this.app.renderer.extract.canvas(this.app.stage, frame);
  const photoRef = canvas.toDataURL('image/png');  // "data:image/png;base64,..."

  // 5. 恢复
  this.vfGraphics.visible = true;

  // 6. 收集快照 + 发起 vision（尽早并行，不阻塞面板打开）
  const entitySnapshot = this._buildEntitySnapshot(vf);
  const visionPromise  = vision.describe(photoRef);  // 不 await，传给面板

  this.newsUI.openComposer({ photoRef, entitySnapshot, visionPromise });
}

_clampViewfinderToViewport() {
  const vf = this.viewfinder;
  const z  = this.zoom;
  const maxX = this.scrollX + this.viewW / z;
  const maxY = this.scrollY + this.viewH / z;
  vf.x = Math.max(this.scrollX, Math.min(vf.x, maxX - vf.width));
  vf.y = Math.max(this.scrollY, Math.min(vf.y, maxY - vf.height));
}
```

> ⚠ **待确认**：`extract.canvas(target, frame)` 在 PIXI 7.4.2 的确切签名——实现时对照
> `PIXI.Extract` 类型定义或 changelog 核实第二参数是 `PIXI.Rectangle` 还是 `frame?` 选项对象。
> 备选：若 canvas 不支持 frame，改用 `extract.base64({target, frame, format:'image/png'})`（async，全链路 await）。

### 2.3 盲看原则

live 模式下，PNG 直接发给 vision provider 分析——vision 不接收 entitySnapshot。entitySnapshot 仅供 mock 模板填空和事后评估对照，不作为 prompt 输入。

---

## 3. Provider 接口签名

文件路径：`js/news/providers.js`

```js
// ── 接口契约 ──────────────────────────────────────────────────────────
//   vision.describe(pngBase64: string): Promise<string>
//     pngBase64 — data:image/png;base64,… 字符串
//     返回分点观察描述（中文），供玩家阅读和 text provider 使用
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

| Provider | API key localStorage 键 | 端点 URL localStorage 键 | 默认端点 |
|----------|------------------------|--------------------------|----------|
| vision   | `news_vision_key`      | `news_vision_base`       | `https://api.openai.com/v1` |
| text     | `news_text_key`        | `news_text_base`         | `https://api.deepseek.com/v1` |

key / base URL 只读写 `localStorage`，永不落磁盘、永不进 repo。

**vision 请求体**（OpenAI 图文格式，gpt-4o-mini 兼容）：

```js
POST ${base}/chat/completions
Authorization: Bearer ${key}
Content-Type: application/json

{
  "model": "gpt-4o-mini",
  "messages": [{
    "role": "user",
    "content": [
      {
        "type": "text",
        "text": "请用中文分点描述图中所见，包括：人数、各自动作、可见物体、空间关系。不确定的内容直接说不确定，不要猜测。不限长度，完整描述。"
      },
      {
        "type": "image_url",
        "image_url": { "url": "${pngBase64}" }
      }
    ]
  }]
}
```

**text 请求体**（DeepSeek / OpenAI 兼容）：

```js
POST ${base}/chat/completions
Authorization: Bearer ${key}
Content-Type: application/json

{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "system",
      "content": "你是一个新闻记者，根据现场描述、立场和记者草稿撰写 100~150 字的新闻报道。立场枚举：neutral=客观中性 / incite=激进煽动 / sympathy=同情立场。"
    },
    {
      "role": "user",
      "content": "现场描述：${visionReport}\n立场：${playerStance}\n记者草稿：${playerDraft || '（无）'}"
    }
  ]
}
```

> **注意**：OpenAI 字段为 `content`，不是 `text`。

key 缺失或请求失败（含网络错误、非 2xx）→ 自动降级 mock，并在成稿面板顶部显示 `[MOCK]` 标注。

### 3.2 live 模式已知限制（CORS）

OpenAI 官方 `api.openai.com` 不返回浏览器 CORS 头，前端直连**大概率被浏览器拦截**（`No 'Access-Control-Allow-Origin'`）。DeepSeek 的 CORS 策略未知，同样存在风险。

**推荐方案**：将 `news_vision_base` / `news_text_base` 改填 CORS 友好的中转网关，例如：

- [OpenRouter](https://openrouter.ai)（明确支持浏览器直连，两个 provider 皆可走）
- 自建反代（nginx / Cloudflare Worker）

**mock 是第一公民**：全流程在 mock 下无网络可完整走通，live 直连属于增强选项，被拦截时自动降级不影响游戏主流程。

设置面板（见 §5）同时暴露 base URL 输入框，玩家填入支持 CORS 的网关即可激活 live 模式。

### 3.3 mock 实现

**vision mock**：用 `entitySnapshot.entities` 中的 tags 填模板，不调网络。

```
"画面中[N]个人物。[entity描述列表]。背景可见[near:tag列表]。"
```

按实体分行，例如：
```
"画面中 2 个人物。
- 1 人坐姿，正在下棋（near:chess-table）
- 1 人行走，手持牵绳（near:dog）
背景可见石凳、棋桌。"
```

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
  id:           string,    // `art_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
  photoRef:     string,    // data:image/png;base64,…（完整 data URL）
  visionReport: string,    // vision.describe() 返回值

  entitySnapshot: {
    entities: [            // 按实体的结构化快照（便于视觉模型评估对照）
      { id: string, tags: string[] },  // id = entity.id ?? entity.propType ?? 'unknown'
      // ...
    ],
    rect:      { x: number, y: number, w: number, h: number },  // 世界坐标（已 clamp）
    timestamp: number,
  },

  playerStance:  'neutral' | 'incite' | 'sympathy',
  playerDraft:   string,   // 可为空串
  articleText:   string,   // text.compose() 返回值
  provider:      'live' | 'mock',
  timestamp:     number,   // 发布时刻 Date.now()
}
```

`publishArticle(article)` 是唯一咽喉函数：`newsArchive.push(article)`。后续扩展（世界反馈、事件触发）只在此函数内增加逻辑，外部无感知。

---

## 5. UI 挂载点

### 5.1 为何用 HTML overlay 而非 PixiJS

成稿面板需要：`<textarea>`（草稿）+ radio（立场）+ 异步等待状态 + 缩略图 `<img>`。PixiJS Text 不支持原生 input，实现成本高于 HTML div。

### 5.2 DOM 结构

在 `index.html` `<body>` 内追加：
```html
<div id="news-ui-root" style="position:absolute;inset:0;pointer-events:none;z-index:999;"></div>
```
`pointer-events:none` 默认不拦截 PixiJS 事件；面板显示时内部元素 `pointer-events:auto`。

### 5.3 模块：js/news/NewsUI.js

```js
export class NewsUI {
  constructor(root, archive, providers) { ... }

  // 打开成稿面板（拍照后立即调用）
  // visionPromise 已在拍照时并行发出，面板在 await 期间显示 loading 状态
  openComposer({ photoRef, entitySnapshot, visionPromise }) { ... }

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
│ 80×60   │ ⏳ 分析中…  /  "画面中 2 人…"      │
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

"生成文章"按钮在 vision 完成前禁用（灰色），完成后自动启用。

### 5.5 设置面板

按 `S` 键弹出极简设置面板：

```
┌───────────────────────────────────────┐
│ API 设置                           ✕  │
├───────────────────────────────────────┤
│ Vision key:  [___________________]    │
│ Vision base: [https://api.openai…]    │
│ Text key:    [___________________]    │
│ Text base:   [https://api.deepse…]    │
│        [ 保存到 localStorage ]        │
└───────────────────────────────────────┘
```

key 字段用 `type="password"`（不明文显示）。

### 5.6 存档面板

纯滚动列表，每条显示：缩略图 + 时间戳 + 文章首行 + `[MOCK]`/`[LIVE]` 标注。按 `A` 键切换显示/隐藏。

---

## 6. 文件结构

```
js/news/
  providers.js       T3  — vision/text Provider（live+mock）
  NewsArchive.js     T4  — newsArchive[] + publishArticle()
  NewsUI.js          T4  — HTML overlay：成稿面板 + 存档面板 + 设置面板
js/scenes/
  StreetScene.js     T2/T4 — _takePhoto 扩展（async）、键盘绑定(C/A/S)、NewsUI 集成
js/camera/
  Viewfinder.js      T2  — 高亮描边扩展
index.html           T4  — 追加 #news-ui-root div
```

---

## 7. 数据流总览

```
玩家拖框 → C键/拍照按钮
  │
  ├─ clamp 取景框到视口
  ├─ entitySnapshot  ←── capturedEntities.map(e => ({ id, tags: getTags() }))
  ├─ photoRef        ←── extract.canvas(stage, screenFrame) → toDataURL()
  │
  ├─▶ vision.describe(photoRef)  ──[并行，盲看]──> visionPromise
  │
  └─▶ NewsUI.openComposer({ photoRef, entitySnapshot, visionPromise })
        │
        │  [面板显示中]：缩略图 + vision loading...
        │  [vision resolve]：填入现场描述，启用"生成文章"按钮
        │
        │  玩家选立场 + 可选草稿 → 点"生成文章"
        │
        └─▶ text.compose({ visionReport, playerStance, playerDraft, testimony:[] })
              │
              └─▶ publishArticle(article) → newsArchive.push(article)
                    └─▶ 面板切换至文章展示 + "发布存档"按钮
```

---

## 8. 验收标准

- [ ] mock 模式：拖框对准棋桌场景 → C 键拍摄 → 成稿面板出现（含 vision 描述）→ 选立场"同情" → 点"生成文章" → 文章文本出现 → "发布存档" → A 键打开存档可见该文章，全程 `console` 无错
- [ ] live 模式降级：localStorage 无 key / 请求失败 → 自动 mock，面板顶部显示 `[MOCK]`
- [ ] CORS 降级：`api.openai.com` 直连失败 → catch → mock，不抛未捕获异常
- [ ] 关闭面板后取景框、滚动、快捷键恢复正常
- [ ] entitySnapshot.entities 结构可用于按实体逐一对照 vision 报告中识别了哪些目标

---

*T3-2（棋桌比例）暂挂起，待 visual-design-spec.md 补充后处理。*
