/**
 * NpcProp — base class for visual props attached to NPC anchor points.
 *
 * Subclasses implement draw(g, anchor, npc) where anchor = { x, y }.
 * The NpcPropManager calls update/draw each frame when the prop is active.
 */

export class NpcProp {
  constructor(npc) {
    this.npc = npc;
    this.active = false;
  }

  activate()   { this.active = true; }
  deactivate() { this.active = false; }
  update(dt)   { /* override */ }
  draw(g)      { /* override */ }
}
