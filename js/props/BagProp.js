/**
 * BagProp — a small bag shape hanging from the NPC's left hand.
 */

import { NpcProp } from './NpcProp.js';

export class BagProp extends NpcProp {
  draw(g) {
    if (!this.active) return;
    const anchor = this.npc.getAnchor('hand_l');
    const s = this.npc.scale;
    const bw = 6 * s, bh = 8 * s;
    g.fillStyle(0x4a4a4a, 0.85);
    g.fillRect(anchor.x - bw / 2, anchor.y, bw, bh);
    g.lineStyle(Math.max(0.5, 0.8 * s), 0x3a3a3a, 0.9);
    g.strokeRect(anchor.x - bw / 2, anchor.y, bw, bh);
    g.lineStyle(Math.max(0.4, 0.7 * s), 0x3a3a3a, 0.7);
    const handleW = 3 * s;
    g.lineBetween(anchor.x - handleW, anchor.y, anchor.x + handleW, anchor.y);
  }
}
