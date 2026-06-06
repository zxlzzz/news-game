/**
 * ClipPlayer — 把一段 gesture clip（keyframes）驱动为 NPC 上的一个 held modifier。
 * 逐帧推进，播完停在末帧（done=true）。供 StallActivity 复用（摊主循环 / 买卖动作）。
 */
export class ClipPlayer {
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
      if (this.idx + 1 >= this.frames.length) { this.done = true; return; }
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

function kfJoints(kf) {
  const j = {};
  for (const k in kf) { if (k !== 'dur') j[k] = kf[k]; }
  return j;
}
