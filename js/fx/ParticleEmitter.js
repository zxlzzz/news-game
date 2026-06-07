/**
 * ParticleEmitter — lightweight 2D particle system for PIXI.Graphics
 *
 * Subclasses override initParticle() and drawParticle() to define visual style.
 * Each emitter is attached to a world-space anchor that the owner updates every frame.
 */

export class ParticleEmitter {
  constructor({ rate = 4, maxParticles = 20, gravity = -8 } = {}) {
    this.rate = rate;
    this.maxParticles = maxParticles;
    this.gravity = gravity;
    this.particles = [];
    this._accum = 0;
    this.x = 0;
    this.y = 0;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    const sec = dt / 1000;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += sec;
      if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * sec;
      p.y += (p.vy + this.gravity * p.age) * sec;
      p.alpha = Math.max(0, 1 - p.age / p.life);
    }

    this._accum += sec;
    const interval = 1 / this.rate;
    while (this._accum >= interval && this.particles.length < this.maxParticles) {
      this._accum -= interval;
      const p = { x: this.x, y: this.y, vx: 0, vy: 0, alpha: 1, age: 0, life: 1, size: 2 };
      this.initParticle(p);
      this.particles.push(p);
    }
  }

  draw(g) {
    for (const p of this.particles) this.drawParticle(g, p);
  }

  initParticle(p) { /* override */ }
  drawParticle(g, p) { /* override */ }
}
