/**
 * StreetScene（PixiJS 版）
 * 主场景：2.5D俯视角街道 + 统一Entity系统 + 取景框 + 拍照/发布
 *
 * 渲染层次（从下到上）：
 *   skyContainer       — 静态天空（视差 0.45）
 *   worldContainer     — 受相机（scroll/zoom）控制：
 *     bgGraphics         静态地面（道路/人行道/树木），只绘制一次
 *     entityGraphics     所有 Entity（建筑、道具、NPC），每帧按Y排序重绘
 *                        （_sortY 覆盖排序基准：sign +9 排得更靠前；tree 负偏移排得
 *                         更靠后让 NPC 走树前；stall 用默认 y。见各 footprint 的 sortDY）
 *     （DebugOverlay 的世界浮标也挂这里）
 *   uiContainer        — 屏幕固定 HUD（文本/按钮/闪光/调试面板）
 *     vfGraphics         取景框 UI（屏幕坐标，浮在顶层，不随相机 pan/zoom 变化——
 *                        见 js/camera/Viewfinder.js 文件头注释）
 *
 * 渲染底层为 PixiJS；所有绘图文件直接调用 PIXI.Graphics 原生 API。
 */

import { StickRenderer }   from '../core/StickRenderer.js';
import { EntityManager }   from '../core/EntityManager.js';
import { Viewfinder }      from '../camera/Viewfinder.js';
import { DebugOverlay }    from '../ui/DebugOverlay.js';
import { SceneRenderer }   from './SceneRenderer.js';
import { SceneInitializer } from './SceneInitializer.js';
// WORLD_WIDTH/WORLD_HEIGHT 曾供 _exportImage 开纹理用，O-2 后导出改按
// sceneScreenBounds（投影后的屏幕包围盒）算尺寸，这里不再需要；
// SIDEWALK_FAR_Y/SIDEWALK_NEAR_Y 是更早就没有消费者的死 import，一并清掉。
import { GRAY_SKY, initLayout } from '../core/Layout.js';
import { toScreen, toWorld, sceneScreenBounds, billboardScreenBox } from '../core/Projection.js';
import { initWalkPaths }    from '../behavior/WalkMode.js';
import { expandSceneData }  from '../core/sceneData.js';
import { PixiText }         from '../core/PixiText.js';
import { buildPoseCache } from '../behavior/PoseCacheBuilder.js';
import { clipLibrary } from '../core/ClipLibrary.js';
import { clockUpdate, gameTimeStr, setClockSpeed, setGameTime } from '../core/GameClock.js';
import { drawNavDebug } from '../behavior/nav/NavGrid.js';
import { audit } from '../debug/MovementAudit.js';
import { vision, text, interrogate, setLastSnapshot } from '../news/providers.js';
import { NewsArchive } from '../news/NewsArchive.js';
import { NewsUI } from '../news/NewsUI.js';
import { WitnessDebugPanel } from '../debug/WitnessDebugPanel.js'; // 一次性调试工具，tasks.md P-8，可整体删除


export class StreetScene {
  constructor(app) {
    this.app = app;

    this.viewW = app.screen.width;
    this.viewH = app.screen.height;

    // 相机 pan：**投影后的屏幕像素**（未乘 zoom），不是世界坐标。
    // 见 _applyCamera 上方注释——存世界坐标会让 shear 把竖直输入漏成横向漂移。
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;

    this._json = {};
    this.cache = { json: { get: (k) => this._json[k] } };

    // add.text 兼容工厂（DebugOverlay / HUD 共用）
    this.add = { text: (x, y, str, style) => new PixiText(this, x, y, str, style) };

    this.keys = { left: false, right: false, up: false, down: false };
    this._flashAlpha = 0;
  }

  // ─── 资源加载（fetch JSON）────────────────────────────────────────────────
  async preload() {
    const load = async (key, path) => {
      const r = await fetch(path);
      if (r.ok) this._json[key] = await r.json();
    };
    await clipLibrary.init();
    const animIds = Object.keys(clipLibrary.manifest?.clips ?? {});
    const jobs = [
      load('scene_data', 'assets/scene.json'),
      ...animIds.map(id => clipLibrary.getClip(id)),
    ];
    await Promise.all(jobs);
  }

  create() {
    const stage = this.app.stage;
    stage.sortableChildren = true;

    this.skyContainer   = new PIXI.Container();
    this.worldContainer = new PIXI.Container();
    this.uiContainer    = new PIXI.Container();
    this.skyContainer.zIndex   = 0;
    this.worldContainer.zIndex = 1;
    this.uiContainer.zIndex    = 2;
    this.worldContainer.sortableChildren = true;
    this.uiContainer.sortableChildren    = true;
    stage.addChild(this.skyContainer, this.worldContainer, this.uiContainer);

    const mkLayer = (container, zIndex) => {
      const pg = new PIXI.Graphics();
      pg.zIndex = zIndex;
      container.addChild(pg);
      return pg;
    };
    this.skyGraphics        = mkLayer(this.skyContainer, 0);
    this.bgGraphics         = mkLayer(this.worldContainer, 1);
    this.entityGraphics     = mkLayer(this.worldContainer, 2);
    // 取景框浮在顶层：uiContainer 不受 worldContainer 的 zoom/pan 影响，见
    // Viewfinder.js 文件头注释。zIndex 50——低于 flashOverlay(190)/按钮(200)，
    // 高于（不存在的）世界内容，HUD 文本(100) 压得住它，互不遮挡太多。
    this.vfGraphics         = mkLayer(this.uiContainer, 50);

    const sceneData = expandSceneData(this.cache.json.get('scene_data'));
    // 布局参数注入：必须在 SceneRenderer / SceneInitializer / 任何 entity 创建之前
    initLayout(sceneData);
    const layout = sceneData.layout;

    const sceneRenderer = new SceneRenderer(this.bgGraphics, this.skyGraphics, layout, sceneData.ground);
    sceneRenderer.drawAll();

    this.stickRenderer = new StickRenderer(this);
    this.stickRenderer.setSkeletons(clipLibrary.skeletons);
    for (const id of Object.keys(clipLibrary.manifest.clips)) {
      this.stickRenderer.loadAnimation(id, clipLibrary.resolve(id));
    }

    const poseCache = buildPoseCache(clipLibrary);
    initWalkPaths(layout.walkPaths);

    this.entityManager = new EntityManager();

    const initializer = new SceneInitializer(this, this.entityManager, this.stickRenderer, poseCache);
    initializer.spawnAll(sceneData, layout);
    // O-2：楼是静态实体，生成后 facadeH 不会再变，_clampScroll 只需算一次屋顶余量。
    this._maxFacadeH = this._computeMaxFacadeH();

    this.viewfinder = new Viewfinder({
      app: this.app,
      getScreenCoords:  (cx, cy) => this._getScreenCoords(cx, cy),
      entityScreenRect: (b)      => this._entityScreenRect(b),
    }); // 屏幕像素坐标，默认居中；取景框不再绑定世界坐标，见 Viewfinder.js 头注
    // 相机开局摆到场景默认视野中心（原默认取景框的世界中心点，取景框改屏幕
    // 空间后不再依赖它，但这个锚点本身仍是合理的开局取景——见 _centerCameraOn 注释）。
    this._centerCameraOn(2197, 1946);
    this._createUI();
    this.debugOverlay = new DebugOverlay(this, this.behaviorManager, this.entityManager);

    this._setupInput();
    this._clampScroll();
    this._applyCamera();

    // 调试用：暴露时钟控制到 window
    window.__clock = { setSpeed: setClockSpeed, setTime: setGameTime, now: () => gameTimeStr() };
    // 相机探针（同 __clock / __navDebug 的调试钩子惯例）：pan 是屏幕像素，
    // 按住上/下键时 panX 必须纹丝不动——O-7 的横向漂移 bug 就是靠它验的。
    window.__cam = () => ({ panX: this.panX, panY: this.panY, zoom: this.zoom });

    this.app.ticker.add(() => this.update(this.app.ticker.deltaMS));
  }

  // ─── 相机 ──────────────────────────────────────────────────────────────────
  // O-2：worldContainer 不再整体乘 PX_PER_UNIT（那套仿射变换被 Projection.toScreen
  // 取代——draw 调用直接算出绝对屏幕像素，见 Projection.js 文件头的核心区分）。
  // 容器自己只剩两件事：zoom（缩放）+ 相机 pan（把 (panX,panY) 这个**屏幕**点
  // 挪到视口左上角）。
  //
  // ⚠️ pan 必须存**投影后的屏幕像素**，不能存世界坐标（O-7 修的 bug）：
  // `toScreen` 的 x 依赖 y（shear：`x_s = (x + (y-BASE)*SHEAR) * PX`），所以
  // 每帧拿世界 (scrollX,scrollY) 重新投影的话，纯竖直的输入会漏进横向——按住
  // 上/下键时镜头以 `spd × SHEAR × PX_PER_UNIT ≈ 23px/秒` 横向漂移（上→左、
  // 下→右）。相机要动的本来就是"画面往哪挪"这件屏幕空间的事，投影一次都不该有。
  //
  // skyContainer：**横向**吃 0.45 视差（远景移动慢），**纵向不吃视差**——
  // 天际线要一直贴在楼基线上，竖直方向一分离地平线就会飘（O-7 修的第二个 bug）。
  _applyCamera() {
    this.worldContainer.scale.set(this.zoom);
    this.worldContainer.position.set(-this.panX * this.zoom, -this.panY * this.zoom);
    this.skyContainer.scale.set(this.zoom);
    this.skyContainer.position.set(-this.panX * 0.45 * this.zoom, -this.panY * this.zoom);
  }

  // 世界地面的屏幕包围盒（含最高楼屋顶余量），只在 create() 里楼生成完后
  // 算一次——楼是静态实体，facadeH 不会中途变化。找不到任何楼就是 0（见
  // Projection.sceneScreenBounds 的 maxFacadeH 语义）。
  _computeMaxFacadeH() {
    let max = 0;
    for (const e of this.entityManager.entities) {
      if (typeof e.facadeH === 'number' && e.facadeH > max) max = e.facadeH;
    }
    return max;
  }

  /**
   * 把 (wx,wy) 这个世界点摆到视口正中央——只在 create() 里调一次，把初始相机
   * 摆到场景里一处合理的默认视野，而不是留在世界原点 (0,0)（原点附近多是
   * 天空/建筑背面，没什么可看）。
   *
   * 历史：这个方法最初是为了解决"镜头自己动"的第二个根因（相机开局在世界
   * 原点，取景框跟随逻辑要花几秒把它追到取景框附近，观感是镜头自己滑了一
   * 段）——当时传入的是默认取景框的世界中心。取景框跟随逻辑连同取景框本身
   * 的世界坐标语义已整体删除（取景框现在是浮在顶层的屏幕空间 UI，见
   * Viewfinder.js 头注），传入值改成固定写死的同一个锚点（原默认取景框中心
   * 数值 (1641+1112/2, 1562+768/2)），纯粹是"开局往哪看"的选择，不再跟取景框
   * 有任何耦合。
   */
  _centerCameraOn(wx, wy) {
    const t = toScreen(wx, wy);
    this.panX = t.x - this.viewW / (2 * this.zoom);
    this.panY = t.y - this.viewH / (2 * this.zoom);
  }

  /** pan 已经是屏幕像素，直接跟场景屏幕包围盒比，不再来回投影。 */
  _clampScroll() {
    const b = sceneScreenBounds(this._maxFacadeH ?? 0);
    const maxPanX = Math.max(b.minX, b.maxX - this.viewW / this.zoom);
    const maxPanY = Math.max(b.minY, b.maxY - this.viewH / this.zoom);
    this.panX = Math.min(Math.max(b.minX, this.panX), maxPanX);
    this.panY = Math.min(Math.max(b.minY, this.panY), maxPanY);
  }

  /** 视口内屏幕像素坐标（0,0 = 视口左上角）→ 世界坐标。鼠标拾取/取景框/相机换算共用。 */
  _screenToWorld(sx, sy) {
    return toWorld(sx / this.zoom + this.panX, sy / this.zoom + this.panY);
  }

  _getWorldCoords(clientX, clientY) {
    const rect = this.app.view.getBoundingClientRect();
    const sx = (clientX - rect.left) * (this.app.screen.width  / rect.width);
    const sy = (clientY - rect.top)  * (this.app.screen.height / rect.height);
    return this._screenToWorld(sx, sy);
  }

  /** 浏览器 client 坐标 → 画布本地像素坐标（不做世界坐标换算）。供取景框（屏幕空间 UI）拖拽用。 */
  _getScreenCoords(clientX, clientY) {
    const rect = this.app.view.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (this.app.screen.width  / rect.width),
      y: (clientY - rect.top)  * (this.app.screen.height / rect.height),
    };
  }

  /**
   * 实体世界包围盒（`Entity.getBounds()`）→ 当前相机 pan/zoom 下的屏幕矩形
   * （即 worldContainer 子节点实际渲染到的位置）。供取景框命中检测/高亮描边用：
   * 取景框本身固定不动，但相机一移动，同一批实体落到的屏幕位置会变，命中集合
   * 因此仍正确跟着相机内容更新。
   *
   * 投影本身交给 `Projection.billboardScreenBox()`（包围盒是贴地竖直广告牌盒，
   * 宽高走平长度通道、接地点走纵深通道），这里只负责再叠加相机变换——公式与
   * `_applyCamera` 里 worldContainer 的 position/scale 一致（PIXI 容器变换：
   * 先 scale 后加 position，等价于 (绝对屏幕坐标 - pan) * zoom）。
   */
  _entityScreenRect(bounds) {
    const b = billboardScreenBox(bounds);
    return {
      x: (b.x - this.panX) * this.zoom,
      y: (b.y - this.panY) * this.zoom,
      w: b.w * this.zoom,
      h: b.h * this.zoom,
    };
  }

  // ─── 输入 ──────────────────────────────────────────────────────────────────
  _setupInput() {
    const keyMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    window.addEventListener('keydown', (e) => {
      if (keyMap[e.key]) { this.keys[keyMap[e.key]] = true; return; }
      const k = e.key.toLowerCase();
      if (k === 'p') this._exportImage();
      else if (k === 'd') this.debugOverlay.toggle();
      else if (k === 'z') { this.zoom = 1; this._centerCameraOn(2197, 1946); this._clampScroll(); this._applyCamera(); }
      else if (k === 'n') { window.__navDebug = !window.__navDebug; console.log('[NavDebug]', window.__navDebug ? 'ON' : 'OFF'); }
      else if (k === 'm') audit.dump(this.behaviorManager?.npcs ?? []);
      else if (k === 'o') this.behaviorManager?.envQuery?.debugPool(this.behaviorManager?.npcs?.[0]);
      else if (k === 'c') this._takePhoto();
      else if (k === 's') this._newsUI?.openSettings();
      else if (k === 'a') { if (this._newsUI?.isOpen()) this._newsUI.close(); else this._newsUI?.openArchive(); }
      else if (k === 'w') {
        // 一次性调试工具（tasks.md P-8）：跟 NewsUI 面板互斥，避免两个居中
        // overlay 叠在一起
        this._newsUI?.close();
        if (this._witnessPanel?.isOpen()) this._witnessPanel.close(); else this._witnessPanel?.open();
      }
    });
    window.addEventListener('keyup', (e) => { if (keyMap[e.key]) this.keys[keyMap[e.key]] = false; });

    this.app.view.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor  = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(2.0, this.zoom * factor));
      // 保持光标下的那个点不动：光标屏幕位置 = (绝对屏幕坐标 - pan) * zoom，
      // 缩放前后解出新的 pan（全程屏幕空间，不经世界坐标往返）
      const cur = this._getScreenCoords(e.clientX, e.clientY);
      const absX = cur.x / this.zoom + this.panX;
      const absY = cur.y / this.zoom + this.panY;
      this.zoom = newZoom;
      this.panX = absX - cur.x / this.zoom;
      this.panY = absY - cur.y / this.zoom;
      this._clampScroll();
      this._applyCamera();
    }, { passive: false });
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────
  _createUI() {
    const W = this.viewW;
    const H = this.viewH;

    this.uiText = this.add.text(10, 10, '← → 滚动  |  滚轮缩放  Z 重置  |  拖动取景框 · 拖右下角缩放  |  C 拍照  A 存档  S 设置  |  P 导出  D 调试  W 目击调试面板', {
      fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', color: '#555555',
      backgroundColor: 'rgba(240,236,228,0.85)', padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.captureText = this.add.text(10, 36, '', {
      fontFamily: '"Noto Sans SC", sans-serif', fontSize: '13px', color: '#cc2200',
      backgroundColor: 'rgba(240,236,228,0.85)', padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.flashOverlay = new PIXI.Graphics();
    this.flashOverlay.beginFill(0xffffff, 1).drawRect(0, 0, W, H).endFill();
    this.flashOverlay.alpha = 0;
    this.flashOverlay.zIndex = 190;
    this.uiContainer.addChild(this.flashOverlay);

    this.btnCapture = this._makeButton(W - 126, H - 50, '[ 拍  照 ]', '#b83000');
    this.btnCapture.on('pointerdown', () => this._takePhoto());

    // News pipeline
    this._newsArchive = new NewsArchive();
    this._newsUI = new NewsUI(
      document.getElementById('news-ui-root'),
      this._newsArchive,
      { vision, text, interrogate },
    );

    // 一次性调试工具（tasks.md P-8），可整体删除——见 WitnessDebugPanel.js 头注释
    this._witnessPanel = new WitnessDebugPanel(
      document.getElementById('news-ui-root'),
      this.behaviorManager,
    );
  }

  _makeButton(x, y, label, bgColor) {
    const btn = this.add.text(x, y, label, {
      fontFamily: '"Noto Sans SC", sans-serif', fontSize: '14px', color: '#ffffff',
      backgroundColor: bgColor, padding: { x: 12, y: 7 },
    }).setScrollFactor(0).setDepth(200).setInteractive();
    btn.on('pointerover', () => btn.setAlpha(0.78));
    btn.on('pointerout',  () => btn.setAlpha(1.0));
    return btn;
  }

  _delay(ms, cb) {
    const start = performance.now();
    const tick = (now) => { if (now - start >= ms) cb(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  // ─── 导出长图 ───────────────────────────────────────────────────────────────
  /**
   * 全景导出（P 键）。O-2 之后这个函数有两处必须改，否则导出的是一张空白图：
   *
   * 1. **尺寸/坐标空间**：O-2 起各 draw 函数直接输出屏幕像素（经 `toScreen`），
   *    图层内容不再位于"世界坐标 × PX_PER_UNIT"的空间里。老代码按
   *    `WORLD_WIDTH × WORLD_HEIGHT`（10588×3072 世界单位）开纹理并且不做平移，
   *    投影后的场景实际只占 `sceneScreenBounds()` 那一块（≈4356×409 + 屋顶余量，
   *    且 minX/minY 是负数），画进去只剩左上角一丁点。改为按 `sceneScreenBounds`
   *    开纹理，并用一个 Container 把图层整体平移 `-minX/-minY` 收进纹理内。
   * 2. **GPU 纹理上限**：老代码 `resolution: 2` 把 10588×3072 放大成
   *    21176×6144 的后备纹理，远超常见 `MAX_TEXTURE_SIZE`（实测本机 8192），
   *    WebGL 直接报 `texImage2D: width or height out of range` +
   *    `Framebuffer is incomplete: Attachment has zero size`，extract 出来是
   *    全空白。现在按 `MAX_EXPORT_PX` 卡住上限，必要时自动降 resolution
   *    （宁可降采样也不要导出一张空图）。
   */
  _exportImage() {
    const renderer = this.app.renderer;
    const MAX_EXPORT_PX = 8192; // 保守取常见 GPU 的 MAX_TEXTURE_SIZE 下限

    const b = sceneScreenBounds(this._maxFacadeH ?? 0);
    const w = Math.max(1, Math.ceil(b.maxX - b.minX));
    const h = Math.max(1, Math.ceil(b.maxY - b.minY));

    // resolution 取 2（喂视觉模型更清晰），但不得让任一边超过 GPU 纹理上限
    const RES = Math.max(1, Math.min(2, MAX_EXPORT_PX / Math.max(w, h)));

    const rt = PIXI.RenderTexture.create({ width: w, height: h, resolution: RES });

    const fill = new PIXI.Graphics();
    fill.beginFill(GRAY_SKY, 1).drawRect(0, 0, w, h).endFill();
    renderer.render(fill, { renderTexture: rt, clear: true });
    fill.destroy();

    // 图层本身画在"绝对屏幕像素"坐标系里（含负坐标），套一层平移容器收进纹理。
    // 借用容器渲染而不是改图层自身的 position——图层是常驻显示对象，改了要还原，
    // 中途抛异常就会把主画面也弄歪。
    const shift = new PIXI.Container();
    shift.position.set(-b.minX, -b.minY);
    for (const layer of [this.skyGraphics, this.bgGraphics, this.entityGraphics]) {
      const parent = layer.parent;
      const idx = parent.getChildIndex(layer);
      shift.addChild(layer);
      renderer.render(shift, { renderTexture: rt, clear: false });
      parent.addChildAt(layer, idx); // 立刻还原，保证主画面层级/顺序不变
    }
    shift.destroy();

    const canvas = renderer.extract.canvas(rt);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `news-street-pano-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      rt.destroy(true);
    });
  }

  // ─── 拍照 ────────────────────────────────────────────────────────────────────
  async _takePhoto() {
    if (this.viewfinder.capturedEntities.length === 0) {
      this.captureText.setText('取景框内没有目标！').setColor('#cc2200');
      this._delay(1500, () => this.captureText.setText(''));
      return;
    }

    const vf = this.viewfinder;

    // 1. 截图矩形：取景框现在本来就是屏幕像素坐标（浮在顶层，见 Viewfinder.js
    // 头注），永远在视口内，不需要再 clamp、也不需要经 toScreen 投影——直接
    // 就是 extract.canvas 要的那个轴对齐矩形。
    const sx = Math.round(vf.x);
    const sy = Math.round(vf.y);
    const sw = Math.max(1, Math.round(vf.width));
    const sh = Math.max(1, Math.round(vf.height));

    // 2. hide viewfinder graphics so they don't appear in screenshot
    this.vfGraphics.visible = false;

    // 3. extract screenshot
    const frame  = new PIXI.Rectangle(sx, sy, sw, sh);
    const canvas = this.app.renderer.extract.canvas(this.app.stage, frame);
    const photoRef = canvas.toDataURL('image/png');

    // 4. restore
    this.vfGraphics.visible = true;

    // 5. flash feedback
    this._flashAlpha = 0.80;
    this.flashOverlay.alpha = this._flashAlpha;

    // 6. build snapshot + kick off vision in parallel
    const entitySnapshot = this._buildEntitySnapshot(vf);
    setLastSnapshot(entitySnapshot);
    const visionPromise = vision.describe(photoRef);

    // 可审问目击者 = 本次拍摄捕捉到的、真正"目击过点什么"的 NPC。
    // 入镜 ≠ 目击——视觉/听觉双通道感知裁决只在事件发生的那一刻跑
    // （W-7a：BehaviorManager 帧序 1.5，drain 事件时对候选 NPC 逐个裁决），
    // 不在拍照这一刻跑；拍照只负责从已经产生的 claims 里筛，不得为了这次
    // 取景重新触发一轮裁决判定，本文件因此不接触该裁决层的任何符号。
    // 有 mem('belief').claims 非空才算真正目击过，只是入镜但什么都没看见的
    // NPC（背对事件/隔太远/在玩手机）不出现在可审问列表里。
    const witnesses = vf.capturedEntities.filter(
      e => typeof e.mem === 'function' && (e.mem('belief').claims?.length > 0)
    );
    const hasUnwitnessingNpc = vf.capturedEntities.some(
      e => typeof e.mem === 'function' && !(e.mem('belief').claims?.length > 0)
    );

    this.captureText.setText(`已拍摄 ${vf.capturedEntities.length} 个目标`).setColor('#226600');
    this._newsUI.openComposer({ photoRef, entitySnapshot, visionPromise, witnesses, hasUnwitnessingNpc });
  }

  _buildEntitySnapshot(vf) {
    const entities = this.viewfinder.capturedEntities.map(e => ({
      id:   e.id ?? e.propType ?? 'unknown',
      tags: (typeof e.getTags === 'function') ? e.getTags() : (e.tags ?? []),
    }));
    return {
      entities,
      rect:      { x: vf.x, y: vf.y, w: vf.width, h: vf.height }, // 屏幕像素坐标，非世界坐标——见 Viewfinder.js 头注
      timestamp: Date.now(),
    };
  }

  // ─── 每帧更新 ─────────────────────────────────────────────────────────────────
  update(delta) {
    const spd = 300 * (delta / 1000);

    if (this.keys.left)       this.panX -= spd;
    else if (this.keys.right) this.panX += spd;
    if (this.keys.up)         this.panY -= spd;
    else if (this.keys.down)  this.panY += spd;

    // 相机不再跟随取景框——取景框已改为浮在顶层的屏幕空间 UI（见
    // Viewfinder.js 头注），永远在视口内，不需要相机追它；相机现在只由
    // 方向键 / 滚轮缩放改变（历史：曾有一段"取景框靠近屏幕边缘就跟着滚"的
    // 逻辑，两轮真实修复后仍有可感知的自动平移，2026-08-11 直接删除，见
    // docs/roadmap.md 对应条目）。
    this._clampScroll();
    this._applyCamera();

    clockUpdate(delta / 1000);
    this.behaviorManager.update(delta);
    if (this.director) this.director.update(delta / 1000);
    if (this.trafficManager) {
      this.trafficManager.update(delta);
      this.trafficManager.cyclistSpawner?.update(delta);
    }
    this.entityManager.update(delta);
    if (this.propManager) this.propManager.update(delta);
    this.viewfinder.updateCapture(this.entityManager.getAlive());

    this.entityGraphics.clear();
    const _extras = this.propManager ? this.propManager.getDrawables() : [];
    this.entityManager.draw(this.entityGraphics, _extras);
    if (window.__navDebug) drawNavDebug(this.entityGraphics);

    this.vfGraphics.clear();
    this.viewfinder.draw(this.vfGraphics);

    this.debugOverlay.update();

    if (this._flashAlpha > 0) {
      this._flashAlpha = Math.max(0, this._flashAlpha - (delta / 220) * 0.80);
      this.flashOverlay.alpha = this._flashAlpha;
    }

    if (!this._newsUI.isOpen()) {
      const captured = this.viewfinder.capturedEntities;
      if (captured.length > 0) {
        this.captureText
          .setText(`取景框内: ${captured.length} 个目标  [${this.viewfinder.getCapturedTags().join(', ')}]`)
          .setColor('#cc2200');
      } else if (this.captureText.style.color === 'rgb(204, 34, 0)') {
        this.captureText.setText('');
      }
    }
  }
}
