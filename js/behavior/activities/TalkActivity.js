import { setState }         from '../BaseStateMachine.js';
import { dlog }             from '../DebugLog.js';
import { Activity }         from './Activity.js';
import { registerActivity } from '../ActivityRegistry.js';

const rand   = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

let SUB_EVENT_POSES = {};
let SUB_EVENTS      = {};

export function initSubEventPoses(poses) {
  SUB_EVENT_POSES = poses || {};
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

export class TalkActivity extends Activity {
  constructor(id, a, b) {
    super(id, 'talk');
    this.a = a;
    this.b = b;
    this.duration = rand(8, 18);
    this.subState = 'talking';
    this.join(a, 'speaker');
    this.join(b, 'speaker');
    a.bond = this;
    b.bond = this;
    this._enterTalk(a);
    this._enterTalk(b);
    this._faceEachOther();

    this._subEvent      = null;
    this._subPhase      = null;
    this._subTimer      = 0;
    this._aBase         = null;
    this._bBase         = null;
    this._holdDur       = 0;
    this._pushBReleased = false;
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
          return this._subEvent !== null;
        }
        return false;
      }
      return true;
    }

    return this._tickSubEvent(dt);
  }

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

        if (this._subEvent === 'push' && !this._pushBReleased) {
          this._pushBReleased = true;
          this.release(this.b);
          this.b.bond = null;
          this.participants = this.participants.filter(p => p.npc !== this.b);
          setState(this.b, 'fall', 'push');
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
        return false;
      }
    }

    return true;
  }

  _captureBasePose(npc, joints) {
    const anim  = npc.renderer ? npc.renderer.getAnimation(npc.animation) : null;
    const base  = {};
    if (anim) {
      const frame = anim.frames[npc.frameIndex % anim.frameCount];
      for (const j of joints) base[j] = frame[j] ? [...frame[j]] : [0, 0];
    }
    return base;
  }

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
    if (this.a.alive) this.a.modifiers = this.a.modifiers.filter(m => m.id !== '_talk_sub_event');
    if (!this._pushBReleased && this.b.alive) this.b.modifiers = this.b.modifiers.filter(m => m.id !== '_talk_sub_event');

    for (const { npc } of this.participants) {
      npc.bond = null;
      if (npc.alive) setState(npc, 'walk', 'activity-end');
    }
    super.destroy();
  }
}

registerActivity('talk', (id, participants) =>
  new TalkActivity(id, participants[0].npc, participants[1].npc));
