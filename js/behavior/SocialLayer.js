/**
 * SocialLayer — 社交 / Activity 统一模型
 *
 * Activity 是多个 NPC（+道具）共同参与的高层行为单元（对话/下棋/遛狗…）。
 * 加入 Activity 的 NPC 被"锁定"（npc._activity 置位），BehaviorManager 跳过其
 * 基础状态机，由 Activity 全权驱动；释放后归还给 BaseStateMachine。
 *
 * 本次复刻重构前的：两人靠近自动对话、棋手轮流落子、遛狗者带狗。
 */

import { setState }       from './BaseStateMachine.js';
import { dlog }           from './DebugLog.js';
import { SUB_EVENT_POSES } from './PoseRegistry.js';

const rand   = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

const CHESS_WAIT_MS = 3500;

// ─── TalkActivity 子事件配置 ──────────────────────────────────────────────────
// deltaPose 数据来自 PoseRegistry.js（单一来源，anim-preview 工具可实时编辑）
// 参考帧（single.json F0）：r_hand[-10,-18] l_hand[9,-19] r_elbow[14,-11] l_elbow[-14,-11]
const SUB_EVENTS = {
  push: {
    aDelta: SUB_EVENT_POSES.push.aDelta,
    bDelta: SUB_EVENT_POSES.push.bDelta,
    reach: 0.4, hold: 0.2, release: 0.5,
    aTags: ['conflict'], bTags: ['conflict', 'victim'],
  },
  give_item: {
    aDelta: SUB_EVENT_POSES.give_item.aDelta,
    bDelta: SUB_EVENT_POSES.give_item.bDelta,
    reach: 0.5, holdRange: [1, 2], release: 0.5,
    aTags: ['transaction', 'exchange'], bTags: ['transaction', 'exchange'],
  },
  handshake: {
    aDelta: SUB_EVENT_POSES.handshake.aDelta,
    bDelta: SUB_EVENT_POSES.handshake.bDelta,
    reach: 0.5, hold: 1.5, release: 0.5,
    aTags: null, bTags: null,
  },
  point_at: {
    aDelta: SUB_EVENT_POSES.point_at.aDelta,
    bDelta: SUB_EVENT_POSES.point_at.bDelta,
    reach: 0.4, holdRange: [2, 3], release: 0.4,
    aTags: ['pointing', 'observing'], bTags: ['pointing', 'observing'],
  },
};

// ─── Activity 基类 ────────────────────────────────────────────────────────────
class Activity {
  constructor(id, type) {
    this.id = id;
    this.type = type;
    this.participants = [];   // [{ npc, role }]
    this.occupiedProps = [];  // 占用的道具实体
    this.timer = 0;
    this.subState = 'init';
    this.alive = true;
    this._endReason = 'natural';
  }

  // 可读标签：如 chess#3
  get label() { return `${this.type}#${this.id}`; }

  // 查某 NPC 在本 Activity 里的角色
  roleOf(npc) {
    const p = this.participants.find(p => p.npc === npc);
    return p ? p.role : null;
  }

  // 加入参与者：锁定 NPC，阻止 BaseStateMachine 接管
  join(npc, role) {
    this.participants.push({ npc, role });
    npc._activity = this;
  }

  // 释放单个参与者
  release(npc) {
    npc._activity = null;
  }

  // 占用道具
  occupy(prop) {
    if (!prop) return;
    prop._occupiedBy = this.id;
    this.occupiedProps.push(prop);
  }

  // 每帧更新（子类覆盖）；返回 false 表示 Activity 结束
  update(dt) { return this.alive; }

  // 被外部打断（如掀棋盘）；子类可扩展
  interrupt(reason) { this._endReason = reason || 'interrupt'; this.alive = false; }

  // 清理：释放所有参与者 + 道具
  destroy() {
    for (const { npc } of this.participants) this.release(npc);
    for (const prop of this.occupiedProps) prop._occupiedBy = null;
    this.participants = [];
    this.occupiedProps = [];
  }
}

// ─── TalkActivity — 两人面对面对话，计时结束后按概率触发子事件 ───────────────────
class TalkActivity extends Activity {
  constructor(id, a, b) {
    super(id, 'talk');
    this.a = a;
    this.b = b;
    this.duration = rand(8, 18);
    this.subState = 'talking';
    this.join(a, 'speaker');
    this.join(b, 'speaker');
    // 兼容：NPC.getTags() 检查 npc.bond → 'talking'
    a.bond = this;
    b.bond = this;
    this._enterTalk(a);
    this._enterTalk(b);
    this._faceEachOther();

    // 子事件状态
    this._subEvent      = null;   // 'push'|'give_item'|'handshake'|'point_at'|null
    this._subPhase      = null;   // 'reach'|'hold'|'release'
    this._subTimer      = 0;
    this._aBase         = null;   // A 的基准帧关节坐标快照
    this._bBase         = null;   // B 的基准帧关节坐标快照
    this._holdDur       = 0;
    this._pushBReleased = false;  // push 子事件 B 已释放去 fall 链路
  }

  _enterTalk(npc) {
    npc.state      = 'talk';
    npc.stateTimer = 0;
    npc.animation  = 'single';
    npc.speed      = 0;
    npc.playOnce   = false;
    npc.animDone   = false;
    npc.frameIndex = 0;
    npc.frameTimer = 0;
    npc.modifiers  = npc.modifiers.filter(m => m.kind === 'trait');
  }

  _faceEachOther() {
    const { a, b } = this;
    a.direction = (b.x >= a.x) ? 1 : -1;
    b.direction = (a.x >= b.x) ? 1 : -1;
  }

  update(dt) {
    if (!this.a.alive || !this.b.alive) return false;
    this.timer += dt;

    if (this.subState === 'talking') {
      this._faceEachOther();
      if (this.timer >= this.duration) {
        const type = this._selectSubEvent();
        if (type) {
          this._startSubEvent(type);
          return this._subEvent !== null;  // 启动失败则自然结束
        }
        return false;  // 自然结束
      }
      return true;
    }

    return this._tickSubEvent(dt);
  }

  // 按 A 的 profile socialWeights 随机选子事件；返回类型字符串或 null
  _selectSubEvent() {
    const w = (this.a._profile && this.a._profile.socialWeights) || {};
    const candidates = [
      ['push',      w.push      ?? 0.04],
      ['give_item', w.give_item ?? 0.05],
      ['handshake', w.handshake ?? 0.06],
      ['point_at',  w.point_at  ?? 0.05],
    ];
    for (const [type, p] of candidates) {
      if (chance(p)) return type;
    }
    return null;
  }

  // 初始化子事件：捕获基准帧、设置计时和标签
  _startSubEvent(type) {
    const cfg = SUB_EVENTS[type];
    if (!cfg) return;

    this._subEvent      = type;
    this._subPhase      = 'reach';
    this._subTimer      = 0;
    this._pushBReleased = false;

    this._aBase = cfg.aDelta ? this._captureBasePose(this.a, Object.keys(cfg.aDelta)) : {};
    this._bBase = cfg.bDelta ? this._captureBasePose(this.b, Object.keys(cfg.bDelta)) : {};

    this._holdDur = cfg.holdRange
      ? rand(cfg.holdRange[0], cfg.holdRange[1])
      : (cfg.hold ?? 1.0);

    // 设置临时标签
    let aTags = cfg.aTags ? [...cfg.aTags] : [];
    let bTags = cfg.bTags ? [...cfg.bTags] : [];
    if (type === 'handshake') {
      const tag = chance(0.5) ? 'greeting' : 'agreement';
      aTags = [tag];
      bTags = [tag];
    }
    this.a._extraTags = aTags.length > 0 ? aTags : null;
    this.b._extraTags = bTags.length > 0 ? bTags : null;

    this.subState = type;
    dlog(`[Activity ${this.label}] sub-event: ${type}`);
  }

  // 每帧推进子事件（reach → hold → release → 结束）；返回 false = 销毁活动
  _tickSubEvent(dt) {
    const cfg = SUB_EVENTS[this._subEvent];
    if (!cfg) return false;
    this._subTimer += dt;

    if (this._subPhase === 'reach') {
      const t = Math.min(1, this._subTimer / cfg.reach);
      this._applyLerpPose(this.a, this._aBase, cfg.aDelta, t);
      if (!this._pushBReleased) this._applyLerpPose(this.b, this._bBase, cfg.bDelta, t);

      if (this._subTimer >= cfg.reach) {
        this._subPhase = 'hold';
        this._subTimer = 0;

        // push 到达 hold 时：释放 B 进入 fall 链路
        if (this._subEvent === 'push' && !this._pushBReleased) {
          this._pushBReleased = true;
          this.release(this.b);
          this.b.bond = null;
          this.participants = this.participants.filter(p => p.npc !== this.b);
          setState(this.b, 'fall', 'push');
          // setState 会清空 _extraTags，重设以便取景框捕获
          this.b._extraTags = ['conflict', 'victim'];
        }
      }
    } else if (this._subPhase === 'hold') {
      if (this._subTimer >= this._holdDur) {
        this._subPhase = 'release';
        this._subTimer = 0;
      }
    } else if (this._subPhase === 'release') {
      const t = Math.max(0, 1 - this._subTimer / cfg.release);
      this._applyLerpPose(this.a, this._aBase, cfg.aDelta, t);
      if (!this._pushBReleased) this._applyLerpPose(this.b, this._bBase, cfg.bDelta, t);

      if (this._subTimer >= cfg.release) {
        this.a.modifiers = this.a.modifiers.filter(m => m.id !== '_talk_sub_event');
        if (!this._pushBReleased) this.b.modifiers = this.b.modifiers.filter(m => m.id !== '_talk_sub_event');
        return false;  // 子事件完成，触发 destroy
      }
    }

    return true;
  }

  // 从 NPC 当前动画帧快照指定关节的局部坐标
  _captureBasePose(npc, joints) {
    const anim  = npc.renderer ? npc.renderer.getAnimation(npc.animation) : null;
    const base  = {};
    if (anim) {
      const frame = anim.frames[npc.frameIndex % anim.frameCount];
      for (const j of joints) base[j] = frame[j] ? [...frame[j]] : [0, 0];
    }
    return base;
  }

  // 将 basePose + deltaPose*t 写入 _talk_sub_event modifier
  _applyLerpPose(npc, basePose, deltaPose, t) {
    if (!deltaPose) return;
    const joints = {};
    for (const [j, delta] of Object.entries(deltaPose)) {
      const base = basePose[j] || [0, 0];
      joints[j] = [base[0] + delta[0] * t, base[1] + delta[1] * t];
    }
    let mod = npc.modifiers.find(m => m.id === '_talk_sub_event');
    if (!mod) {
      npc.modifiers.push({ id: '_talk_sub_event', kind: 'held', priority: 20, joints, timer: -1 });
    } else {
      mod.joints = joints;
    }
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    // 清理子事件 modifier（push 时 B 已被释放，B 无此 modifier，filter 无害）
    if (this.a.alive) this.a.modifiers = this.a.modifiers.filter(m => m.id !== '_talk_sub_event');
    if (!this._pushBReleased && this.b.alive) this.b.modifiers = this.b.modifiers.filter(m => m.id !== '_talk_sub_event');

    for (const { npc } of this.participants) {
      npc.bond = null;
      if (npc.alive) setState(npc, 'walk', 'activity-end');
    }
    super.destroy();
  }
}

// ─── ChessActivity — 两棋手轮流落子 + 旁观者（替代 Chess.js 的 customUpdate） ───
function startPlay(npc) {
  npc.playOnce   = true;
  npc.animDone   = false;
  npc.frameIndex = 0;
  npc.frameTimer = 0;
}
function freezeAt0(npc) {
  npc.animDone   = true;
  npc.frameIndex = 0;
}

class ChessActivity extends Activity {
  constructor(id, players, onlookers, props) {
    super(id, 'chess');
    this.a = players[0];
    this.b = players[1];
    this.onlookers = onlookers || [];
    this.join(this.a, 'player_a');
    this.join(this.b, 'player_b');
    for (const o of this.onlookers) this.join(o, 'onlooker');
    for (const p of props) this.occupy(p);

    this.subState = 'playing';
    this.active   = 'A';
    this.waiting  = false;
    this.waitMs   = 0;

    this._setupPlayer(this.a);
    this._setupPlayer(this.b);
    for (const o of this.onlookers) this._setupOnlooker(o);

    startPlay(this.a);
    freezeAt0(this.b);
  }

  // 棋手坐姿：state 置 null → getTags 走 ANIM_TAGS['chess']='sitting'，与重构前一致
  _setupPlayer(npc) {
    npc.state      = null;
    npc.animation  = 'chess';
    npc.speed      = 0;
    npc.vy         = 0;
    npc.playOnce   = true;
  }

  // 旁观者：播放 chess_onlookers 倾身动画后定格（移动逻辑后续扩展）
  _setupOnlooker(npc) {
    npc.state      = null;
    npc.animation  = 'chess_onlookers';
    npc.speed      = 0;
    npc.vy         = 0;
    npc.playOnce   = true;
    npc.animDone   = false;
    npc.frameIndex = 0;
    npc.frameTimer = 0;
  }

  // 旁观者保持倾身观棋姿势，暂不移动
  _tickOnlooker(npc, dt) {
    // 动画播完后冻结首帧
    if (npc.animDone) {
      npc.animDone   = false;
      npc.playOnce   = true;
      npc.frameIndex = 0;
    }
  }

  update(dt) {
    if (!this.a.alive || !this.b.alive) return false;
    const cur = this.active === 'A' ? this.a : this.b;
    // 当前方动画播完 → 冻结于首帧并进入等待
    if (!this.waiting && cur.animDone) {
      cur.frameIndex = 0;
      this.waiting = true;
      this.waitMs  = 0;
    }
    if (this.waiting) {
      this.waitMs += dt * 1000;
      if (this.waitMs >= CHESS_WAIT_MS) {
        this.waiting = false;
        this.active  = this.active === 'A' ? 'B' : 'A';
        const next = this.active === 'A' ? this.a : this.b;
        const prev = this.active === 'A' ? this.b : this.a;
        startPlay(next);
        freezeAt0(prev);
      }
    }
    for (const o of this.onlookers) {
      if (o.alive) this._tickOnlooker(o, dt);
    }
    return true;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    for (const { npc } of this.participants) {
      if (npc.alive) setState(npc, 'walk', 'activity-end');
    }
    super.destroy();
  }
}

// ─── DogWalkActivity — 遛狗者带狗（包装 leash 绑带逻辑） ──────────────────────
class DogWalkActivity extends Activity {
  constructor(id, owner, dog) {
    super(id, 'dog_walk');
    this.owner = owner;
    this.dog   = dog;
    this.subState = 'walking';
    this.join(owner, 'owner');
    this.join(dog, 'dog');
    // owner 保持走路（速度由 register→setState('walk') 设定，NPC.update 推进与折返）
    owner.state     = 'walk';
    owner.animation = 'walk';
    // dog 通过 leashTarget 在 NPC.update 中跟随，drawExtra 画绳，无需此处驱动
  }

  update(dt) {
    if (!this.owner.alive) return false;
    return true;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    if (this.owner.alive) setState(this.owner, 'walk', 'activity-end');
    super.destroy();
  }
}

// ─── SocialLayer 管理器 ───────────────────────────────────────────────────────
export class SocialLayer {
  /** @param {EnvironmentQuery} envQuery */
  constructor(envQuery) {
    this.envQuery = envQuery;
    this.activities = [];
    this.talkScanTimer = 0;
    this._idSeq = 0;
    this.lastScanInfo = { standers: 0, paired: 0 };   // 供 debug 面板展示
  }

  update(npcs, dt) {
    // 1) tick 所有活跃 Activity；结束的 destroy
    for (let i = this.activities.length - 1; i >= 0; i--) {
      const act = this.activities[i];
      const alive = act.alive && act.update(dt);
      if (!alive) {
        dlog(`[Activity ${act.label}] destroyed(reason=${act._endReason})`);
        act.destroy();
        this.activities.splice(i, 1);
      }
    }

    // 2) 周期性尝试配对新的 TalkActivity
    this.talkScanTimer += dt;
    if (this.talkScanTimer >= 0.8) {
      this.talkScanTimer = 0;
      this._tryPairTalk(npcs);
    }

    // 3) 槽位等待超时（20s 内无第二个人到位） → 放弃，重新 walk
    for (const npc of npcs) {
      if (!npc.alive || npc._activity || !npc._slotWaitProp) continue;
      npc._slotWaitTimer = (npc._slotWaitTimer || 0) + dt;
      if (npc._slotWaitTimer > 20) {
        this.envQuery.releaseSlotReservation(npc);
        npc._slotWaitProp = null;
        setState(npc, 'walk', 'slot_wait_timeout');
      }
    }
  }

  // 外部触发：创建指定类型的 Activity
  createActivity(type, participants, props = []) {
    const id = ++this._idSeq;
    let act = null;
    if (type === 'talk') {
      act = new TalkActivity(id, participants[0].npc, participants[1].npc);
    } else if (type === 'chess') {
      const players   = participants.filter(p => p.role.startsWith('player')).map(p => p.npc);
      const onlookers = participants.filter(p => p.role === 'onlooker').map(p => p.npc);
      act = new ChessActivity(id, players, onlookers, props);
    } else if (type === 'dog_walk') {
      const owner = participants.find(p => p.role === 'owner').npc;
      const dog   = participants.find(p => p.role === 'dog').npc;
      act = new DogWalkActivity(id, owner, dog);
    }
    if (act) {
      this.activities.push(act);
      dlog(`[Activity ${act.label}] created`);
    }
    return act;
  }

  // 外部触发：打断某个 Activity
  interruptActivity(activityId, reason) {
    const act = this.activities.find(a => a.id === activityId);
    if (act) act.interrupt(reason);
  }

  /** Smart Object 槽位到达：凑齐所有槽位即创建 Activity，否则原地站等 */
  onSlotArrival(npc, prop, slot) {
    slot.ready = true;
    slot.npc   = npc;

    const allReady = prop._slots.every(s => s.ready);
    if (allReady) {
      const participants = prop._slots.map(s => ({ npc: s.npc, role: s.role }));
      this.createActivity(prop.smartDef.activityType, participants, [prop]);
      for (const s of prop._slots) { s.reserved = null; s.ready = false; s.npc = null; }
    } else {
      setState(npc, 'stand', 'slot_wait');
      npc.stateDur       = Infinity;   // 压制正常 stand 超时，等凑齐或 20s 放弃
      npc._slotWaitTimer = 0;
      npc._slotWaitProp  = prop;
    }
  }

  // 扫描可配对的两名 stand 自由行人 → 随机生成 talk
  _tryPairTalk(npcs) {
    const standers = npcs.filter(n =>
      n.alive && !n._activity && !n._departing && n.state === 'stand' &&
      n._profile && n._profile.activities.includes('talk'));
    let paired = 0;
    for (let i = 0; i < standers.length; i++) {
      for (let j = i + 1; j < standers.length; j++) {
        const a = standers[i], b = standers[j];
        if (a._activity || b._activity) continue;
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        if (dx < 70 && dx > 14 && dy < 24 && chance(0.5)) {
          this.createActivity('talk', [{ npc: a, role: 'speaker' }, { npc: b, role: 'speaker' }]);
          paired++;
        }
      }
    }
    this.lastScanInfo = { standers: standers.length, paired };
  }
}
