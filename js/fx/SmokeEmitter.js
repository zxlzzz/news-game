/**
 * SmokeEmitter — wispy smoke puffs rising from a cigarette tip
 */

import { ParticleEmitter } from './ParticleEmitter.js';

export class SmokeEmitter extends ParticleEmitter {
  constructor() {
    super({ rate: 2.5, maxParticles: 8, gravity: -12 });
  }

  initParticle(p) {
    p.vx = (Math.random() - 0.5) * 4;
    p.vy = -8 - Math.random() * 6;
    p.life = 0.6 + Math.random() * 0.5;
    p.size = 1.5 + Math.random() * 1.5;
  }

  drawParticle(g, p) {
    const t = p.age / p.life;
    const r = p.size + t * 2.5;
    const gray = Math.round(0x88 + t * 0x44);
    const color = (gray << 16) | (gray << 8) | gray;
    g.fillStyle(color, p.alpha * 0.45);
    g.fillCircle(p.x, p.y, r);
  }
}
