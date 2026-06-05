/**
 * BagProp — a bag shape hanging from the NPC's left hand.
 */

import { NpcProp } from './NpcProp.js';

export class BagProp extends NpcProp {
  draw(g) {
    if (!this.active) return;
    const anchor = this.npc.getAnchor('hand_l');
    const s = this.npc.scale;
    const bw = 24 * s, bh = 32 * s;
    g.lineStyle(0); g.beginFill(0x4a4a4a, 0.85); g.drawRect(anchor.x - bw / 2, anchor.y, bw, bh); g.endFill();
    g.lineStyle(Math.max(0.8, 1.4 * s), 0x3a3a3a, 0.9); g.drawRect(anchor.x - bw / 2, anchor.y, bw, bh); g.lineStyle(0);
    const handleW = 8 * s;
    g.lineStyle(Math.max(0.6, 1.2 * s), 0x3a3a3a, 0.7); g.moveTo(anchor.x - handleW, anchor.y); g.lineTo(anchor.x + handleW, anchor.y);
  }
}
