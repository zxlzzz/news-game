/**
 * NPC — 继承 Entity 的动态人物实体
 * 渲染委托给构造时注入的 StickRenderer。
 * 支持：playOnce 单次播放、leashTarget 绑带跟随、drawExtra 附加绘制、customUpdate 回调。
 */

import { Entity } from './Entity.js';
import { SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y } from './SceneConfig.js';

// NPC 按 Y 取灰度：远端中浅灰 → 近端中深灰（避免近端过黑）
function npcDepthGray(y) {
  const t = Math.max(0, Math.min(1, (y - SIDEWALK_FAR_Y) / (SIDEWALK_NEAR_Y - SIDEWALK_FAR_Y)));
  const v = Math.round(0x78 + t * (0x32 - 0x78));
  return (v << 16) | (v << 8) | v;
}

export class NPC extends Entity {
  /**
   * @param {object}        config
   * @param {StickRenderer} config.renderer      - 火柴人渲染器（必须）
   * @param {string}        config.animation     - 动画名称
   * @param {number}        config.direction     - 1=右，-1=左
   * @param {number}        config.speed         - 水平速度（像素/秒）
   * @param {number}        config.vy            - 纵深漂移速度（像素/秒）
   * @param {number}        config.scale         - 初始缩放（EntityManager每帧会按Y覆盖）
   * @param {number}        config.color         - 服装颜色
   * @param {number}        config.minX/maxX     - X活动边界
   * @param {number}        config.minY/maxY     - Y活动边界
   * @param {boolean}       config.playOnce      - true=动画只播放一次，结束后设 animDone=true
   * @param {NPC}           config.leashTarget   - 若设置则每帧同步到目标NPC的偏移位置
   * @param {{x,y}}         config.leashOffset   - 相对于 leashTarget 的偏移（x乘以目标direction）
   * @param {Function}      config.drawExtra     - (g, npc)=>void，在骨架前绘制（如自行车、绳索）
   * @param {Function}      config.customUpdate  - (npc, delta)=>void，每帧末尾调用
   */
  constructor(config) {
    super({
      ...config,
      width:  40,
      height: 80,
      static: false,
    });

    this.renderer  = config.renderer;
    this.animation = config.animation || 'idle';
    this.direction = config.direction || 1;
    this.speed     = config.speed     || 0;
    this.vy        = config.vy !== undefined ? config.vy : (Math.random() * 2 - 1) * 18;
    this.scale     = config.scale     ?? 0.45;
    this.color     = config.color     ?? 0x1a1a1a;

    this.frameIndex = 0;
    this.frameTimer = 0;

    this.minX = config.minX ?? -100;
    this.maxX = config.maxX ?? 2100;
    this.minY = config.minY ?? 250;
    this.maxY = config.maxY ?? 460;

    // 单次播放
    this.playOnce = config.playOnce ?? false;
    this.animDone = false;

    // 绑带跟随
    this.leashTarget = config.leashTarget ?? null;
    this.leashOffset = config.leashOffset ?? { x: 0, y: 0 };

    // 附加绘制 / 自定义更新
    this.drawExtra    = config.drawExtra    ?? null;
    this.customUpdate = config.customUpdate ?? null;
  }

  getBounds() {
    const h = 80 * this.scale * 2;
    const w = 40 * this.scale * 2;
    return {
      x:      this.x - w / 2,
      y:      this.y - h,
      width:  w,
      height: h,
    };
  }

  // ─── 锚点系统（仅用于视觉对齐，不参与碰撞/取景框） ───────────────────────
  // 把命名锚点映射到动画关节，按与 StickRenderer 完全一致的变换求世界坐标。
  // human: head/neck/hand_l/hand_r/hip/foot_l/foot_r ；dog: neck/head/hip
  _renderY() {
    if (!this.steadyFoot) return this.y;
    const anim = this.renderer.getAnimation(this.animation);
    if (!anim) return this.y;
    if (anim._maxFootY === undefined) {
      let m = 0;
      for (const f of anim.frames) m = Math.max(m, f.l_foot[1], f.r_foot[1]);
      anim._maxFootY = m;
    }
    const frame = anim.frames[this.frameIndex % anim.frameCount];
    const frameMax = Math.max(frame.l_foot[1], frame.r_foot[1]);
    return this.y + (frameMax - anim._maxFootY) * this.scale;
  }

  /**
   * 返回命名锚点的世界坐标 {x, y}
   * @param {string} name head|neck|hand_l|hand_r|hip|foot_l|foot_r（dog: neck|head|hip）
   */
  getAnchor(name) {
    const anim = this.renderer.getAnimation(this.animation);
    if (!anim) return { x: this.x, y: this.y };
    const frame = anim.frames[this.frameIndex % anim.frameCount];
    const isDog = anim.skeleton === 'dog';
    const map = isDog
      ? { neck: 'neck', head: 'head', hip: 'body_back', body: 'body_back' }
      : { head: 'head', neck: 'neck', hand_l: 'l_hand', hand_r: 'r_hand',
          hip: 'body', foot_l: 'l_foot', foot_r: 'r_foot' };
    const jn = map[name] || name;
    const jp = frame[jn];
    if (!jp) return { x: this.x, y: this.y };
    const footY = isDog
      ? Math.max(frame.fl_lower[1], frame.fr_lower[1], frame.bl_lower[1], frame.br_lower[1])
      : Math.max(frame.l_foot[1], frame.r_foot[1]);
    const renderY = this._renderY();
    return {
      x: this.x + jp[0] * this.scale * this.direction,
      y: renderY + jp[1] * this.scale - footY * this.scale,
    };
  }

  update(delta) {
    if (!this.alive) return;

    // 绑带：同步到主人位置
    if (this.leashTarget) {
      this.x = this.leashTarget.x + this.leashOffset.x * this.leashTarget.direction;
      this.y = this.leashTarget.y + this.leashOffset.y;
      this.direction = this.leashTarget.direction;
    }

    // 动画帧推进
    const anim = this.renderer.getAnimation(this.animation);
    if (anim && !this.animDone) {
      this.frameTimer += delta;
      const interval = 1000 / anim.fps;
      if (this.frameTimer >= interval) {
        this.frameTimer -= interval;
        if (this.playOnce && this.frameIndex >= anim.frameCount - 1) {
          this.animDone = true;
        } else {
          this.frameIndex = (this.frameIndex + 1) % anim.frameCount;
        }
      }
    }

    // 非绑带NPC：执行X/Y位移
    if (!this.leashTarget) {
      if (this.speed > 0) {
        this.x += this.direction * this.speed * (delta / 1000);
        if      (this.x > this.maxX) { this.x = this.maxX; this.direction = -1; }
        else if (this.x < this.minX) { this.x = this.minX; this.direction =  1; }
      }
      this.y += this.vy * (delta / 1000);
      if      (this.y > this.maxY) { this.y = this.maxY; this.vy = -Math.abs(this.vy); }
      else if (this.y < this.minY) { this.y = this.minY; this.vy =  Math.abs(this.vy); }
    }

    if (this.customUpdate) this.customUpdate(this, delta);
  }

  draw(g) {
    if (!this.alive || !this.visible) return;

    // 附加绘制（自行车、摩托、绳索）在骨架前。drawExtra 内可调用 this.getAnchor(...)
    // 围绕骑手/主人的真实锚点作画，从而实现精确对齐。
    if (this.drawExtra) this.drawExtra(g, this);

    // 纯黑白灰画风：忽略 config.color，按 Y 深度自动取灰度
    // 取景框命中时仍用红色高亮（唯一保留的彩色，方便玩家定位捕获目标）
    const color = this.inViewfinder ? 0xcc2200 : npcDepthGray(this.y);

    this.renderer.draw(
      g, this.animation, this.frameIndex,
      this.x, this._renderY(), this.scale, this.direction,
      color, 1
    );

    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }
}
