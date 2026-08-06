/**
 * NPC — 继承 Entity 的动态人物实体
 * 渲染委托给构造时注入的 StickRenderer。
 * 支持：playOnce 单次播放、leashTarget 绑带跟随、drawExtra 附加绘制、customUpdate 回调。
 *
 * CONTRACT
 *   Npc.update() 帧内执行顺序（代码顺序，非 Motor 托管 NPC 与托管 NPC 均遵守）：
 *     1. leash 同步：if leashTarget && !_motorInstalled → 直接覆写 x/y/direction
 *     2. 动画帧推进：cycle 且 groundTravel 有效的 clip → 距离驱动（L-2，见下）；
 *                 其余 clip → frameTimer += delta；playOnce animDone 检测；frameIndex 步进
 *     3. 物理积分：_motorInstalled → integratePhysics(this, delta)；
 *                 否则（无 leash）→ 内联 direction×speed / vy 积分
 *     4. customUpdate 回调（最后执行，可读取已更新的 x/y/direction）
 *   WRITES:   x, y, direction（leash 路径）；frameIndex, animDone（动画路径）；
 *             phase, phaseAnchorX/Y（距离驱动相位，L-2，Npc 自记，不向 Motor/
 *             BehaviorManager 取，避免与帧内执行顺序耦合）
 *   MUST NOT: 在 customUpdate 中再次积分位置（步骤 3 已完成）
 */

import { Entity } from '../core/Entity.js';
import { depthGray, BUILDING_BASE_Y } from '../core/Layout.js';
import { integratePhysics } from '../behavior/Motor.js';
import { clipLibrary } from '../core/ClipLibrary.js';
import { getNavGrid, ZONE } from '../behavior/nav/NavGrid.js';
import { getProfile } from './NpcProfile.js';

// 全局 NPC 视觉缩放（art-direction）：foot NPC 渲染到原尺寸的 60%（缩小 40%）。
// EntityManager 每帧把它乘进 npc.scale，因而所有「骨架单位 × npc.scale」的量——
// 渲染尺寸、移动速度（speed = speedK × walkSpeed × scale）、分离半径、到达阈值、
// facing 死区——全部按同比例缩小；**步频不变**（距离驱动相位按
// 位移 / (groundTravel × scale) 推进，与 scale 无关，故只是步幅变小、走得变慢）。
// 骑手（CyclistSpawner）显式覆写 renderScale=1，让自行车/电动车保持原尺寸。
export const NPC_SCALE = 0.6;

// 行为状态 → 标签
const STATE_TAGS = {
  walk: 'walking', run: 'running', stand: 'standing',
  sit_bench: 'sitting', lie_ground: 'lying', fall: 'falling', talk: 'talking',
  // 批次 1 新增状态
  lean_wall: 'leaning', squat: 'squatting', sit_ground: 'sitting',
  lie_bench: 'lying', get_up: 'getting_up',
  loiter: 'loitering',
};
// overlay → 额外语义标签（overlay 名本身也会作为标签加入）
const OVERLAY_EXTRA_TAGS = {
  smoke: 'smoking', hold_bag: 'carrying',
};
// 无状态机托管时按动画名推断标签（chess/cycle/dance 等专用场景）
const ANIM_TAGS = {
  walk: 'walking', run: 'running', jog: 'jogging', bike: 'cycling',
  mobile: 'riding', idle: 'standing', stand: 'standing', chess: 'sitting',
  sit_bench: 'sitting', lie_ground: 'lying', fall: 'falling',
};


// ─── L-2: 距离驱动相位 → frameIndex 查表 ────────────────────────────────────
// anim.frameCumFrac[i] = 该帧开始前占循环的累积占比（ClipLibrary#_buildFrameCumFrac，
// 均匀 dur 时退化为 i/frameCount）。取满足 cumFrac[i] <= phase 的最后一个 i。
function _frameFromPhase(anim, phase) {
  const table = anim.frameCumFrac;
  let idx = 0;
  for (let i = 0; i < table.length; i++) {
    if (table[i] <= phase) idx = i; else break;
  }
  return idx;
}

export class NPC extends Entity {
  static _nextId = 1;

  /**
   * @param {object}        config
   * @param {StickRenderer} config.renderer      - 火柴人渲染器（必须）
   * @param {string}        config.animation     - 动画名称
   * @param {number}        config.direction     - 1=右，-1=左
   * @param {number}        config.speed         - 水平速度（像素/秒）
   * @param {number}        config.scale         - 初始缩放（EntityManager每帧会按Y覆盖）
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
    this.animation = config.animation || 'stand';
    this.direction = config.direction || 1;
    this.speed     = config.speed     || 0;
    this.scale     = config.scale     ?? 0.45;

    this.frameIndex = 0;
    this.frameTimer = 0;

    // 距离驱动相位（L-2）：cycle 且 groundTravel 有效的 clip 用，其余 clip 不消费。
    // phase 是 [0,1) 循环内位置；phaseAnchorX/Y 是上次推进时的位置，用来算本帧
    // 实际位移模长——Npc 自己维护，不向 Motor/BehaviorManager 取。
    this.phase        = 0;
    this.phaseAnchorX = this.x;
    this.phaseAnchorY = this.y;

    this.minX = config.minX ?? -100;
    this.maxX = config.maxX ?? 2100;
    this.minY = config.minY ?? BUILDING_BASE_Y;
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

    // 骨架体型（R-1）：默认取当前动画 clip 自带的 skeleton 名（human/dog），
    // profile.skeleton 声明时优先覆盖（如 child 复用 human clip 但按小体型渲染）。
    // skeletonScale 是 skeleton.json 对应条目的 scale，EntityManager 每帧乘进 npc.scale；
    // skeletonName 传给 StickRenderer 作 headRadius 查表键。
    const profile = this.npcType ? getProfile(this.npcType) : null;
    const initialAnim = this.renderer?.getAnimation(this.animation);
    this.skeletonName  = profile?.skeleton ?? initialAnim?.skeleton ?? 'human';
    this.skeletonScale = clipLibrary.skeletons?.[this.skeletonName]?.scale ?? 1;

    // 全局 NPC 缩放（见 NPC_SCALE）。骑手在 CyclistSpawner 覆写为 1，保持车辆原尺寸。
    this.renderScale = NPC_SCALE;

    // Modifier 系统（替代旧的 overlay / overlayPose / persistentOverlay）
    this.traits    = config.traits ?? [];       // string[]，生成时赋值，之后不变
    this.modifiers = [];                        // Modifier[]，运行时管理
  }

  mem(ns)      { return (this._mem ??= {})[ns] ??= {}; }
  clearMem(ns) { if (this._mem) delete this._mem[ns]; }

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
    const merged = {};
    for (const m of sorted) {
      if (m.joints) Object.assign(merged, m.joints);
    }
    if (!Object.keys(merged).length) return null;

    // Re-anchor overlay deltas (recorded against defaultPose) to the current frame's
    // chain root, so arms/legs stay attached when the torso moves (sit, squat, walk…).
    const dp = clipLibrary.skeletons?.human?.defaultPose ?? {};
    const dpNeck = dp.neck ?? [0, -119];
    const dpBody = dp.body ?? [0, -69];
    const frameNeck = frame.neck ?? dpNeck;
    const frameBody = frame.body ?? dpBody;

    // joints whose chain root passes through neck (arms, head)
    const NECK_ANCHORED = new Set(['l_elbow', 'r_elbow', 'l_hand', 'r_hand', 'head']);
    // joints whose chain root passes through body (legs, neck)
    const BODY_ANCHORED = new Set(['neck', 'l_knee', 'r_knee', 'l_foot', 'r_foot']);

    const out = {};
    for (const [j, v] of Object.entries(merged)) {
      if (NECK_ANCHORED.has(j)) {
        const dpAnchor = dpNeck;
        const frameAnchor = frameNeck;
        out[j] = [frameAnchor[0] + (v[0] - dpAnchor[0]), frameAnchor[1] + (v[1] - dpAnchor[1])];
      } else if (BODY_ANCHORED.has(j)) {
        const dpAnchor = dpBody;
        const frameAnchor = frameBody;
        out[j] = [frameAnchor[0] + (v[0] - dpAnchor[0]), frameAnchor[1] + (v[1] - dpAnchor[1])];
      } else {
        out[j] = v;
      }
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
    return this.y;
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
    const dir = this.direction * (anim.canonicalDirection || 1);
    return {
      x: this.x + jp[0] * s * dir,
      y: this.y + jp[1] * s,
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

    // 4) 命名空间临时标签（各 owner 写入自己 ns 的 .tags，随 clearMem 自动回收）
    if (this._mem) for (const ns of Object.values(this._mem)) if (ns.tags) for (const t of ns.tags) out.add(t);

    // 5) 社交状态
    if (this.bond) out.add('talking');

    // 6) 空间道路标签（crossing / jaywalking — N-2b: 从 NavGrid zone 空间派生，取代 planCrossing 标签生命周期）
    if (this._motorInstalled) {
      const grid = getNavGrid();
      if (grid) {
        const { gx, gy } = grid.worldToCell(this.x, this.y);
        if (grid.zone(gx, gy) === ZONE.ROAD) {
          out.add('crossing');
          if (this.mem('motor').goal?.meta?.jaywalk) out.add('jaywalking');
        }
      }
    }

    // 7) 空间关系（near:建筑类型 / near:道具）
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

    // 绑带：同步到主人位置（非 Motor 托管 NPC）
    if (this.leashTarget && !this._motorInstalled) {
      this.x = this.leashTarget.x + this.leashOffset.x * this.leashTarget.direction;
      this.y = this.leashTarget.y + this.leashOffset.y;
      this.direction = this.leashTarget.direction;
    }

    // 动画帧推进
    const anim = this.renderer.getAnimation(this.animation);
    if (anim && !this.animDone) {
      if (anim.kind === 'cycle' && anim.groundTravel) {
        // L-2：距离驱动相位——cycle 且 groundTravel 有效的 clip，相位由「自上次推进
        // 以来的实际位移模长 / (groundTravel × npc.scale)」推进，与 fps/delta 无关。
        // Npc 自己记 phaseAnchorX/Y，不向 Motor/BehaviorManager 取（避免和帧内执行
        // 顺序耦合，见 movement-dataflow.md）。phase 是 [0,1) 循环内位置，跨 clip 切换
        // 不清零（连续的步频概念）；映射到 frameIndex 用 anim.frameCumFrac 累积时间表
        // （非均匀 dur 时按各帧占循环的真实比例取帧，均匀 dur 退化为等分）。
        const dist       = Math.hypot(this.x - this.phaseAnchorX, this.y - this.phaseAnchorY);
        const travelUnit = anim.groundTravel * this.scale;
        if (dist > 0 && travelUnit > 0) {
          this.phase = (this.phase + dist / travelUnit) % 1;
          this.frameIndex = _frameFromPhase(anim, this.phase);
        }
      } else {
        // 时间驱动路径（非 cycle，或 cycle 但 groundTravel 无效）——不变
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
    }
    this.phaseAnchorX = this.x;
    this.phaseAnchorY = this.y;

    // 物理积分：全部 NPC 经 Motor.integratePhysics；未注册 NPC（仅 leash 狗）原地保持
    if (this._motorInstalled) {
      integratePhysics(this, delta);
    }

    if (this.customUpdate) this.customUpdate(this, delta);
  }

  draw(g) {
    if (!this.alive || !this.visible) return;

    // 附加绘制（自行车、摩托、绳索）在骨架前。drawExtra 内可调用 this.getAnchor(...)
    // 围绕骑手/主人的真实锚点作画，从而实现精确对齐。
    if (this.drawExtra) this.drawExtra(g, this);

    const color = depthGray(this.y, { light: 0x78, dark: 0x32 });
    const frame = this.renderer.getFrame(this.animation, this.frameIndex);
    const overrides = this.modifiers.length ? this._buildJointOverrides(frame) : null;

    this.renderer.draw(
      g, this.animation, this.frameIndex,
      this.x, this._renderY(), this.scale, this.direction,
      color, 1, overrides, this.skeletonName
    );
  }
}
