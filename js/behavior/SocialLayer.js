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

const rand   = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

function kfJoints(kf) {
  const j = {};
  for (const k in kf) { if (k !== 'dur') j[k] = kf[k]; }
  return j;
}

const CHESS_WAIT_MS = 3500;

let SUB_EVENT_POSES = {};
let GESTURE_CLIPS   = {};
let STALL_GESTURES  = {};
let SUB_EVENTS      = {};

/**
 * ClipPlayer — 把一段 gesture clip（keyframes）驱动为 NPC 上的一个 held modifier。
 * 逐帧推进，播完停在末帧（done=true）。供 StallActivity 复用（摊主循环 / 买卖动作）。
 */
class ClipPlayer {
  constructor(npc, modId) {
    this.npc = npc; this.modId = modId;
    this.frames = []; this.idx = 0; this.timer = 0; this.done = true;
  }
  play(clip) {
    this.frames = (clip && clip.keyframes) ? clip.keyframes : [];
    this.idx    = 0;
    this.done   = this.frames.length === 0;
    this.timer  = this.frames[0] ? this.frames[0].dur : 0;
    if (this.frames[0]) this._apply(this.frames[0]);
  }
  update(dt) {
    if (this.done) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.idx + 1 >= this.frames.length) { this.done = true; return; }  // 停在末帧
      this.idx++;
      this.timer = this.frames[this.idx].dur;
      this._apply(this.frames[this.idx]);
    }
  }
  _apply(frame) {
    const joints = kfJoints(frame);
    const mod = this.npc.modifiers.find(m => m.id === this.modId);
    if (mod) mod.joints = joints;
    else this.npc.modifiers.push({ id: this.modId, kind: 'held', priority: 20, joints, timer: -1 });
  }
  clear() {
    this.npc.modifiers = this.npc.modifiers.filter(m => m.id !== this.modId);
  }
}

function _buildSubEvents() {
  SUB_EVENTS = {
    push: {
      aDelta: SUB_EVENT_POSES.push?.aDelta,
      bDelta: SUB_EVENT_POSES.push?.bDelta,
      reach: 0.4, hold: 0.2, release: 0.5,
      aTags: ['conflict'], bTags: ['conflict', 'victim'],
    },
    give_item: {
      aDelta: SUB_EVENT_POSES.give_item?.aDelta,
      bDelta: SUB_EVENT_POSES.give_item?.bDelta,
      reach: 0.5, holdRange: [1, 2], release: 0.5,
      aTags: ['transaction', 'exchange'], bTags: ['transaction', 'exchange'],
    },
    handshake: {
      aDelta: SUB_EVENT_POSES.handshake?.aDelta,
      bDelta: SUB_EVENT_POSES.handshake?.bDelta,
      reach: 0.5, hold: 1.5, release: 0.5,
      aTags: null, bTags: null,
    },
    point_at: {
      aDelta: SUB_EVENT_POSES.point_at?.aDelta,
      bDelta: SUB_EVENT_POSES.point_at?.bDelta,
      reach: 0.4, holdRange: [2, 3], release: 0.4,
      aTags: ['pointing', 'observing'], bTags: ['pointing', 'observing'],
    },
  };
}

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
    npc.animation  = 'stand';
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
      npc.modifiers.push({ id: '_talk_sub_event', kind: 'held', priority: 20, joints, timer: -1, absolute: true });
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
    this.table = props[0] || null;        // 棋桌（onlooker 槽宿主）
    this.join(this.a, 'player_a');
    this.join(this.b, 'player_b');
    for (const o of this.onlookers) this.join(o, 'onlooker');
    for (const p of props) this.occupy(p);
    if (this.table) this.table._chessActivity = this;

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

  // 后来的旁观者经 onlooker 槽到达后动态加入；停留 rand(15,40)s 后离开
  addOnlooker(npc, slot) {
    this.onlookers.push(npc);
    this.join(npc, 'onlooker');
    this._setupOnlooker(npc);
    npc._chessSlot     = slot || null;
    npc._onlookerTimer = 0;
    npc._onlookerDur   = rand(15, 40);
    if (this.table) npc.direction = (this.table.x >= npc.x) ? 1 : -1;
  }

  // 旁观者离开：移出列表、释放 onlooker 槽、归还 BaseStateMachine
  releaseOnlooker(npc) {
    const i = this.onlookers.indexOf(npc);
    if (i >= 0) this.onlookers.splice(i, 1);
    this.participants = this.participants.filter(p => p.npc !== npc);
    this.release(npc);
    if (npc._chessSlot) {
      npc._chessSlot.reserved = null;
      npc._chessSlot.ready    = false;
      npc._chessSlot.npc      = null;
      npc._chessSlot = null;
    }
    if (npc.alive) setState(npc, 'walk', 'onlooker-done');
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
    for (let i = this.onlookers.length - 1; i >= 0; i--) {
      const o = this.onlookers[i];
      if (!o.alive) {
        this.onlookers.splice(i, 1);
        this.participants = this.participants.filter(p => p.npc !== o);
        continue;
      }
      this._tickOnlooker(o, dt);
      o._onlookerTimer = (o._onlookerTimer || 0) + dt;
      if (o._onlookerDur != null && o._onlookerTimer >= o._onlookerDur) {
        this.releaseOnlooker(o);
      }
    }
    return true;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    // 释放 onlooker 槽预约，防泄漏（棋局极少销毁，但保险）
    for (const o of this.onlookers) {
      if (o._chessSlot) {
        o._chessSlot.reserved = null; o._chessSlot.ready = false; o._chessSlot.npc = null;
        o._chessSlot = null;
      }
    }
    if (this.table) this.table._chessActivity = null;
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
    // owner 或 dog 任一消失则结束活动（super.destroy 会释放双方 _activity，避免悬挂）
    if (!this.owner.alive || !this.dog.alive) return false;
    return true;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    if (this.owner.alive) setState(this.owner, 'walk', 'activity-end');
    super.destroy();
  }
}

// ─── UsePropActivity — 单人使用道具（自动贩卖机 / 垃圾桶），播放手势后离开 ──────
// 到位即触发（单槽），用 GESTURE_CLIPS 的关键帧驱动 _use_prop modifier，播完结束。
class UsePropActivity extends Activity {
  constructor(id, type, npc, prop, clipName, tag) {
    super(id, type);
    this.npc  = npc;
    this.prop = prop;
    this.join(npc, 'user');
    this.occupy(prop);

    const clip   = GESTURE_CLIPS[clipName];
    this.frames  = (clip && clip.keyframes) ? clip.keyframes : [];
    this.kfIdx   = 0;
    this.kfTimer = this.frames[0] ? this.frames[0].dur : 0;
    this._tag    = tag;

    // 站定面向道具，清非 trait modifier
    npc.state      = 'stand';
    npc.animation  = 'stand';
    npc.speed      = 0;
    npc.vy         = 0;
    npc.playOnce   = false;
    npc.animDone   = false;
    npc.frameIndex = 0;
    npc.frameTimer = 0;
    npc.modifiers  = npc.modifiers.filter(m => m.kind === 'trait');
    npc.direction  = (prop.x >= npc.x) ? 1 : -1;
    npc._extraTags = [tag];

    if (this.frames[0]) {
      npc.modifiers.push({ id: '_use_prop', kind: 'held', priority: 20,
        joints: kfJoints(this.frames[0]), timer: -1 });
    }
  }

  update(dt) {
    if (!this.npc.alive) return false;
    if (this.frames.length === 0) return false;   // 空 clip：立即结束
    this.kfTimer -= dt;
    if (this.kfTimer <= 0) {
      if (++this.kfIdx >= this.frames.length) return false;   // 播完
      const kf  = this.frames[this.kfIdx];
      this.kfTimer = kf.dur;
      let mod = this.npc.modifiers.find(m => m.id === '_use_prop');
      if (mod) mod.joints = kfJoints(kf);
      else this.npc.modifiers.push({ id: '_use_prop', kind: 'held', priority: 20,
        joints: kfJoints(kf), timer: -1 });
    }
    return true;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    if (this.npc.alive) {
      this.npc.modifiers = this.npc.modifiers.filter(m => m.id !== '_use_prop');
      this.npc._extraTags = null;
      setState(this.npc, 'walk', 'activity-end');
    }
    super.destroy();
  }
}

// ─── StallActivity — 摊主常驻经营 + 顾客偶尔光临 ────────────────────────────────
// 摊主到位即创建本活动（单人），循环 tidy/call；顾客经 buyer 槽到达后 addBuyer 加入，
// 完成 point → give/give_get 后离开，摊主回循环。摊主永不离场（seller 槽永久预约，
// destroy 时也不 setState walk）。
class StallActivity extends Activity {
  constructor(id, seller, prop) {
    super(id, 'stall');
    this.seller    = seller;
    this.prop      = prop;
    this.buyer     = null;
    this.buyerSlot = null;
    this.join(seller, 'seller');
    this.occupy(prop);
    prop._stallActivity = this;

    this._setupSeller(seller);
    this._sellerPlayer = new ClipPlayer(seller, '_stall');
    this._sellerSwitch = rand(4, 8);
    this._sellerTimer  = 0;
    this._pickSellerClip();

    this._giving           = false;
    this._sellerGivePlayer = null;
  }

  _setupSeller(npc) {
    npc.state = 'stand'; npc.animation = 'stand'; npc.speed = 0; npc.vy = 0;
    npc.playOnce = false; npc.animDone = false; npc.frameIndex = 0; npc.frameTimer = 0;
    npc.modifiers  = npc.modifiers.filter(m => m.kind === 'trait');
    npc._extraTags = ['vendor'];
  }

  _pickSellerClip() {
    this._sellerPlayer.play(STALL_GESTURES[chance(0.5) ? 'seller_tidy' : 'seller_call']);
  }

  // 顾客到达 buyer 槽：加入并开始 point 阶段
  addBuyer(npc, slot) {
    if (this.buyer) return false;
    this.buyer     = npc;
    this.buyerSlot = slot;
    this.join(npc, 'buyer');
    this._setupBuyer(npc);

    this._buyerPhase  = 'point';
    this._buyerTimer  = 0;
    this._buyerDur    = rand(2, 4);
    this._buyerPlayer = new ClipPlayer(npc, '_stall_buyer');
    this._buyerPlayer.play(STALL_GESTURES.buyer_point);
    npc._extraTags = ['transaction', 'shopping'];

    // 双方相向
    this.seller.direction = (npc.x >= this.seller.x) ? 1 : -1;
    npc.direction         = (this.seller.x >= npc.x) ? 1 : -1;
    return true;
  }

  _setupBuyer(npc) {
    npc.state = 'stand'; npc.animation = 'stand'; npc.speed = 0; npc.vy = 0;
    npc.playOnce = false; npc.animDone = false; npc.frameIndex = 0; npc.frameTimer = 0;
    npc.modifiers = npc.modifiers.filter(m => m.kind === 'trait');
  }

  update(dt) {
    if (!this.seller.alive) return false;   // 摊主消失（极少）→ 活动结束

    // 摊主循环（give 阶段暂停循环，改播 give，复用同一 '_stall' modifier）
    if (this._giving) {
      if (this._sellerGivePlayer) this._sellerGivePlayer.update(dt);
    } else {
      this._sellerPlayer.update(dt);
      this._sellerTimer += dt;
      if (this._sellerTimer >= this._sellerSwitch) {
        this._sellerTimer  = 0;
        this._sellerSwitch = rand(4, 8);
        this._pickSellerClip();
      }
    }

    if (this.buyer) this._tickBuyer(dt);
    return true;
  }

  _tickBuyer(dt) {
    if (!this.buyer.alive) { this._endBuyer(false); return; }
    this._buyerTimer += dt;

    if (this._buyerPhase === 'point') {
      this._buyerPlayer.update(dt);
      if (this._buyerTimer >= this._buyerDur) {
        // 进入 give：摊主 give 与顾客 give_get 同时开播（无需逐帧对齐）
        this._buyerPhase       = 'give';
        this._giving           = true;
        this._sellerGivePlayer = new ClipPlayer(this.seller, '_stall');
        this._sellerGivePlayer.play(STALL_GESTURES.seller_give);
        this._buyerPlayer.play(STALL_GESTURES.buyer_give_get);
      }
    } else if (this._buyerPhase === 'give') {
      this._buyerPlayer.update(dt);
      const sDone = !this._sellerGivePlayer || this._sellerGivePlayer.done;
      if (this._buyerPlayer.done && sDone) this._endBuyer(true);
    }
  }

  // 顾客离开：清动作、释放 buyer 槽、摊主回循环
  _endBuyer(walkAway) {
    const b = this.buyer;
    if (this._buyerPlayer)      this._buyerPlayer.clear();
    if (this._sellerGivePlayer) { this._sellerGivePlayer.clear(); this._sellerGivePlayer = null; }
    this._giving = false;

    if (this.buyerSlot) {
      this.buyerSlot.reserved = null;
      this.buyerSlot.ready    = false;
      this.buyerSlot.npc      = null;
    }
    if (b) {
      b._extraTags = null;
      this.release(b);
      this.participants = this.participants.filter(p => p.npc !== b);
      if (walkAway && b.alive) setState(b, 'walk', 'stall-done');
    }
    this.buyer     = null;
    this.buyerSlot = null;

    // 摊主恢复循环
    this._sellerTimer  = 0;
    this._sellerSwitch = rand(4, 8);
    this._pickSellerClip();
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    if (this._buyerPlayer)      this._buyerPlayer.clear();
    if (this._sellerGivePlayer) this._sellerGivePlayer.clear();
    if (this._sellerPlayer)     this._sellerPlayer.clear();
    if (this.buyer && this.buyer.alive) setState(this.buyer, 'walk', 'stall-interrupt');
    if (this.seller.alive) this.seller._extraTags = null;
    if (this.prop) this.prop._stallActivity = null;
    super.destroy();   // 注意：摊主由 super.destroy 解锁 _activity，但不主动 walk（留在原地）
  }
}

// ─── SocialLayer 管理器 ───────────────────────────────────────────────────────
export class SocialLayer {
  /** @param {EnvironmentQuery} envQuery @param {object} poseCache */
  constructor(envQuery, poseCache) {
    this.envQuery = envQuery;
    this.activities = [];
    this.talkScanTimer = 0;
    this._idSeq = 0;
    this.lastScanInfo = { standers: 0, paired: 0 };

    if (poseCache) {
      SUB_EVENT_POSES = poseCache.sub_event      || {};
      GESTURE_CLIPS   = poseCache.gesture        || {};
      STALL_GESTURES  = poseCache.stall_gestures || {};
      _buildSubEvents();
    }
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
        // 清理本 NPC 占用的槽位 ready 标记，防止下次到访时 allReady 误判
        for (const s of npc._slotWaitProp._slots) {
          if (s.npc === npc) { s.ready = false; s.npc = null; }
        }
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
    } else if (type === 'stall') {
      const seller = participants.find(p => p.role === 'seller')?.npc;
      if (seller) act = new StallActivity(id, seller, props[0]);
    } else {
      const prop = props[0];
      const gestureId  = prop?.smartDef?.gestureId  ?? type;
      const phaseLabel = prop?.smartDef?.phaseLabel ?? type;
      if (prop?.smartDef) {
        act = new UsePropActivity(id, type, participants[0].npc, prop, gestureId, phaseLabel);
      }
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

  /** Smart Object 槽位到达：按 activityType 分派（摊位/棋局加入既有活动；其余凑齐即创建） */
  onSlotArrival(npc, prop, slot) {
    slot.ready = true;
    slot.npc   = npc;
    const type = prop.smartDef.activityType;

    // 摊位：摊主到位创建活动（seller 槽永久预约，不清）；顾客加入已有活动
    if (type === 'stall') {
      if (slot.role === 'seller') {
        this.createActivity('stall', [{ npc, role: 'seller' }], [prop]);
      } else {
        const act = prop._stallActivity;
        if (act && act.alive && !act.buyer) act.addBuyer(npc, slot);
        else this._abandonSlot(npc, slot, 'stall_no_seller');
      }
      return;
    }

    // 棋局：旁观者加入已在进行的对局
    if (type === 'chess') {
      const act = prop._chessActivity;
      if (act && act.alive && act.addOnlooker) act.addOnlooker(npc, slot);
      else this._abandonSlot(npc, slot, 'chess_no_game');
      return;
    }

    // 默认（单/多槽，如自动贩卖机/垃圾桶）：凑齐所有槽位即创建 Activity，否则原地站等
    const allReady = prop._slots.every(s => s.ready);
    if (allReady) {
      const participants = prop._slots.map(s => ({ npc: s.npc, role: s.role }));
      this.createActivity(type, participants, [prop]);
      for (const s of prop._slots) { s.reserved = null; s.ready = false; s.npc = null; }
    } else {
      setState(npc, 'stand', 'slot_wait');
      npc.stateDur       = Infinity;   // 压制正常 stand 超时，等凑齐或 20s 放弃
      npc._slotWaitTimer = 0;
      npc._slotWaitProp  = prop;
    }
  }

  // 放弃一个已到达但无法加入的槽位（清预约 + 重新行走）
  _abandonSlot(npc, slot, reason) {
    slot.reserved = null;
    slot.ready    = false;
    slot.npc      = null;
    setState(npc, 'walk', reason);
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
