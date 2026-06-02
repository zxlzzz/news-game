import { Entity } from './Entity.js';
import { drawProp } from './props/PropDrawer.js';

const OBSTACLE_TYPES = new Set([
  'fountain', 'slide', 'stall', 'tree', 'bench', 'trash', 'hydrant',
  'mailbox', 'newsrack', 'planter', 'vending', 'phonebooth', 'chess-table',
]);

export class PropEntity extends Entity {
  constructor(config) {
    super({ ...config, static: true });
    this.propType  = config.propType  || 'generic';
    this.propColor = config.propColor ?? 0x888888;
    this.dir       = config.dir       ?? 1;
    this.facing    = config.facing    ?? 'down';
    this.seatH     = config.seatH     ?? null;
    this.topH      = config.topH      ?? null;

    if (this.propType === 'bench') { this.width *= 3; this.height = 24; }

    this.obstacle = OBSTACLE_TYPES.has(this.propType);
    if (this.obstacle) {
      const [rx, ry] = this._calcCollision();
      this.collisionRX = rx;
      this.collisionRY = ry;
      this.collisionRadius = Math.max(rx, ry);
    } else {
      this.collisionRX = this.collisionRY = this.collisionRadius = 0;
    }

    if (config.smartDef) {
      this.smartDef = config.smartDef;
      this._slots = config.smartDef.slots.map((s, i) => ({
        index:    i,
        role:     s.role,
        dx:       s.dx ?? 0,
        dy:       s.dy ?? 0,
        reserved: null,
      }));
    }
  }

  _calcCollision() {
    const w = this.width || 20, h = this.height || 20;
    switch (this.propType) {
      case 'fountain': case 'slide': case 'stall':
        return [w * 0.5, h * 0.5];
      case 'bench': {
        const half = w * 0.5;
        return (this.facing === 'left' || this.facing === 'right') ? [8, half] : [half, 8];
      }
      case 'tree':
        return [15, 15];
      case 'vending': case 'phonebooth': case 'chess-table':
        return [14, 12];
      default:
        return [10, 10];
    }
  }

  draw(g) {
    if (!this.visible) return;
    drawProp(g, this);
  }
}
