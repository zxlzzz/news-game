/**
 * StreetScene（PixiJS 版）
 * 主场景：2.5D俯视角街道 + 统一Entity系统 + 取景框 + 拍照/发布
 *
 * 渲染层次（从下到上）：
 *   skyContainer       — 静态天空（视差 0.45）
 *   worldContainer     — 受相机（scroll/zoom）控制：
 *     bgGraphics         静态地面（道路/人行道/树木），只绘制一次
 *     entityGraphics     所有 Entity（建筑、道具、NPC），每帧按Y排序重绘
 *                        （stall/tree 用 _sortY 上移排序基准以遮挡后方 NPC）
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
} from '../core/Layout.js';
import { initWalkPaths }    from '../behavior/WalkMode.js';
import { expandSceneData }  from '../core/sceneData.js';
import { PixiText }         from '../core/PixiText.js';
import { buildPoseCache } from '../behavior/PoseCacheBuilder.js';
import { clipLibrary } from '../core/ClipLibrary.js';
import { clockUpdate, gameTimeStr, setClockSpeed, setGameTime } from '../core/GameClock.js';
import { drawNavDebug } from '../behavior/nav/NavGrid.js';
import { audit } from '../debug/MovementAudit.js';
import { vision, text, setLastSnapshot } from '../news/providers.js';
import { NewsArchive } from '../news/NewsArchive.js';
import { NewsUI } from '../news/NewsUI.js';


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
    const layout = sceneData.layout;

    const sceneRenderer = new SceneRenderer(this.bgGraphics, this.skyGraphics, layout);
    sceneRenderer.drawAll();

    this.stickRenderer = new StickRenderer(this);
    for (const id of Object.keys(clipLibrary.manifest.clips)) {
      this.stickRenderer.loadAnimation(id, clipLibrary.resolve(id));
    }

    const poseCache = buildPoseCache(clipLibrary);
    initWalkPaths(layout.walkPaths);

    this.entityManager = new EntityManager();

    const initializer = new SceneInitializer(this, this.entityManager, this.stickRenderer, poseCache);
    initializer.spawnAll(sceneData, layout);

    this.viewfinder = new Viewfinder({
      app: this.app,
      getWorldCoords: (cx, cy) => this._getWorldCoords(cx, cy),
    }, { x: 310, y: 295, width: 210, height: 145 });
    this._createUI();
    this.debugOverlay = new DebugOverlay(this, this.behaviorManager, this.entityManager);

    this._setupInput();
    this._applyCamera();

    // 调试用：暴露时钟控制到 window
    window.__clock = { setSpeed: setClockSpeed, setTime: setGameTime, now: () => gameTimeStr() };

    this.app.ticker.add(() => this.update(this.app.ticker.deltaMS));
  }

  // ─── 相机 ──────────────────────────────────────────────────────────────────
  _applyCamera() {
    const z = this.zoom;
    this.worldContainer.scale.set(z);
    this.worldContainer.position.set(-this.scrollX * z, -this.scrollY * z);
    this.skyContainer.scale.set(z);
    this.skyContainer.position.set(-this.scrollX * 0.45 * z, -this.scrollY * 0.45 * z);
  }

  _clampScroll() {
    const z = this.zoom;
    const maxX = Math.max(0, WORLD_WIDTH  - this.viewW / z);
    const maxY = Math.max(0, WORLD_HEIGHT - this.viewH / z);
    this.scrollX = Math.min(Math.max(0, this.scrollX), maxX);
    this.scrollY = Math.min(Math.max(0, this.scrollY), maxY);
  }

  _getWorldCoords(clientX, clientY) {
    const rect = this.app.view.getBoundingClientRect();
    const sx = (clientX - rect.left) * (this.app.screen.width  / rect.width);
    const sy = (clientY - rect.top)  * (this.app.screen.height / rect.height);
    return { x: sx / this.zoom + this.scrollX, y: sy / this.zoom + this.scrollY };
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
      else if (k === 'c') this._takePhoto();
      else if (k === 's') this._newsUI?.openSettings();
      else if (k === 'a') { if (this._newsUI?.isOpen()) this._newsUI.close(); else this._newsUI?.openArchive(); }
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

    this.uiText = this.add.text(10, 10, '← → 滚动  |  滚轮缩放  Z 重置  |  拖动取景框 · 拖右下角缩放  |  C 拍照  A 存档  S 设置  |  P 导出  D 调试', {
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
      { vision, text },
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

    // 2. world coords → screen pixels
    const sx = Math.round((vf.x - this.scrollX) * z);
    const sy = Math.round((vf.y - this.scrollY) * z);
    const sw = Math.max(1, Math.round(vf.width  * z));
    const sh = Math.max(1, Math.round(vf.height * z));

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

    this.captureText.setText(`已拍摄 ${vf.capturedEntities.length} 个目标`).setColor('#226600');
    this._newsUI.openComposer({ photoRef, entitySnapshot, visionPromise });
  }

  _clampViewfinderToViewport() {
    const vf   = this.viewfinder;
    const z    = this.zoom;
    const maxX = this.scrollX + this.viewW / z;
    const maxY = this.scrollY + this.viewH / z;
    vf.x = Math.max(this.scrollX, Math.min(vf.x, maxX - vf.width));
    vf.y = Math.max(this.scrollY, Math.min(vf.y, maxY - vf.height));
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

    const vfc    = this.viewfinder.getCenter();
    const margin = 80;
    if (vfc.x - this.scrollX < margin)                       this.scrollX -= spd * 0.5;
    else if (this.scrollX + this.viewW - vfc.x < margin)     this.scrollX += spd * 0.5;

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
    this.entityManager.drawShadows(this.entityGraphics, _extras);
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
