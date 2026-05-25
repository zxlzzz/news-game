/**
 * SocialLayer — 社交 / Activity 统一模型
 *
 * Activity 是多个 NPC（+道具）共同参与的高层行为单元（对话/下棋/遛狗…）。
 * 加入 Activity 的 NPC 被"锁定"（npc._activity 置位），BehaviorManager 跳过其
 * 基础状态机，由 Activity 全权驱动；释放后归还给 BaseStateMachine。
 *
 * 本次复刻重构前的：两人靠近自动对话、棋手轮流落子、遛狗者带狗。
 */

import { setState } from './BaseStateMachine.js';
import { dlog }     from './DebugLog.js';

const rand   = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

const CHESS_WAIT_MS = 3500;

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

// ─── TalkActivity — 两人面对面对话（替代 SocialBond） ─────────────────────────
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
    npc.overlay    = null;
  }

  _faceEachOther() {
    const { a, b } = this;
    a.direction = (b.x >= a.x) ? 1 : -1;
    b.direction = (a.x >= b.x) ? 1 : -1;
  }

  update(dt) {
    if (!this.a.alive || !this.b.alive) return false;
    this.timer += dt;
    this._faceEachOther();
    return this.timer < this.duration;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
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

  // 旁观者站立看棋：保持 idle 循环动画，state 置 null → 'standing'
  _setupOnlooker(npc) {
    npc.state      = null;
    npc.animation  = 'idle';
    npc.speed      = 0;
    npc.vy         = 0;
    npc.playOnce   = false;
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

    // 3) 路人经过空棋桌 → 概率加入新棋局（后续实现，本次留桩）
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

  // 扫描可配对的两名 stand 自由行人 → 随机生成 talk
  _tryPairTalk(npcs) {
    const standers = npcs.filter(n =>
      n.alive && !n._activity && n.state === 'stand' &&
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
