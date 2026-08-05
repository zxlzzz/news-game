import { setState, setXY }  from '../Motor.js';
import { dlog }             from '../DebugLog.js';
import { Activity }         from './Activity.js';
import { registerActivity } from '../ActivityRegistry.js';
import { emitEvent }        from '../WorldEventLog.js';

const rand   = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

// poseCache.sub_event 本身就是完整配置源（PoseCacheBuilder.decodeSubEvent 的输出：
// frames/roles/sustain/designGap，外加 clip 自带的 reach/release）——不再另建一份硬编码表
let SUB_EVENT_POSES = {};

export function initSubEventPoses(poses) {
  SUB_EVENT_POSES = poses || {};
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
    this._pushBReleased = false;
    this._frameIdx      = 0;
    this._frameTimer    = 0;
    this._aOrigX        = null;
    this._bOrigX        = null;
    this._aTargetX      = null;
    this._bTargetX      = null;
    this._roleA         = null;
    this._roleB         = null;
  }

  _enterTalk(npc) {
    setState(npc, 'talk', 'talk-enter');
    npc.modifiers = npc.modifiers.filter(m => m.kind === 'trait');
  }

  _faceEachOther() {
    const { a, b } = this;
    if (Math.abs(b.x - a.x) > 2) {
      a.direction = (b.x >= a.x) ? 1 : -1;
      b.direction = (a.x >= b.x) ? 1 : -1;
    }
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
    for (const type of Object.keys(SUB_EVENT_POSES)) {
      if (chance(w[type] ?? 0.05)) return type;
    }
    return null;
  }

  _startSubEvent(type) {
    const cfg = SUB_EVENT_POSES[type];
    if (!cfg || !cfg.frames || !cfg.frames.length) return;

    this._subEvent      = type;
    this._subPhase      = 'reach';
    this._subTimer      = 0;
    this._pushBReleased = false;
    this._frameIdx      = 0;
    this._frameTimer    = 0;
    this._roleA = cfg.roles?.[0] ?? 'a';
    this._roleB = cfg.roles?.[1] ?? 'b';

    this._aBase = this._captureBasePose(this.a, this._unionJoints(cfg.frames, this._roleA));
    this._bBase = this._captureBasePose(this.b, this._unionJoints(cfg.frames, this._roleB));

    this._aOrigX = this.a.x;
    this._bOrigX = this.b.x;
    const mid    = (this.a.x + this.b.x) / 2;
    const aIsLeft = this.a.x <= this.b.x;
    // U-1：designGap 是骨架单位（编辑器坐标同空间，见 PoseCacheBuilder#decodeSubEvent），
    // 落到世界坐标必须乘 scale——用 a/b 两者 scale 的平均，因为两人常常不在同一深度。
    // 之前直接把 designGap 当世界像素用，近侧 scale≈0.262 时 70 骨架单位应渲染成 18px，
    // 实际站开了 70px，约 4 倍，且错的倍数随 y 变。
    const avgScale = (this.a.scale + this.b.scale) / 2;
    const half   = cfg.designGap * avgScale / 2;
    this._aTargetX = mid + (aIsLeft ? -half : half);
    this._bTargetX = mid + (aIsLeft ? half : -half);

    emitEvent({
      kind: type, actors: [this.a.id, this.b.id],
      x: (this.a.x + this.b.x) / 2, y: (this.a.y + this.b.y) / 2,
    });

    this.subState = type;
    dlog(`[Activity ${this.label}] sub-event: ${type}`);
  }

  _unionJoints(frames, role) {
    const s = new Set();
    for (const f of frames) for (const j of Object.keys(f[role] ?? {})) s.add(j);
    return [...s];
  }

  /** 当前帧的播放时长：显式 dur 优先，否则 0.3 */
  _currentFrameDur(cfg) {
    const frame = cfg.frames[this._frameIdx];
    return typeof frame.dur === 'number' ? frame.dur : 0.3;
  }

  _tickSubEvent(dt) {
    const cfg = SUB_EVENT_POSES[this._subEvent];
    if (!cfg) return false;
    this._subTimer += dt;
    const reachDur   = cfg.reach   ?? 0.4;
    const releaseDur = cfg.release ?? 0.4;

    if (this._subPhase === 'reach') {
      const t  = Math.min(1, this._subTimer / reachDur);
      const f0 = cfg.frames[0];
      this._applyLerpPose(this.a, this._aBase, f0[this._roleA], t);
      if (!this._pushBReleased) this._applyLerpPose(this.b, this._bBase, f0[this._roleB], t);
      setXY(this.a, this._aOrigX + (this._aTargetX - this._aOrigX) * t, this.a.y);
      if (!this._pushBReleased) setXY(this.b, this._bOrigX + (this._bTargetX - this._bOrigX) * t, this.b.y);

      if (this._subTimer >= reachDur) {
        this._subPhase   = 'play';
        this._subTimer   = 0;
        this._frameIdx   = 0;
        this._frameTimer = 0;
        this._applyFrame(f0);
        setXY(this.a, this._aTargetX, this.a.y);
        if (!this._pushBReleased) setXY(this.b, this._bTargetX, this.b.y);

        if (this._subEvent === 'push' && !this._pushBReleased) {
          this._pushBReleased = true;
          this.release(this.b);
          this.b.bond = null;
          this.participants = this.participants.filter(p => p.npc !== this.b);
          setState(this.b, 'fall', 'push');
          emitEvent({ kind: 'push_land', actors: [this.a.id, this.b.id], x: this.b.x, y: this.b.y });
        }
      }
    } else if (this._subPhase === 'play') {
      this._frameTimer += dt;
      const curDur = this._currentFrameDur(cfg);

      if (this._frameTimer >= curDur) {
        this._frameTimer = 0;
        if (this._frameIdx < cfg.frames.length - 1) {
          this._frameIdx++;
          this._applyFrame(cfg.frames[this._frameIdx]);
        } else if (!cfg.sustain) {
          this._subPhase = 'release';
          this._subTimer = 0;
        }
        // sustain=true 且已在末帧：保持末帧 joints 不变，等待外部 destroy()
      }
    } else if (this._subPhase === 'release') {
      const t = Math.max(0, 1 - this._subTimer / releaseDur);
      const lastFrame = cfg.frames[cfg.frames.length - 1];
      this._applyLerpPose(this.a, this._aBase, lastFrame[this._roleA], t);
      if (!this._pushBReleased) this._applyLerpPose(this.b, this._bBase, lastFrame[this._roleB], t);
      setXY(this.a, this._aOrigX + (this._aTargetX - this._aOrigX) * t, this.a.y);
      if (!this._pushBReleased) setXY(this.b, this._bOrigX + (this._bTargetX - this._bOrigX) * t, this.b.y);

      if (this._subTimer >= releaseDur) {
        setXY(this.a, this._aOrigX, this.a.y);
        if (!this._pushBReleased) setXY(this.b, this._bOrigX, this.b.y);
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

  /** 逐帧步进播放：直接把该帧的绝对关节坐标写入 modifier，不做帧间插值 */
  _applyFrame(frame) {
    this._setModifierJoints(this.a, frame[this._roleA]);
    if (!this._pushBReleased) this._setModifierJoints(this.b, frame[this._roleB]);
  }

  _applyLerpPose(npc, basePose, targetPose, t) {
    if (!targetPose) return;
    const joints = {};
    for (const [j, target] of Object.entries(targetPose)) {
      const base = basePose[j] || [0, 0];
      joints[j] = [base[0] + (target[0] - base[0]) * t, base[1] + (target[1] - base[1]) * t];
    }
    this._setModifierJoints(npc, joints);
  }

  _setModifierJoints(npc, joints) {
    let mod = npc.modifiers.find(m => m.id === '_talk_sub_event');
    if (!mod) {
      npc.modifiers.push({ id: '_talk_sub_event', kind: 'held', priority: 20, joints, timer: -1 });
    } else {
      mod.joints = joints;
    }
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    if (this.a.alive) {
      this.a.modifiers = this.a.modifiers.filter(m => m.id !== '_talk_sub_event');
      if (this._aOrigX != null) setXY(this.a, this._aOrigX, this.a.y);
    }
    if (!this._pushBReleased && this.b.alive) {
      this.b.modifiers = this.b.modifiers.filter(m => m.id !== '_talk_sub_event');
      if (this._bOrigX != null) setXY(this.b, this._bOrigX, this.b.y);
    }

    for (const { npc } of this.participants) {
      npc.bond = null;
      if (npc.alive) setState(npc, 'walk', 'activity-end');
    }
    super.destroy();
  }
}

registerActivity('talk', (id, participants) =>
  new TalkActivity(id, participants[0].npc, participants[1].npc));
