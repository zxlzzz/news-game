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
 *     vfGraphics         取景框 UI（世界坐标）
 *     （DebugOverlay 的世界浮标也挂这里）
 *   uiContainer        — 屏幕固定 HUD（文本/按钮/闪光/调试面板）
 *
 * 渲染底层为 PixiJS；所有绘图文件直接调用 PIXI.Graphics 原生 API。
 */

import { StickRenderer }   from '../core/StickRenderer.js';
import { EntityManager }   from '../core/EntityManager.js';
import { Viewfinder }      from '../camera/Viewfinder.js';
import { DebugOverlay }    from '../ui/DebugOverlay.js';
import { SceneRenderer }   from './SceneRenderer.js';
import { SceneInitializer } from './SceneInitializer.js';
import {
  WORLD_WIDTH, WORLD_HEIGHT,
  GRAY_SKY, SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y,
  initLayout,
} from '../core/Layout.js';
import { toScreen, toWorld, sceneScreenBounds } from '../core/Projection.js';
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

    this.scrollX = 0;
    this.scrollY = 0;
    this.zoom    = 1;

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
    this.vfGraphics         = mkLayer(this.worldContainer, 4);

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
      getWorldCoords: (cx, cy) => this._getWorldCoords(cx, cy),
    }, { x: 1641, y: 1562, width: 1112, height: 768 }); // O-1：世界单位，× 5.294118（原 310/295/210/145）
    // 相机开局就摆到默认取景框附近，不留在世界原点——见 _centerCameraOn 注释。
    const vfc0 = this.viewfinder.getCenter();
    this._centerCameraOn(vfc0.x, vfc0.y);
    this._createUI();
    this.debugOverlay = new DebugOverlay(this, this.behaviorManager, this.entityManager);

    this._setupInput();
    this._clampScroll();
    this._applyCamera();

    // 调试用：暴露时钟控制到 window
    window.__clock = { setSpeed: setClockSpeed, setTime: setGameTime, now: () => gameTimeStr() };

    this.app.ticker.add(() => this.update(this.app.ticker.deltaMS));
  }

  // ─── 相机 ──────────────────────────────────────────────────────────────────
  // O-2：worldContainer 不再整体乘 PX_PER_UNIT（那套仿射变换被 Projection.toScreen
  // 取代——draw 调用直接算出绝对屏幕像素，见 Projection.js 文件头的核心区分）。
  // 容器自己只剩两件事：zoom（缩放）+ 相机 pan（把 (scrollX,scrollY) 这个世界点
  // 挪到视口左上角）。pan 本身也要经 toScreen 换算——scrollX/scrollY 是世界坐标，
  // 而 position 挪的是已经投影过的屏幕像素，两者不能直接相减/相乘。
  // skyContainer 不受此影响（天空/云/天际线仍是不经投影的屏幕像素画风几何，
  // O-6 天际线平贴层前不重绘），视差位移沿用 pan 的屏幕像素值乘 0.45。
  _applyCamera() {
    const pan = toScreen(this.scrollX, this.scrollY);
    this.worldContainer.scale.set(this.zoom);
    this.worldContainer.position.set(-pan.x * this.zoom, -pan.y * this.zoom);
    this.skyContainer.scale.set(this.zoom);
    this.skyContainer.position.set(-pan.x * 0.45 * this.zoom, -pan.y * 0.45 * this.zoom);
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
   * 摆到默认取景框附近，而不是留在世界原点 (0,0)。
   *
   * 不这么做的后果（找到的第二个"镜头自己动"根因）：默认取景框中心在世界
   * x≈2197（远离原点），初始 scrollX=0 时 update() 里的取景框跟随逻辑判定
   * "取景框太靠右边缘"，从 0 开始每帧 +2.5 世界单位地把 scrollX 追上去，
   * 收敛点在 scrollX≈478——单看代码这是收敛的（不是死循环/跑出边界的那种
   * bug），但对着玩家就是"贴地打开页面时镜头自己滑了三秒多"，跟没修一样
   * 难受。开局就把相机摆到取景框附近，跟随逻辑第一帧就已经满足条件，不用
   * 再动。
   */
  _centerCameraOn(wx, wy) {
    const t   = toScreen(wx, wy);
    const pan = { x: t.x - this.viewW / (2 * this.zoom), y: t.y - this.viewH / (2 * this.zoom) };
    const w   = toWorld(pan.x, pan.y);
    this.scrollX = w.x;
    this.scrollY = w.y;
  }

  _clampScroll() {
    const bounds = sceneScreenBounds(this._maxFacadeH ?? 0);
    const viewSpanX = this.viewW / this.zoom;
    const viewSpanY = this.viewH / this.zoom;
    const maxPanX = Math.max(bounds.minX, bounds.maxX - viewSpanX);
    const maxPanY = Math.max(bounds.minY, bounds.maxY - viewSpanY);
    const pan = toScreen(this.scrollX, this.scrollY);
    const clampedX = Math.min(Math.max(bounds.minX, pan.x), maxPanX);
    const clampedY = Math.min(Math.max(bounds.minY, pan.y), maxPanY);
    const w = toWorld(clampedX, clampedY);
    this.scrollX = w.x;
    this.scrollY = w.y;
  }

  /** 视口内屏幕像素坐标（0,0 = 视口左上角）→ 世界坐标。鼠标拾取/取景框/相机换算共用。 */
  _screenToWorld(sx, sy) {
    const pan = toScreen(this.scrollX, this.scrollY);
    return toWorld(sx / this.zoom + pan.x, sy / this.zoom + pan.y);
  }

  _getWorldCoords(clientX, clientY) {
    const rect = this.app.view.getBoundingClientRect();
    const sx = (clientX - rect.left) * (this.app.screen.width  / rect.width);
    const sy = (clientY - rect.top)  * (this.app.screen.height / rect.height);
    return this._screenToWorld(sx, sy);
  }

  // ─── 输入 ──────────────────────────────────────────────────────────────────
  _setupInput() {
    const keyMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    window.addEventListener('keydown', (e) => {
      if (keyMap[e.key]) { this.keys[keyMap[e.key]] = true; return; }
      const k = e.key.toLowerCase();
      if (k === 'p') this._exportImage();
      else if (k === 'd') this.debugOverlay.toggle();
      else if (k === 'z') { this.zoom = 1; this.scrollY = 0; this._clampScroll(); this._applyCamera(); }
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
      const before  = this._getWorldCoords(e.clientX, e.clientY);
      this.zoom = newZoom;
      const after   = this._getWorldCoords(e.clientX, e.clientY);
      this.scrollX += before.x - after.x;
      this.scrollY += before.y - after.y;
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
  _exportImage() {
    const renderer = this.app.renderer;
    const RES = 2; // 或 window.devicePixelRatio，喂视觉模型可以用 2~3
    const rt = PIXI.RenderTexture.create({
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      resolution: RES,
    });

    const fill = new PIXI.Graphics();
    fill.beginFill(GRAY_SKY, 1).drawRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).endFill();
    renderer.render(fill, { renderTexture: rt, clear: true });
    fill.destroy();

    for (const layer of [this.skyGraphics, this.bgGraphics, this.entityGraphics]) {
      renderer.render(layer, { renderTexture: rt, clear: false });
    }

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

    // 1. clamp viewfinder into current viewport
    this._clampViewfinderToViewport();

    const vf = this.viewfinder;
    const z  = this.zoom;

    // 2. world coords → screen pixels：取景框的世界矩形投影后是平行四边形
    // （O-2 shear），但 extract.canvas 只能截一个轴对齐矩形——用四角投影后的
    // 屏幕空间包围盒，会比理论平行四边形略宽，可接受（截图本来就是"大致取景"）。
    const pan = toScreen(this.scrollX, this.scrollY);
    const corners = [
      toScreen(vf.x,           vf.y),
      toScreen(vf.x + vf.width, vf.y),
      toScreen(vf.x,           vf.y + vf.height),
      toScreen(vf.x + vf.width, vf.y + vf.height),
    ];
    const cxs = corners.map(c => c.x), cys = corners.map(c => c.y);
    const minX = Math.min(...cxs), maxX = Math.max(...cxs);
    const minY = Math.min(...cys), maxY = Math.max(...cys);
    const sx = Math.round((minX - pan.x) * z);
    const sy = Math.round((minY - pan.y) * z);
    const sw = Math.max(1, Math.round((maxX - minX) * z));
    const sh = Math.max(1, Math.round((maxY - minY) * z));

    // 3. hide viewfinder graphics so they don't appear in screenshot
    this.vfGraphics.visible = false;

    // 4. extract screenshot
    const frame  = new PIXI.Rectangle(sx, sy, sw, sh);
    const canvas = this.app.renderer.extract.canvas(this.app.stage, frame);
    const photoRef = canvas.toDataURL('image/png');

    // 5. restore
    this.vfGraphics.visible = true;

    // 6. flash feedback
    this._flashAlpha = 0.80;
    this.flashOverlay.alpha = this._flashAlpha;

    // 7. build snapshot + kick off vision in parallel
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

  _clampViewfinderToViewport() {
    // O-2：可见区域在世界坐标下不再是矩形（shear 之后是平行四边形），这里用
    // 视口四角反投影回世界坐标后的 AABB 近似——取景框只是不越出屏幕太多，
    // 精确到平行四边形没有必要，近似够用。
    const vf = this.viewfinder;
    const corners = [
      this._screenToWorld(0, 0), this._screenToWorld(this.viewW, 0),
      this._screenToWorld(0, this.viewH), this._screenToWorld(this.viewW, this.viewH),
    ];
    const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    vf.x = Math.max(minX, Math.min(vf.x, maxX - vf.width));
    vf.y = Math.max(minY, Math.min(vf.y, maxY - vf.height));
  }

  _buildEntitySnapshot(vf) {
    const entities = this.viewfinder.capturedEntities.map(e => ({
      id:   e.id ?? e.propType ?? 'unknown',
      tags: (typeof e.getTags === 'function') ? e.getTags() : (e.tags ?? []),
    }));
    return {
      entities,
      rect:      { x: vf.x, y: vf.y, w: vf.width, h: vf.height },
      timestamp: Date.now(),
    };
  }

  // ─── 每帧更新 ─────────────────────────────────────────────────────────────────
  update(delta) {
    const spd = 300 * (delta / 1000);

    if (this.keys.left)       this.scrollX -= spd;
    else if (this.keys.right) this.scrollX += spd;
    if (this.keys.up)         this.scrollY -= spd;
    else if (this.keys.down)  this.scrollY += spd;

    // 取景框跟随：把取景框中心投影到当前屏幕像素空间再跟 viewW/margin 比较——
    // 这两者现在天然同处一个空间（屏幕像素），比换算 margin 到世界单位更准：
    // O-2 引入 shear 后，世界 x 和屏幕 x 已经不是纯比例关系（see Projection.js），
    // 世界单位空间里的简单换算会有 shear 带来的系统误差，直接在投影后的屏幕
    // 空间比较就不需要管这个（历史：O-1 刚落地时这里犯过反过来的 bug——拿世界
    // 单位直接跟屏幕像素比，开局/静止时相机会自己往右漂）。
    const vfc   = this.viewfinder.getCenter();
    const pan   = toScreen(this.scrollX, this.scrollY);
    const vfcSx = (toScreen(vfc.x, vfc.y).x - pan.x) * this.zoom;
    const margin = 80;
    if (vfcSx < margin)                     this.scrollX -= spd * 0.5;
    else if (this.viewW - vfcSx < margin)   this.scrollX += spd * 0.5;

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
