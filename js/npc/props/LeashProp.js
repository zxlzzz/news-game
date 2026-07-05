/**
 * LeashProp — rope line from owner's left hand to the dog's neck anchor.
 */

import { NpcProp } from './NpcProp.js';

export class LeashProp extends NpcProp {
  constructor(npc, dog) {
    super(npc);
    this.dog = dog;
  }

  draw(g) {
    if (!this.active || !this.dog.alive) return;
    const hand = this.npc.getAnchor('hand_l');
    const neck = this.dog.getAnchor('neck');
    g.lineStyle(Math.max(0.8, 1.2 * this.npc.scale), 0x6a6a6a, 0.85);
    g.moveTo(hand.x, hand.y).lineTo(neck.x, neck.y);
  }
}
