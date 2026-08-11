import { getJointNames, getSkeleton } from './config.js'

const MAX_HISTORY = 80;

function captureGlobalBend() {
  const sk = getSkeleton();
  const gb = {};
  for (const b of sk.bones) gb[`${b[0]}__${b[1]}`] = b[3] ?? 0;
  return gb;
}

export class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  save(frames, currentFrame, frameDurs, duet) {
    this.undoStack.push(this._snapshot(frames, currentFrame, frameDurs, duet));
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(frames, currentFrame, frameDurs, duet) {
    if (this.undoStack.length === 0) return null;
    this.redoStack.push(this._snapshot(frames, currentFrame, frameDurs, duet));
    return this.undoStack.pop();
  }

  redo(frames, currentFrame, frameDurs, duet) {
    if (this.redoStack.length === 0) return null;
    this.undoStack.push(this._snapshot(frames, currentFrame, frameDurs, duet));
    return this.redoStack.pop();
  }

  /**
   * duet（duet 模式下由 app.js 传入 {activeDuetRoleIdx, roles}，非 duet 模式传 null/undefined）：
   * 单纯只快照当前激活 role 的 frames 不够——addFrame/dupFrame 会同步往所有 role 插入新帧，
   * 换 role/改名/拖别的 role 位置也都是跨 role 的状态；不整体快照+整体还原，撤销时会把
   * 只属于某一个 role 的旧快照套到另一个/不同帧数的 role 上，越撤越乱。
   */
  _snapshot(frames, currentFrame, frameDurs, duet) {
    return {
      frames: duet ? null : frames.map(pose => {
        const p = {};
        for (const k of getJointNames()) p[k] = {x:pose[k].x, y:pose[k].y};
        for (const k of Object.keys(pose)) {
          if (k.startsWith('_bend_')) p[k] = pose[k];
        }
        return p;
      }),
      currentFrame,
      frameDurs: (frameDurs ?? []).slice(),
      duet: duet ? {
        activeDuetRoleIdx: duet.activeDuetRoleIdx,
        roles: duet.roles.map(r => ({
          role: r.role,
          skelName: r.skelName,
          offset: { x: r.offset.x, y: r.offset.y },
          frames: JSON.parse(JSON.stringify(r.frames)),
          allowedJoints: r.allowedJoints ? [...r.allowedJoints] : [],
        })),
      } : null,
      globalBend: captureGlobalBend(),
    };
  }

  /** 骨骼切换 / 载入新 clip 时调用：旧快照的关节名/骨骼与新状态不兼容，不能再被撤销应用 */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}