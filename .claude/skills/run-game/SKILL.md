---
name: run-game
description: 启动 news-game 并用无头浏览器实际驱动它——截图看画面、抓运行时报错、验证相机/渲染类改动。当需要"跑一下看看效果"、复现实机 bug、或改完绘制/相机/投影代码需要确认时使用。也涵盖 sth/preview.html 全量预览器。
---

# 跑起来看（news-game）

## 什么时候必须跑

本项目的五个静态门 + `check-syntax` **都不执行任何绘制调用**。历史上每一个渲染
回归——NPC 全变灰盒子、全景导出空白图、包围框错位、相机漂移、代理少方法、
常量被脚本误删——**没有一个是被门抓到的，全是跑起来才发现的**。

所以：**凡是动了 `js/scenes/`、`js/entity/*/draw*.js`、`js/core/Projection.js`、
`js/core/StickRenderer.js`、`js/core/EntityManager.js`、相机或 `assets/scene.json`
的几何，都要真跑一次。** 不跑就说"应该没问题"是不成立的。

> 权限：CLAUDE.md 默认禁止运行游戏，但 Hsinlung 2026-08-11 给了长期例外
> （"随便进行任何测试，我以效果为准"）——他没法判断渲染对不对，只能看截图。
> 视觉类改动请自己跑自己看，别让他描述。

## 起服务

```bash
cd <repo>
python -m http.server 8080     # 就是 start.bat 干的事
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/index.html   # 期望 200
```

页面：
- `http://localhost:8080/index.html` —— 游戏本体
- `http://localhost:8080/sth/preview.html` —— **全量预览器**（见下）

## 驱动浏览器

Playwright **不是本仓库依赖**，装在 npx 缓存里。ESM 不认 `NODE_PATH`，
`import { chromium } from 'playwright'` 会失败——必须用绝对 `file://` 路径：

```js
import { chromium } from 'file:///C:/Users/Hsinlung/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs';
```

哈希目录可能变，先确认：

```bash
find "$LOCALAPPDATA/npm-cache/_npx" -maxdepth 3 -name playwright -type d
```

Chromium 已经下好了（`%LOCALAPPDATA%/ms-playwright`），不用再 install。
脚本写到 scratchpad 目录，别留在仓库里。

### 骨架

```js
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));      // ← 必接
page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text()); });

await page.goto('http://localhost:8080/index.html', { waitUntil: 'load' });
await page.waitForTimeout(4000);      // 等 clip 资源加载 + 头几帧渲染完
await page.screenshot({ path: `${OUT}/shot.png` });
await browser.close();
```

**一定要接 `pageerror`**，并且**真的去看截图**——空白页也会"成功"截图。

## 有用的钩子与操作

| 目的 | 做法 |
|---|---|
| 读相机状态 | `page.evaluate(() => window.__cam())` → `{panX, panY, zoom}` |
| 时钟 | `window.__clock.setSpeed / setTime / now()` |
| 导航网格叠加 | 按 `n` |
| 调试浮标 | 按 `d` |
| 拍照（开成稿面板） | 按 `c` |
| 全景导出 | 按 `p`（会触发 download 事件） |
| 缩放 | 先 `page.mouse.move(500,400)` **再** `wheel`，否则事件不落在 canvas 上 |
| 平移 | `keyboard.down('ArrowRight')` → wait → `up` |

取出拍到的照片本体（而不是整页截图）：

```js
const dataUrl = await page.evaluate(() => document.querySelector('#news-ui-root img')?.src);
fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
```

验相机是否被某个轴串扰（O-7 那个漂移 bug 就是这么定位的）：按住某个方向键前后
各读一次 `__cam()`，纯竖直输入时 `dx` 必须为 **0**。
注意 zoom=1 时竖直**本来就不动**——场景屏幕高 ~594px 小于视口 720px，没有可滚
余量，要放大到 ≥1.5 才有。

## 全量预览器 `sth/preview.html`

改绘制函数时**这个比游戏本体好用**：不用等车开进画面，逐个对象点过去即可。

它**直接用游戏的类**（真造 `PropEntity` / `BuildingEntity`，清单来自
`propTypes()` 实时枚举），所以不会出现"预览对了游戏错了"；新增 prop 会自动出现
在左栏。叠加层：🟡`getBounds()` 🩵`footprint()` 🔵地面线+纵深栅格 🟣1.7m 参照人。

批量冒烟（32 个对象全点一遍，看有没有红色 status）：

```js
const labels = await page.$$eval('#list button', bs => bs.map(b => b.textContent));
for (const label of labels) {
  for (const b of await page.$$('#list button')) if ((await b.textContent()) === label) await b.click();
  await page.waitForTimeout(label.startsWith('npc') ? 2500 : 220);   // npc 首次要加载 clip
  if (await page.getAttribute('#status', 'class') === 'err') {
    console.log('❌', label, await page.textContent('#status'));
  }
}
```

## 收尾

服务器可以留着给 Hsinlung 自己看（记得把 URL 告诉他）。要停：

```bash
netstat -ano | grep ":8080" | head        # 找 PID
```

别用宽泛的 `pkill -f`，可能误杀会话自己的进程。
