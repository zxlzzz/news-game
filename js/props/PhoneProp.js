/**
 * PhoneProp — small rectangle drawn at the NPC's right hand when phone_look or phone_call is active.
 */

import { NpcProp } from './NpcProp.js';

export class PhoneProp extends NpcProp {
  draw(g) {
    if (!this.active) return;
    const anchor = this.npc.getAnchor('hand_r');
    const s = this.npc.scale;
    const w = 4 * s, h = 7 * s;
    g.fillStyle(0x2a2a2a, 0.9);
    g.fillRect(anchor.x - w / 2, anchor.y - h, w, h);
    g.fillStyle(0x8a8a8a, 0.6);
    g.fillRect(anchor.x - w / 2 + 0.5 * s, anchor.y - h + 1 * s, w - 1 * s, h - 2 * s);
  }
}
