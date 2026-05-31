/**
 * CigaretteProp — thin stick at hand_r with a glowing tip + smoke particles.
 */

import { NpcProp } from './NpcProp.js';
import { SmokeEmitter } from '../fx/SmokeEmitter.js';

export class CigaretteProp extends NpcProp {
  constructor(npc) {
    super(npc);
    this.smoke = new SmokeEmitter();
  }

  activate() {
    super.activate();
    this.smoke.active = true;
  }

  deactivate() {
    super.deactivate();
    this.smoke.active = false;
    this.smoke.particles.length = 0;
  }

  update(dt) {
    if (!this.active) return;
    const anchor = this.npc.getAnchor('hand_r');
    const s = this.npc.scale;
    const d = this.npc.direction;
    const tipX = anchor.x + d * 8 * s;
    const tipY = anchor.y - 2 * s;
    this.smoke.x = tipX;
    this.smoke.y = tipY;
    this.smoke.update(dt);
  }

  draw(g) {
    if (!this.active) return;
    const anchor = this.npc.getAnchor('hand_r');
    const s = this.npc.scale;
    const d = this.npc.direction;
    const len = 8 * s;
    const tipX = anchor.x + d * len;
    const tipY = anchor.y - 2 * s;
    g.lineStyle(Math.max(0.6, 1.2 * s), 0xe8e0d0, 0.95);
    g.lineBetween(anchor.x, anchor.y, tipX, tipY);
    g.fillStyle(0xcc4400, 0.9);
    g.fillCircle(tipX, tipY, Math.max(0.8, 1.2 * s));
    this.smoke.draw(g);
  }
}
