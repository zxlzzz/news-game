/**
 * NPC — 继承 Entity 的动态人物实体
 * 渲染委托给构造时注入的 StickRenderer。
 * 支持：playOnce 单次播放、leashTarget 绑带跟随、drawExtra 附加绘制、customUpdate 回调。
 */

import { Entity } from './Entity.js';
import { SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y } from './SceneConfig.js';
import { humanOffsetY, dogOffsetY } from './StickRenderer.js';

// 行为状态 → 标签
const STATE_TAGS = {
  walk: 'walking', run: 'running', stand: 'standing',
  sit_bench: 'sitting', lie_ground: 'lying', fall: 'falling', talk: 'talking',
  // 批次 1 新增状态
  lean_wall: 'leaning', squat: 'squatting', sit_ground: 'sitting',
  lie_bench: 'lying', get_up: 'getting_up',
  loiter: 'loitering',
  routing: 'walking',
};
// overlay → 额外语义标签（overlay 名本身也会作为标签加入）
const OVERLAY_EXTRA_TAGS = {
  smoke: 'smoking', hold_bag: 'carrying',
};
// 无状态机托管时按动画名推断标签（chess/cycle/dance 等专用场景）
const ANIM_TAGS = {
  walk: 'walking', run: 'running', jog: 'jogging', bike: 'cycling',
  mobile: 'riding', idle: 'standing', single: 'standing', chess: 'sitting',
  sit_bench: 'sitting', lie_ground: 'lying', fall: 'falling',
};

// NPC 按 Y 取灰度：远端中浅灰 → 近端中深灰（避免近端过黑）
function npcDepthGray(y) {
  const t = Math.max(0, Math.min(1, (y - SIDEWALK_FAR_Y) / (SIDEWALK_NEAR_Y - SIDEWALK_FAR_Y)));
  const v = Math.round(0x78 + t * (0x32 - 0x78));
  return (v << 16) | (v << 8) | v;
}

export class NPC extends Entity {
  static _nextId = 1;

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

    this.id = NPC._nextId++;   // 全局唯一稳定 id（供 debug overlay / 日志引用）

    this.renderer  = config.renderer;
    this.animation = config.animation || 'idle';
    this.direction = config.direction || 1;
    this.speed     = config.speed     || 0;
    this.vy        = config.vy !== undefined ? config.vy : (Math.random() * 2 - 1) * 18;
    this.scale     = config.scale     ?? 0.45;
    this.scaleMul  = config.scaleMul  ?? 1;   // 额外缩放系数（按所处带拉开远近差距）
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

    // 行为状态机字段（由 BehaviorManager 驱动；非托管 NPC 保持默认）
    this.npcType   = config.npcType ?? null;   // 自身属性（businessman/tourist...）
    this.state     = config.state   ?? null;   // 当前行为状态（walk/run/stand...）
    this.bond      = null;                      // 活跃社交关系（SocialBond）

    // Modifier 系统（替代旧的 overlay / overlayPose / persistentOverlay）
    this.traits    = config.traits ?? [];       // string[]，生成时赋值，之后不变
    this.modifiers = [];                        // Modifier[]，运行时管理
  }

  resolveJoints() {
    if (!this.modifiers.length) return null;
    const out = {};
    for (const m of [...this.modifiers].sort((a, b) => a.priority - b.priority)) {
      if (m.joints) Object.assign(out, m.joints);
    }
    return out;
  }

  _buildJointOverrides(frame) {
    if (!this.modifiers.length) return null;
    const sorted = [...this.modifiers].sort((a, b) => a.priority - b.priority);
    const deltas = {};
    const absolutes = {};
    for (const m of sorted) {
      if (!m.joints) continue;
      if (m.absolute) {
        Object.assign(absolutes, m.joints);
      } else {
        Object.assign(deltas, m.joints);
      }
    }
    const out = {};
    const bodyPos = frame['body'] ?? [0, 0];
    for (const [j, d] of Object.entries(deltas)) {
      out[j] = [bodyPos[0] + d[0], bodyPos[1] + d[1]];
    }
    for (const [j, v] of Object.entries(absolutes)) {
      out[j] = v;
    }
    return out;
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
   * 与 StickRenderer 的变换（anchorMode/canonicalDirection/overlay）保持一致。
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
    const ov = this._buildJointOverrides(frame);
    const coord = (j) => (ov && ov[j]) ? ov[j] : frame[j];
    const jp = coord(jn);
    if (!jp) return { x: this.x, y: this.y };
    const s = this.scale;
    const offsetY = isDog ? dogOffsetY(anim, coord, s) : humanOffsetY(anim, coord, s);
    const dir = this.direction * (anim.canonicalDirection || 1);
    const renderY = this._renderY();
    return {
      x: this.x + jp[0] * s * dir,
      y: renderY + jp[1] * s + offsetY,
    };
  }

  // ─── 动态标签（供取景框 → 新闻生成） ─────────────────────────────────────
  // = 自身属性 + 当前行为状态 + 叠加动作 + 空间关系 + 社交状态
  getTags() {
    const out = new Set();

    // 1) 自身属性（生成时写死的 tags + npcType）
    for (const t of this.tags) out.add(t);
    if (this.npcType) out.add(this.npcType);

    // 2) 当前行为状态（优先用状态机 state，否则按动画推断）
    const stateTag = STATE_TAGS[this.state] ?? ANIM_TAGS[this.animation];
    if (stateTag) out.add(stateTag);

    // 3) 修饰器（id 名 + 额外语义标签；跳过 _ 开头的系统内部修饰器）
    for (const m of this.modifiers) {
      if (m.id.startsWith('_')) continue;
      out.add(m.id);
      const extra = OVERLAY_EXTRA_TAGS[m.id];
      if (extra) out.add(extra);
    }

    // 4) 临时附加标签（随状态生灭，如躺椅时 resting/homeless）
    if (this._extraTags) for (const t of this._extraTags) out.add(t);

    // 5) 社交状态
    if (this.bond) out.add('talking');

    // 6) 空间关系（near:建筑类型 / near:道具）
    if (this.manager) this._addSpatialTags(out);

    return Array.from(out);
  }

  _addSpatialTags(out) {
    for (const e of this.manager.entities) {
      if (e === this || !e.alive || !e.visible) continue;
      // 建筑：x 落在占地范围内 → near:<类型>
      if (e.bWidth !== undefined) {
        if (this.x >= e.x - 10 && this.x <= e.x + e.bWidth + 10) {
          for (const t of e.tags) if (t !== 'building') out.add('near:' + t);
        }
      } else if (e.propType) {
        // 道具：近距离 → near:<道具主标签>
        if (Math.abs(e.x - this.x) < 36 && Math.abs(e.y - this.y) < 70) {
          const main = (e.tags && e.tags[0]) || e.propType;
          out.add('near:' + main);
        }
      }
    }
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
    // 漫游 NPC 的朝向/速度由 steerRoam 每帧决定，到边界只夹取位置、不翻转方向，
    // 否则会在区域边界与转向逻辑互相打架，出现原地左右乱闪。
    if (!this.leashTarget) {
      if (this.speed > 0) {
        this.x += this.direction * this.speed * (delta / 1000);
        if      (this.x > this.maxX) { this.x = this.maxX; if (!this.roam) this.direction = -1; }
        else if (this.x < this.minX) { this.x = this.minX; if (!this.roam) this.direction =  1; }
      }
      this.y += this.vy * (delta / 1000);
      if      (this.y > this.maxY) { this.y = this.maxY; this.vy = this.roam ? 0 : -Math.abs(this.vy); }
      else if (this.y < this.minY) { this.y = this.minY; this.vy = this.roam ? 0 :  Math.abs(this.vy); }
    }

    if (this.customUpdate) this.customUpdate(this, delta);
  }

  draw(g) {
    if (!this.alive || !this.visible) return;

    // 附加绘制（自行车、摩托、绳索）在骨架前。drawExtra 内可调用 this.getAnchor(...)
    // 围绕骑手/主人的真实锚点作画，从而实现精确对齐。
    if (this.drawExtra) this.drawExtra(g, this);

    const color = this.inViewfinder ? 0xcc2200 : npcDepthGray(this.y);
    const frame = this.renderer.getFrame(this.animation, this.frameIndex);
    const overrides = this.modifiers.length ? this._buildJointOverrides(frame) : null;

    this.renderer.draw(
      g, this.animation, this.frameIndex,
      this.x, this._renderY(), this.scale, this.direction,
      color, 1, overrides
    );

    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }
}
