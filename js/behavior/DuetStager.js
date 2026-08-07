/**
 * DuetStager — 双人接触编排引擎（Patch G，从 TalkActivity#_tickSubEvent 抽出）
 *
 * 纯编排：只管两个 NPC 的位置插值 + 关节 modifier，不碰 roster/participants——
 * 这些是 Activity 层的职责（谁在场、谁退出、事件怎么发）。ContactActivity 持有
 * 一个 DuetStager 实例驱动播放，自己只处理 join/dismiss/emit 这类越权操作，
 * 通过 onEject 回调把控制权交还。
 *
 * 三段式：reach（插值走到 designGap 对应站位 + 从当前姿势过渡到第 0 帧）→
 * play（逐帧步进，到末帧后按 sustain 决定收尾还是停留）→ release（插值放开
 * 姿势 + 走回原位）。cfg 即 PoseCacheBuilder#decodeSubEvent() 的输出
 * （frames/roles/sustain/designGap/reach/release，外加可选的 ejectRole）。
 *
 * ejectRole（可选，clip 顶层字段，如 push.json）：
 *   { role, toState, emitKind } —— play 阶段开始的瞬间，把该 role 对应的 NPC
 *   提前"弹出"（不再参与后续插值/关节步进，位置保持已经插值到的中间点），
 *   由 onEject(npc, otherNpc, effect) 回调交给 Activity 层做 release/setState/
 *   emitEvent 这类操作。取代原来硬编码在 TalkActivity 里的
 *   `if (this._subEvent === 'push') {...}` 分支——push.json 现在自己声明
 *   "谁被弹出、弹出后什么状态、发什么事件"，新增同类 clip 不需要再改代码。
 */

import { setXY } from './Motor.js';

const clamp01 = (t) => Math.max(0, Math.min(1, t));

export class DuetStager {
  /**
   * @param {object} npcA @param {string} roleA
   * @param {object} npcB @param {string} roleB
   * @param {object} cfg  decodeSubEvent() 输出
   * @param {(npc:object, otherNpc:object, effect:object)=>void} [onEject]
   */
  constructor(npcA, roleA, npcB, roleB, cfg, onEject) {
    this.a = npcA; this.roleA = roleA;
    this.b = npcB; this.roleB = roleB;
    this.cfg = cfg;
    this._onEject = onEject ?? (() => {});

    this.phase   = 'reach';
    this._timer  = 0;
    this._frameIdx   = 0;
    this._frameTimer = 0;
    this._ejectedA = false;
    this._ejectedB = false;

    this._aBase = this._captureBasePose(this.a, this._unionJoints(cfg.frames, roleA));
    this._bBase = this._captureBasePose(this.b, this._unionJoints(cfg.frames, roleB));

    this._aOrigX = this.a.x;
    this._bOrigX = this.b.x;
    const mid     = (this.a.x + this.b.x) / 2;
    const aIsLeft = this.a.x <= this.b.x;
    // U-1：designGap 是骨架单位，落到世界坐标须乘 scale——用 a/b 两者 scale 的平均，
    // 因为两人常常不在同一深度。
    const avgScale = (this.a.scale + this.b.scale) / 2;
    const half = cfg.designGap * avgScale / 2;
    this._aTargetX = mid + (aIsLeft ? -half : half);
    this._bTargetX = mid + (aIsLeft ? half : -half);
  }

  /** @returns {boolean} true=仍在播放，false=release 阶段走完，可以收场 */
  tick(dt) {
    const cfg = this.cfg;
    this._timer += dt;
    const reachDur   = cfg.reach   ?? 0.4;
    const releaseDur = cfg.release ?? 0.4;

    if (this.phase === 'reach') {
      const t  = clamp01(this._timer / reachDur);
      const f0 = cfg.frames[0];
      if (!this._ejectedA) {
        this._applyLerpPose(this.a, this._aBase, f0[this.roleA], t);
        this._setX(this.a, this._aOrigX + (this._aTargetX - this._aOrigX) * t);
      }
      if (!this._ejectedB) {
        this._applyLerpPose(this.b, this._bBase, f0[this.roleB], t);
        this._setX(this.b, this._bOrigX + (this._bTargetX - this._bOrigX) * t);
      }

      if (this._timer >= reachDur) {
        this.phase       = 'play';
        this._timer      = 0;
        this._frameIdx   = 0;
        this._frameTimer = 0;
        this._applyFrame(f0);
        if (!this._ejectedA) this._setX(this.a, this._aTargetX);
        if (!this._ejectedB) this._setX(this.b, this._bTargetX);
        this._maybeEject();
      }
    } else if (this.phase === 'play') {
      this._frameTimer += dt;
      const curDur = this._currentFrameDur();

      if (this._frameTimer >= curDur) {
        this._frameTimer = 0;
        if (this._frameIdx < cfg.frames.length - 1) {
          this._frameIdx++;
          this._applyFrame(cfg.frames[this._frameIdx]);
        } else if (!cfg.sustain) {
          this.phase  = 'release';
          this._timer = 0;
        }
        // sustain=true 且已在末帧：保持末帧 joints 不变，等待外部 destroy()
      }
    } else if (this.phase === 'release') {
      const t = clamp01(1 - this._timer / releaseDur);
      const lastFrame = cfg.frames[cfg.frames.length - 1];
      if (!this._ejectedA) {
        this._applyLerpPose(this.a, this._aBase, lastFrame[this.roleA], t);
        this._setX(this.a, this._aOrigX + (this._aTargetX - this._aOrigX) * t);
      }
      if (!this._ejectedB) {
        this._applyLerpPose(this.b, this._bBase, lastFrame[this.roleB], t);
        this._setX(this.b, this._bOrigX + (this._bTargetX - this._bOrigX) * t);
      }

      if (this._timer >= releaseDur) {
        if (!this._ejectedA) { this._setX(this.a, this._aOrigX); this._clearModifier(this.a); }
        if (!this._ejectedB) { this._setX(this.b, this._bOrigX); this._clearModifier(this.b); }
        return false;
      }
    }

    return true;
  }

  /** 中途打断（Activity destroy/interrupt）：未弹出的一方复位到进入前的位置，清 modifier。 */
  cancel() {
    if (!this._ejectedA && this.a.alive) { this._setX(this.a, this._aOrigX); this._clearModifier(this.a); }
    if (!this._ejectedB && this.b.alive) { this._setX(this.b, this._bOrigX); this._clearModifier(this.b); }
  }

  // ── ejectRole ──────────────────────────────────────────────────────────────

  _maybeEject() {
    const eject = this.cfg.ejectRole;
    if (!eject) return;
    if (eject.role === this.roleA && !this._ejectedA) {
      this._ejectedA = true;
      this._onEject(this.a, this.b, eject);
    } else if (eject.role === this.roleB && !this._ejectedB) {
      this._ejectedB = true;
      this._onEject(this.b, this.a, eject);
    }
  }

  // ── 位置/关节写入 ──────────────────────────────────────────────────────────

  _setX(npc, x) { setXY(npc, x, npc.y); }

  _unionJoints(frames, role) {
    const s = new Set();
    for (const f of frames) for (const j of Object.keys(f[role] ?? {})) s.add(j);
    return [...s];
  }

  _captureBasePose(npc, joints) {
    const anim = npc.renderer ? npc.renderer.getAnimation(npc.animation) : null;
    const base = {};
    if (anim) {
      const frame = anim.frames[npc.frameIndex % anim.frameCount];
      for (const j of joints) base[j] = frame[j] ? [...frame[j]] : [0, 0];
    }
    return base;
  }

  /** 当前帧的播放时长：显式 dur 优先，否则 0.3 */
  _currentFrameDur() {
    const frame = this.cfg.frames[this._frameIdx];
    return typeof frame.dur === 'number' ? frame.dur : 0.3;
  }

  /** 逐帧步进播放：直接把该帧的绝对关节坐标写入 modifier，不做帧间插值 */
  _applyFrame(frame) {
    if (!this._ejectedA) this._setModifierJoints(this.a, frame[this.roleA]);
    if (!this._ejectedB) this._setModifierJoints(this.b, frame[this.roleB]);
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
    let mod = npc.modifiers.find(m => m.id === '_duet_stage');
    if (!mod) {
      npc.modifiers.push({ id: '_duet_stage', kind: 'held', priority: 20, joints, timer: -1 });
    } else {
      mod.joints = joints;
    }
  }

  _clearModifier(npc) {
    npc.modifiers = npc.modifiers.filter(m => m.id !== '_duet_stage');
  }
}
