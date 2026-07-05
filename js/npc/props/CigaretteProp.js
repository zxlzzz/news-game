/**
 * CigaretteProp — thin stick at hand_r with a glowing tip + smoke particles.
 */

import { NpcProp } from './NpcProp.js';
import { SmokeEmitter } from '../../fx/SmokeEmitter.js';

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
    const tipX = anchor.x + d * 16 * s;
    const tipY = anchor.y - 3 * s;
    this.smoke.x = tipX;
    this.smoke.y = tipY;
    this.smoke.update(dt);
  }

  draw(g) {
    if (!this.active) return;
    const anchor = this.npc.getAnchor('hand_r');
    const s = this.npc.scale;
    const d = this.npc.direction;
    const len = 16 * s;
    const tipX = anchor.x + d * len;
    const tipY = anchor.y - 3 * s;
    g.lineStyle(Math.max(1, 2 * s), 0xe8e0d0, 0.95);
    g.moveTo(anchor.x, anchor.y).lineTo(tipX, tipY);
    g.lineStyle(0);
    g.beginFill(0xcc4400, 0.9);
    g.drawCircle(tipX, tipY, Math.max(1.2, 2 * s));
    g.endFill();
    this.smoke.draw(g);
  }
}
