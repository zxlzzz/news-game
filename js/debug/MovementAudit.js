import { getNavGrid } from '../behavior/nav/NavGrid.js';

// Surface cost → label mapping
const COST_LABEL = { 0: 'blocked', 1: 'sidewalk', 3: 'park', 250: 'road' };

function costLabel(c) {
  return COST_LABEL[c] ?? 'other';
}

class MovementAudit {
  constructor() {
    this._counts  = new Map(); // npcId → { probe_steer, blocked_contact, stuck }
    this._surface = new Map(); // npcId → { sidewalk, park, road, blocked, other, total }
    this._acc     = 0;        // seconds accumulator for per-second sampling
  }

  _entry(npc) {
    const id = npc.id ?? npc.name ?? 'anon';
    if (!this._counts.has(id)) this._counts.set(id, { probe_steer: 0, blocked_contact: 0, stuck: 0 });
    if (!this._surface.has(id)) this._surface.set(id, { sidewalk: 0, park: 0, road: 0, blocked: 0, other: 0, total: 0 });
    return id;
  }

  count(npc, event) {
    const id = this._entry(npc);
    const e  = this._counts.get(id);
    if (event in e) e[event]++;
  }

  tick(npcs, dt) {
    this._acc += dt;
    if (this._acc < 1) return;
    this._acc -= 1;

    const grid = getNavGrid();
    if (!grid) return;

    for (const npc of npcs) {
      const id = this._entry(npc);
      const s  = this._surface.get(id);
      const { gx, gy } = grid.worldToCell(npc.x, npc.y);
      const cost = grid.cost(gx, gy);
      const lbl  = costLabel(cost);
      s[lbl] = (s[lbl] ?? 0) + 1;
      s.total++;
    }
  }

  dump(npcs) {
    const rows = [];
    let gSteer = 0, gBlocked = 0, gStuck = 0;

    for (const npc of npcs) {
      const id = this._entry(npc);
      const c  = this._counts.get(id);
      const s  = this._surface.get(id);
      const ratio = c.blocked_contact > 0
        ? (c.probe_steer / c.blocked_contact).toFixed(1)
        : c.probe_steer > 0 ? '∞' : '-';
      const roadPct = s.total > 0 ? ((s.road ?? 0) / s.total * 100).toFixed(1) + '%' : '-';
      rows.push({
        id,
        probe_steer:     c.probe_steer,
        blocked_contact: c.blocked_contact,
        stuck:           c.stuck,
        'p:b ratio':     ratio,
        'road%':         roadPct,
        sidewalk:        s.sidewalk,
        park:            s.park,
      });
      gSteer   += c.probe_steer;
      gBlocked += c.blocked_contact;
      gStuck   += c.stuck;
    }

    // Global totals row
    rows.push({
      id:              '── TOTAL ──',
      probe_steer:     gSteer,
      blocked_contact: gBlocked,
      stuck:           gStuck,
      'p:b ratio':     gBlocked > 0 ? (gSteer / gBlocked).toFixed(1) : gSteer > 0 ? '∞' : '-',
      'road%':         '',
      sidewalk:        '',
      park:            '',
    });

    console.table(rows);
  }

  clear() {
    this._counts.clear();
    this._surface.clear();
    this._acc = 0;
  }
}

export const audit = new MovementAudit();
