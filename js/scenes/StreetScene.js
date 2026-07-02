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
import { PixiText }         from '../core/PixiText.js';
import { getManifestPaths, buildPoseCache } from '../behavior/PoseCacheBuilder.js';
import { clockUpdate, gameTimeStr, setClockSpeed, setGameTime } from '../core/GameClock.js';
import { drawNavDebug } from '../behavior/nav/NavGrid.js';

const ANIM_FILES = {
  walk: 'base/walk', run: 'base/run', idle: 'base/idle', jog: 'base/jog', bike: 'base/bike',
  mobile: 'base/mobile', chess: 'variant/chess/chess', dogwalk: 'pet/dog_walk',
  stand: 'base/stand', sit_bench: 'base/sit_bench', fall: 'base/fall',
  lie_ground: 'base/lie_ground', lean_wall: 'base/lean_wall', squat: 'base/squat',
  sit_ground: 'base/sit_ground', lie_bench: 'base/lie_bench', get_up: 'base/get_up',
  chess_onlookers: 'variant/chess/chess_onlookers', mobike: 'base/mobike',
};

export class StreetScene {
  constructor(app) {
    this.app = app;
    this.lastPhoto = null;
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
    const jobs = [load('scene_data', 'assets/scene.json')];
    for (const [key, file] of Object.entries(ANIM_FILES)) jobs.push(load('anim_' + key, `assets/animations/${file}.json`));
    for (const [key, file] of getManifestPaths()) jobs.push(load('pose_' + key, `assets/animations/${file}.json`));
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

    const sceneData = this.cache.json.get('scene_data');
    const layout = sceneData.layout;

    const sceneRenderer = new SceneRenderer(this.bgGraphics, this.skyGraphics, layout);
    sceneRenderer.drawAll();

    this.stickRenderer = new StickRenderer(this);
    for (const key of Object.keys(ANIM_FILES)) {
      this.stickRenderer.loadAnimation(key, this.cache.json.get('anim_' + key));
    }

    const poseCache = buildPoseCache(key => this._json['pose_' + key]);
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

    this.uiText = this.add.text(10, 10, '← → 滚动  |  滚轮缩放  Z 重置  |  拖动取景框 · 拖右下角缩放  |  P 导出长图  |  D 调试', {
      fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', color: '#555555',
      backgroundColor: 'rgba(240,236,228,0.85)', padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.captureText = this.add.text(10, 36, '', {
      fontFamily: '"Noto Sans SC", sans-serif', fontSize: '13px', color: '#cc2200',
      backgroundColor: 'rgba(240,236,228,0.85)', padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.headlinePanel = this.add.text(10, 64, '', {
      fontFamily: '"Noto Sans SC", sans-serif', fontSize: '15px', color: '#ffffff',
      backgroundColor: 'rgba(10,10,30,0.90)', padding: { x: 12, y: 8 },
      wordWrap: { width: W - 200 },
    }).setScrollFactor(0).setDepth(200).setVisible(false);

    this.flashOverlay = new PIXI.Graphics();
    this.flashOverlay.beginFill(0xffffff, 1).drawRect(0, 0, W, H).endFill();
    this.flashOverlay.alpha = 0;
    this.flashOverlay.zIndex = 190;
    this.uiContainer.addChild(this.flashOverlay);

    this.btnCapture = this._makeButton(W - 126, H - 50, '[ 拍  照 ]', '#b83000');
    this.btnCapture.on('pointerdown', () => this._takePhoto());

    this.btnPublish = this._makeButton(W - 126, H - 90, '[ 发布新闻 ]', '#1a3d99');
    this.btnPublish.setVisible(false);
    this.btnPublish.on('pointerdown', () => this._publishNews());
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
    const rt = PIXI.RenderTexture.create({ width: WORLD_WIDTH, height: WORLD_HEIGHT });

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

  // ─── 拍照 / 发布 ──────────────────────────────────────────────────────────────
  _takePhoto() {
    const count = this.viewfinder.capturedEntities.length;
    if (count === 0) {
      this.captureText.setText('取景框内没有目标！').setColor('#cc2200');
      this._delay(1500, () => this.captureText.setText(''));
      return;
    }
    this.lastPhoto = { tags: this.viewfinder.getCapturedTags(), count };
    this._flashAlpha = 0.80;
    this.flashOverlay.alpha = this._flashAlpha;
    this.btnPublish.setVisible(true);
    this.captureText
      .setText(`已拍摄 ${count} 个目标  [${this.lastPhoto.tags.join('  ')}]`)
      .setColor('#226600');
  }

  _publishNews() {
    if (!this.lastPhoto) return;
    const headline = this._generateHeadline(this.lastPhoto.tags, this.lastPhoto.count);
    this.headlinePanel.setText(`【快讯】${headline}`).setVisible(true);
    this._delay(7000, () => this.headlinePanel.setVisible(false));
    this.lastPhoto = null;
    this.btnPublish.setVisible(false);
    this.captureText.setText('新闻已发布！').setColor('#1a3d99');
    this._delay(2000, () => this.captureText.setText(''));
  }

  _generateHeadline(tags, count) {
    const subject = tags.filter(t => t !== 'building').join('与') || tags[0];
    const templates = [
      `${count}个目标聚集现场，真相令人震惊`,
      `独家现场：${subject}背后的秘密`,
      `记者深度揭秘：${subject}事件始末`,
      `突发！${subject}异动，专家紧急发声`,
      `${subject}事件曝光，舆论哗然`,
      `疑云！${subject}现场完整记录`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
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

    if (!this.lastPhoto) {
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
