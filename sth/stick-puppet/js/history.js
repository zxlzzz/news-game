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

  save(frames, currentFrame) {
    this.undoStack.push(this._snapshot(frames, currentFrame));
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(frames, currentFrame) {
    if (this.undoStack.length === 0) return null;
    this.redoStack.push(this._snapshot(frames, currentFrame));
    return this.undoStack.pop();
  }

  redo(frames, currentFrame) {
    if (this.redoStack.length === 0) return null;
    this.undoStack.push(this._snapshot(frames, currentFrame));
    return this.redoStack.pop();
  }

  _snapshot(frames, currentFrame) {
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
      globalBend: captureGlobalBend(),
    };
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}