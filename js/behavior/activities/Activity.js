/** Activity 基类 — 多 NPC 共同参与的高层行为单元 */
export class Activity {
  constructor(id, type) {
    this.id = id;
    this.type = type;
    this.participants = [];
    this.occupiedProps = [];
    this.timer = 0;
    this.subState = 'init';
    this.alive = true;
    this._endReason = 'natural';
  }

  get label() { return `${this.type}#${this.id}`; }

  roleOf(npc) {
    const p = this.participants.find(p => p.npc === npc);
    return p ? p.role : null;
  }

  join(npc, role) {
    this.participants.push({ npc, role });
    npc._activity = this;
  }

  release(npc) {
    npc._activity = null;
  }

  occupy(prop) {
    if (!prop) return;
    prop._occupiedBy = this.id;
    this.occupiedProps.push(prop);
  }

  update(dt) { return this.alive; }

  interrupt(reason) { this._endReason = reason || 'interrupt'; this.alive = false; }

  destroy() {
    for (const { npc } of this.participants) this.release(npc);
    for (const prop of this.occupiedProps) prop._occupiedBy = null;
    this.participants = [];
    this.occupiedProps = [];
  }
}
