/**
 * StreetScene（PixiJS 版）
 * 主场景：2.5D俯视角街道 + 统一Entity系统 + 取景框 + 拍照/发布
 *
 * 渲染层次（从下到上）：
 *   skyContainer       — 静态天空（视差 0.45）
 *   worldContainer     — 受相机（scroll/zoom）控制：
 *     bgGraphics         静态地面（道路/人行道/树木），只绘制一次
 *     entityGraphics     所有 Entity（建筑、道具、NPC），每帧按Y排序重绘
 *     entityHighGraphics 高大道具顶部（喷泉/棋亭/摊位/树冠），恒压在 NPC 之上
 *     vfGraphics         取景框 UI（世界坐标）
 *     （DebugOverlay 的世界浮标也挂这里）
 *   uiContainer        — 屏幕固定 HUD（文本/按钮/闪光/调试面板）
 *
 * 渲染底层为 PixiJS；所有绘图文件通过 PhaserGraphicsAdapter 复用 Phaser Graphics API。
 */

import { StickRenderer }   from '../StickRenderer.js';
import { EntityManager }   from '../EntityManager.js';
import { Viewfinder }      from '../Viewfinder.js';
import { DebugOverlay }    from '../DebugOverlay.js';
import { SceneRenderer }   from './SceneRenderer.js';
import { SceneInitializer } from './SceneInitializer.js';
import { PhaserGraphicsAdapter } from '../PhaserGraphicsAdapter.js';
import {
  WORLD_WIDTH, WORLD_HEIGHT,
  GRAY_SKY, SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y,
} from '../SceneConfig.js';
import { initWalkPaths }    from '../behavior/WalkMode.js';

const POSE_FILES = {
  // held poses (delta relative to stand.json base frame)
  held_phone_call:       'held pose/phone_call',
  held_phone_look:       'held pose/phone_look',
  held_smoke:            'held pose/smoke',
  held_cross_arm:        'held pose/cross_arm',
  held_hands_in_pocket:  'held pose/hands_in_pocket',
  // traits (front)
  trait_hold_bag:  'trait/front/hold_bag',
  trait_walk_dog:  'trait/front/walk_dog',
  trait_umbrella:  'trait/front/umbrella',
  // traits (side) — 仅注册，选用逻辑待接入
  trait_hold_bag_side: 'trait/side/hold_bag',
  trait_walk_dog_side: 'trait/side/walk_dog',
  trait_umbrella_side: 'trait/side/umbrella',
  // gestures (static)
  gesture_check_watch:    'gesture/static/check_watch',
  gesture_stretch:        'gesture/static/stretch',
  gesture_yawn:           'gesture/static/yawn',
  gesture_look_around:    'gesture/static/look_around',
  gesture_adjust_clothes: 'gesture/static/adjust_clothes',
  gesture_wave:           'gesture/wave',
  // gestures (moving) — 行走/奔跑中触发
  gesture_moving_check_watch: 'gesture/moving/check_watch',
  gesture_moving_wipe_sweat:  'gesture/moving/wipe_sweat',
  // loiter
  loiter_phone: 'base/loiter/phone',
  loiter_bag_a: 'base/loiter/bag_a',
  loiter_bag_b: 'base/loiter/bag_b',
  // sub_event
  sub_event_push:        'sub_event/push',
  sub_event_give_item:   'sub_event/give_item',
  sub_event_handshake:   'sub_event/handshake',
  sub_event_point_at:    'sub_event/point_at',
  sub_event_use_vending: 'sub_event/use_vending',
  sub_event_use_trash:   'sub_event/use_trash',
};

const ANIM_FILES = {
  walk: 'base/walk', run: 'base/run', idle: 'base/idle', jog: 'base/jog', bike: 'base/bike',
  mobile: 'base/mobile', chess: 'variant/chess/chess', dogwalk: 'pet/dog_walk',
  stand: 'base/stand', sit_bench: 'base/sit_bench', fall: 'base/fall',
  lie_ground: 'base/lie_ground', lean_wall: 'base/lean_wall', squat: 'base/squat',
  sit_ground: 'base/sit_ground', lie_bench: 'base/lie_bench', get_up: 'base/get_up',
  chess_onlookers: 'variant/chess/chess_onlookers', mobike: 'base/mobike',
};

// ─── 颜色解析（'#rgb' / 'rgba(...)' / number → { color, alpha }）──────────────
function parseColor(str) {
  if (typeof str === 'number') return { color: str, alpha: 1 };
  if (typeof str !== 'string') return { color: 0x000000, alpha: 1 };
  if (str.startsWith('#')) return { color: parseInt(str.slice(1), 16), alpha: 1 };
  const m = str.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    return { color: (p[0] << 16) | (p[1] << 8) | p[2], alpha: p[3] === undefined ? 1 : p[3] };
  }
  return { color: 0x000000, alpha: 1 };
}

/**
 * PixiText — 最小化模拟 Phaser.GameObjects.Text 的链式 API。
 * 是一个 PIXI.Container：背景矩形（可选）+ 文本。供 StreetScene HUD 与 DebugOverlay 共用。
 */
class PixiText extends PIXI.Container {
  constructor(scene, x, y, str, style = {}) {
    super();
    this._scene = scene;
    this.style  = { ...style };
    this._origin = { x: 0, y: 0 };

    const fontSize = parseInt(style.fontSize, 10) || 13;
    const pixiStyle = {
      fontFamily: style.fontFamily || 'sans-serif',
      fontSize,
      fill: style.color || '#000000',
      align: style.align || 'left',
    };
    if (style.wordWrap) { pixiStyle.wordWrap = true; pixiStyle.wordWrapWidth = style.wordWrap.width; }
    if (style.lineSpacing) pixiStyle.leading = style.lineSpacing;

    this._bg  = new PIXI.Graphics();
    this._txt = new PIXI.Text(str ?? '', pixiStyle);
    this.addChild(this._bg, this._txt);

    this.position.set(x, y);
    this._redraw();
  }

  _redraw() {
    const padX = this.style.padding?.x ?? 0;
    const padY = this.style.padding?.y ?? 0;
    this._txt.position.set(padX, padY);
    const w = this._txt.width + padX * 2;
    const h = this._txt.height + padY * 2;
    this._bg.clear();
    if (this.style.backgroundColor) {
      const { color, alpha } = parseColor(this.style.backgroundColor);
      this._bg.beginFill(color, alpha);
      this._bg.drawRect(0, 0, w, h);
      this._bg.endFill();
    }
    this.pivot.set(w * this._origin.x, h * this._origin.y);
  }

  setText(str) {
    const s = String(str);
    if (this._txt.text !== s) { this._txt.text = s; this._redraw(); }
    return this;
  }
  setColor(c) { this.style.color = c; this._txt.style.fill = c; return this; }
  setPosition(x, y) { this.position.set(x, y); return this; }
  setOrigin(ox, oy = ox) { this._origin = { x: ox, y: oy }; this._redraw(); return this; }
  setVisible(v) { this.visible = v; return this; }
  setAlpha(a) { this.alpha = a; return this; }
  setDepth(d) { this.zIndex = d; return this; }
  setScrollFactor(f) {
    const target = (f === 0) ? this._scene.uiContainer : this._scene.worldContainer;
    target.addChild(this);
    return this;
  }
  setInteractive() { this.eventMode = 'static'; this.cursor = 'pointer'; return this; }
  on(event, cb) { super.on(event, cb); return this; }
}

export class StreetScene {
  constructor(app) {
    this.app = app;
    this.lastPhoto = null;
    this.viewW = app.screen.width;
    this.viewH = app.screen.height;

    // 相机状态（手动实现，替代 Phaser camera）
    this.scrollX = 0;
    this.scrollY = 0;
    this.zoom    = 1;

    // 资源缓存 + Phaser cache 兼容 shim（_buildPoseCache 仍用 this.cache.json.get）
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
    for (const [key, file] of Object.entries(POSE_FILES)) jobs.push(load('pose_' + key, `assets/animations/${file}.json`));
    await Promise.all(jobs);
  }

  create() {
    const stage = this.app.stage;
    stage.sortableChildren = true;

    // 图层容器
    this.skyContainer   = new PIXI.Container();
    this.worldContainer = new PIXI.Container();
    this.uiContainer    = new PIXI.Container();
    this.skyContainer.zIndex   = 0;
    this.worldContainer.zIndex = 1;
    this.uiContainer.zIndex    = 2;
    this.worldContainer.sortableChildren = true;
    this.uiContainer.sortableChildren    = true;
    stage.addChild(this.skyContainer, this.worldContainer, this.uiContainer);

    // Graphics 图层（用适配器包装 PIXI.Graphics）
    const mkLayer = (container, zIndex) => {
      const pg = new PIXI.Graphics();
      pg.zIndex = zIndex;
      container.addChild(pg);
      return new PhaserGraphicsAdapter(pg);
    };
    this.skyGraphics        = mkLayer(this.skyContainer, 0);
    this.bgGraphics         = mkLayer(this.worldContainer, 1);
    this.entityGraphics     = mkLayer(this.worldContainer, 2);
    this.entityHighGraphics = mkLayer(this.worldContainer, 3);
    this.vfGraphics         = mkLayer(this.worldContainer, 4);

    const sceneData = this.cache.json.get('scene_data');
    const layout = sceneData.layout;

    const sceneRenderer = new SceneRenderer(this.bgGraphics, this.skyGraphics, layout);
    sceneRenderer.drawAll();

    this.stickRenderer = new StickRenderer(this);
    for (const key of Object.keys(ANIM_FILES)) {
      this.stickRenderer.loadAnimation(key, this.cache.json.get('anim_' + key));
    }

    const poseCache = this._buildPoseCache();
    initWalkPaths(layout.walkPaths);

    this.entityManager = new EntityManager({
      farY: SIDEWALK_FAR_Y, nearY: SIDEWALK_NEAR_Y, farScale: 0.182, nearScale: 0.434,
    });

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

    // 主循环
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

  /** DOM client 坐标 → 世界坐标（考虑画布 CSS 缩放与相机 scroll/zoom）*/
  _getWorldCoords(clientX, clientY) {
    // 用逻辑屏幕尺寸 app.screen（非 view 的物理像素），避免 hi-DPI 下偏移
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

    // 闪光遮罩（屏幕固定的全屏白，alpha 由 ticker 手动淡出）
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

  // ─── 延时调用（rAF 实现，替代 Phaser time.delayedCall）──────────────────────
  _delay(ms, cb) {
    const start = performance.now();
    const tick = (now) => { if (now - start >= ms) cb(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  // ─── 导出长图（PIXI.RenderTexture）───────────────────────────────────────────
  _exportImage() {
    const renderer = this.app.renderer;
    const rt = PIXI.RenderTexture.create({ width: WORLD_WIDTH, height: WORLD_HEIGHT });

    // 底色
    const fill = new PIXI.Graphics();
    fill.beginFill(GRAY_SKY, 1).drawRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).endFill();
    renderer.render(fill, { renderTexture: rt, clear: true });
    fill.destroy();

    // 各 Graphics 图层以世界坐标（自身 local transform 为单位阵）合成
    for (const layer of [this.skyGraphics, this.bgGraphics, this.entityGraphics, this.entityHighGraphics]) {
      renderer.render(layer.g, { renderTexture: rt, clear: false });
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
    const subject = tags.filter(t => !['building', 'street-furniture'].includes(t)).join('与') || tags[0];
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

    this.behaviorManager.update(delta);
    this.spawnManager.update(delta / 1000);
    if (this.trafficManager) {
      this.trafficManager.update(delta);
      this.trafficManager.cyclistSpawner?.update(delta);
    }
    this.entityManager.update(delta);
    if (this.propManager) this.propManager.update(delta);
    this.viewfinder.updateCapture(this.entityManager.getAlive());

    this.entityGraphics.clear();
    this.entityHighGraphics.clear();
    this.entityManager.draw(this.entityGraphics, this.entityHighGraphics);
    if (this.propManager) this.propManager.draw(this.entityGraphics);

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

  // ─── poseCache ───────────────────────────────────────────────────────────────

  _buildPoseCache() {
    const g = (key) => this.cache.json.get('pose_' + key);
    const B = [-1, 12];
    const wrapHeld = (json) => {
      if (!json) return null;
      const joints = json.joints ?? json.frames?.[0] ?? json;
      const out = {};
      for (const [j, v] of Object.entries(joints)) out[j] = [v[0] - B[0], v[1] - B[1]];
      return { ...json, joints: out };
    };
    const wrapGesture = (json) => {
      if (!json) return null;
      return { ...json, keyframes: (json.keyframes ?? []).map(kf => {
        const out = { dur: kf.dur };
        for (const [k, v] of Object.entries(kf)) if (k !== 'dur') out[k] = [v[0] - B[0], v[1] - B[1]];
        return out;
      })};
    };
    const wrapLoiter = (json) => {
      if (!json) return {};
      const joints = json.joints ?? json;
      const out = {};
      for (const [j, v] of Object.entries(joints)) out[j] = [v[0] - B[0], v[1] - B[1]];
      return out;
    };
    return {
      held: {
        phone_call:      wrapHeld(g('held_phone_call')),
        phone_look:      wrapHeld(g('held_phone_look')),
        smoke:           wrapHeld(g('held_smoke')),
        cross_arm:       wrapHeld(g('held_cross_arm')),
        hands_in_pocket: wrapHeld(g('held_hands_in_pocket')),
      },
      trait: {
        // 每个 trait 含 front / side 两个变体，由 ModifierLayer 按状态选用
        hold_bag: { front: wrapHeld(g('trait_hold_bag')), side: wrapHeld(g('trait_hold_bag_side')) },
        walk_dog: { front: wrapHeld(g('trait_walk_dog')), side: wrapHeld(g('trait_walk_dog_side')) },
        umbrella: { front: wrapHeld(g('trait_umbrella')), side: wrapHeld(g('trait_umbrella_side')) },
      },
      gesture: {
        check_watch:    wrapGesture(g('gesture_check_watch')),
        stretch:        wrapGesture(g('gesture_stretch')),
        yawn:           wrapGesture(g('gesture_yawn')),
        look_around:    wrapGesture(g('gesture_look_around')),
        adjust_clothes: wrapGesture(g('gesture_adjust_clothes')),
        wave:           wrapGesture(g('gesture_wave')),
        // moving 变体
        moving_check_watch: wrapGesture(g('gesture_moving_check_watch')),
        moving_wipe_sweat:  wrapGesture(g('gesture_moving_wipe_sweat')),
      },
      loiter: {
        phone: wrapLoiter(g('loiter_phone')),
        bag_a: wrapLoiter(g('loiter_bag_a')),
        bag_b: wrapLoiter(g('loiter_bag_b')),
      },
      sub_event: {
        push:        g('sub_event_push'),
        give_item:   g('sub_event_give_item'),
        handshake:   g('sub_event_handshake'),
        point_at:    g('sub_event_point_at'),
        use_vending: g('sub_event_use_vending'),
        use_trash:   g('sub_event_use_trash'),
      },
    };
  }

}
