/**
 * PhoneProp — small rectangle drawn at the NPC's right hand when phone_look or phone_call is active.
 */

import { NpcProp } from './NpcProp.js';

export class PhoneProp extends NpcProp {
  draw(g) {
    if (!this.active) return;
    const anchor = this.npc.getAnchor('hand_r');
    const s = this.npc.scale;
    const w = 10 * s, h = 16 * s;
    g.lineStyle(0); g.beginFill(0x2a2a2a, 0.9); g.drawRect(anchor.x - w / 2, anchor.y - h, w, h); g.endFill();
    g.lineStyle(0); g.beginFill(0x8a8a8a, 0.6); g.drawRect(anchor.x - w / 2 + 1 * s, anchor.y - h + 2 * s, w - 2 * s, h - 4 * s); g.endFill();
  }
}
