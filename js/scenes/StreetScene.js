/**
 * StreetScene
 * 主场景：2.5D俯视角街道 + 统一Entity系统 + 取景框 + 拍照/发布
 *
 * 渲染层次（从下到上）：
 *   bgGraphics         — 静态地面（道路/人行道/树木），只绘制一次
 *   entityGraphics     — 所有 Entity（建筑、道具、NPC），每帧按Y排序重绘
 *   entityHighGraphics — 高大道具（喷泉/棋亭/摊位/滑梯），恒压在 NPC 之上
 *   vfGraphics         — 取景框 UI，最上层
 */

import { StickRenderer }   from '../StickRenderer.js';
import { EntityManager }   from '../EntityManager.js';
import { Viewfinder }      from '../Viewfinder.js';
import { DebugOverlay }    from '../DebugOverlay.js';
import { SceneRenderer }   from './SceneRenderer.js';
import { SceneInitializer } from './SceneInitializer.js';
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

export class StreetScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StreetScene' });
    this.lastPhoto = null;
  }

  preload() {
    this.load.json('scene_data', 'assets/scene.json');
    for (const [key, file] of Object.entries(ANIM_FILES)) {
      this.load.json('anim_' + key, `assets/animations/${file}.json`);
    }
    for (const [key, file] of Object.entries(POSE_FILES)) {
      this.load.json('pose_' + key, `assets/animations/${file}.json`);
    }
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(GRAY_SKY);

    this.skyGraphics    = this.add.graphics().setScrollFactor(0.45);
    this.bgGraphics     = this.add.graphics();
    this.entityGraphics     = this.add.graphics();
    this.entityHighGraphics = this.add.graphics();
    this.vfGraphics         = this.add.graphics();

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

    this.viewfinder = new Viewfinder(this, { x: 310, y: 295, width: 210, height: 145 });
    this._createUI();
    this.debugOverlay = new DebugOverlay(this, this.behaviorManager, this.entityManager);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-P', () => this._exportImage());
    this.input.keyboard.on('keydown-D', () => this.debugOverlay.toggle());
    this._setupZoom();
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────

  _createUI() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

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

    this.flashOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0)
      .setScrollFactor(0).setDepth(190);

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
    }).setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setAlpha(0.78));
    btn.on('pointerout',  () => btn.setAlpha(1.0));
    return btn;
  }

  // ─── 导出长图 ───────────────────────────────────────────────────────────────

  _exportImage() {
    const key = '__pano_' + Date.now();
    const dt = this.textures.addDynamicTexture(key, WORLD_WIDTH, WORLD_HEIGHT);
    if (!dt) return;
    dt.fill(GRAY_SKY, 1);
    dt.draw([this.skyGraphics, this.bgGraphics, this.entityGraphics, this.entityHighGraphics], 0, 0);
    dt.snapshot((image) => {
      const a = document.createElement('a');
      a.href = image.src;
      a.download = `news-street-pano-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      this.textures.remove(key);
    });
  }

  // ─── 拍照 / 发布 ──────────────────────────────────────────────────────────────

  _takePhoto() {
    const count = this.viewfinder.capturedEntities.length;
    if (count === 0) {
      this.captureText.setText('取景框内没有目标！').setColor('#cc2200');
      this.time.delayedCall(1500, () => this.captureText.setText(''));
      return;
    }
    this.lastPhoto = { tags: this.viewfinder.getCapturedTags(), count };
    this.flashOverlay.setAlpha(0.80);
    this.tweens.add({ targets: this.flashOverlay, alpha: 0, duration: 220, ease: 'Power2' });
    this.btnPublish.setVisible(true);
    this.captureText
      .setText(`已拍摄 ${count} 个目标  [${this.lastPhoto.tags.join('  ')}]`)
      .setColor('#226600');
  }

  _publishNews() {
    if (!this.lastPhoto) return;
    const headline = this._generateHeadline(this.lastPhoto.tags, this.lastPhoto.count);
    this.headlinePanel.setText(`【快讯】${headline}`).setVisible(true);
    this.time.delayedCall(7000, () => this.headlinePanel.setVisible(false));
    this.lastPhoto = null;
    this.btnPublish.setVisible(false);
    this.captureText.setText('新闻已发布！').setColor('#1a3d99');
    this.time.delayedCall(2000, () => this.captureText.setText(''));
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

  // ─── 滚轮缩放 ─────────────────────────────────────────────────────────────────

  _setupZoom() {
    const cam = this.cameras.main;
    this.input.on('wheel', (pointer, _objs, _dx, deltaY) => {
      const factor  = deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Phaser.Math.Clamp(cam.zoom * factor, 0.5, 2.0);
      const wx = cam.scrollX + pointer.x / cam.zoom;
      const wy = cam.scrollY + pointer.y / cam.zoom;
      cam.zoom = newZoom;
      cam.scrollX = wx - pointer.x / newZoom;
      cam.scrollY = wy - pointer.y / newZoom;
      this._updateUIForZoom(newZoom);
    });
    this.input.keyboard.on('keydown-Z', () => {
      cam.zoom = 1.0;
      cam.scrollY = 0;
      this._updateUIForZoom(1.0);
    });
  }

  _updateUIForZoom(zoom) {
    const iz = 1 / zoom;
    const W  = this.cameras.main.width;
    const H  = this.cameras.main.height;
    this.uiText.setPosition(10 * iz, 10 * iz);
    this.captureText.setPosition(10 * iz, 36 * iz);
    this.headlinePanel.setPosition(10 * iz, 64 * iz);
    this.flashOverlay.setPosition(W / 2 * iz, H / 2 * iz);
    this.flashOverlay.setDisplaySize(W * iz, H * iz);
    this.btnCapture.setPosition((W - 126) * iz, (H - 50) * iz);
    this.btnPublish.setPosition((W - 126) * iz, (H - 90) * iz);
    if (this.debugOverlay) this.debugOverlay.panel.setPosition(10 * iz, 150 * iz);
  }

  // ─── 每帧更新 ─────────────────────────────────────────────────────────────────

  update(time, delta) {
    const cam = this.cameras.main;
    const spd = 300 * (delta / 1000);

    if (this.cursors.left.isDown)       cam.scrollX -= spd;
    else if (this.cursors.right.isDown) cam.scrollX += spd;
    if (this.cursors.up.isDown)         cam.scrollY -= spd;
    else if (this.cursors.down.isDown)  cam.scrollY += spd;

    const vfc    = this.viewfinder.getCenter();
    const margin = 80;
    if (vfc.x - cam.scrollX < margin)                    cam.scrollX -= spd * 0.5;
    else if (cam.scrollX + cam.width - vfc.x < margin)   cam.scrollX += spd * 0.5;

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