/**
 * SmokeEmitter — wispy smoke puffs rising from a cigarette tip
 */

import { ParticleEmitter } from './ParticleEmitter.js';

export class SmokeEmitter extends ParticleEmitter {
  constructor() {
    super({ rate: 2.5, maxParticles: 8, gravity: -12 });
  }

  initParticle(p) {
    p.vx = (Math.random() - 0.5) * 6;
    p.vy = -12 - Math.random() * 8;
    p.life = 0.7 + Math.random() * 0.5;
    p.size = 2.5 + Math.random() * 2;
  }

  drawParticle(g, p) {
    const t = p.age / p.life;
    const r = p.size + t * 4;
    const gray = Math.round(0x88 + t * 0x44);
    const color = (gray << 16) | (gray << 8) | gray;
    g.fillStyle(color, p.alpha * 0.45);
    g.fillCircle(p.x, p.y, r);
  }
}
