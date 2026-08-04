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

  save(frames, currentFrame, frameDurs) {
    this.undoStack.push(this._snapshot(frames, currentFrame, frameDurs));
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(frames, currentFrame, frameDurs) {
    if (this.undoStack.length === 0) return null;
    this.redoStack.push(this._snapshot(frames, currentFrame, frameDurs));
    return this.undoStack.pop();
  }

  redo(frames, currentFrame, frameDurs) {
    if (this.redoStack.length === 0) return null;
    this.undoStack.push(this._snapshot(frames, currentFrame, frameDurs));
    return this.redoStack.pop();
  }

  _snapshot(frames, currentFrame, frameDurs) {
    return {
      frames: frames.map(pose => {
        const p = {};
        for (const k of getJointNames()) p[k] = {x:pose[k].x, y:pose[k].y};
        for (const k of Object.keys(pose)) {
          if (k.startsWith('_bend_')) p[k] = pose[k];
        }
        return p;
      }),
      currentFrame,
      frameDurs: (frameDurs ?? []).slice(),
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