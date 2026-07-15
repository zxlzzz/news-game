import { BIKE_LANE_FAR_TOP, FAR_Y, NEAR_Y, BIKE_LANE_NEAR_BOTTOM } from '../core/Layout.js';

// Y-band surface label
function yBandLabel(y) {
  if (y < BIKE_LANE_FAR_TOP)     return 'sidewalk';
  if (y < FAR_Y)                 return 'bike_far';
  if (y < NEAR_Y)                return 'road';
  if (y < BIKE_LANE_NEAR_BOTTOM) return 'bike_near';
  return 'park';
}

class MovementAudit {
  constructor() {
    this._counts  = new Map(); // npcId → { probe_steer, slide_steer, blocked_contact, stuck }
    this._surface = new Map(); // npcId → { sidewalk, bike_far, road, bike_near, park, total }
    this._acc     = 0;        // seconds accumulator for per-second sampling
  }

  _entry(npc) {
    const id = npc.id ?? npc.name ?? 'anon';
    if (!this._counts.has(id)) this._counts.set(id, { probe_steer: 0, slide_steer: 0, blocked_contact: 0, stuck: 0, dir_mismatch: 0, vel0_walk: 0, routing_with_walkmode: 0, departing_orphan: 0 });
    if (!this._surface.has(id)) this._surface.set(id, { sidewalk: 0, bike_far: 0, road: 0, bike_near: 0, park: 0, total: 0 });
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

    for (const npc of npcs) {
      const id  = this._entry(npc);
      const s   = this._surface.get(id);
      const lbl = yBandLabel(npc.y);
      s[lbl] = (s[lbl] ?? 0) + 1;
      s.total++;

      const ag = npc.mem('agenda');
      const sc = npc.mem('social');
      if (npc.alive && ag.departing && npc.state !== 'routing' && !ag.pendingDeparture && !sc.waitingBusStop) {
        this.count(npc, 'departing_orphan');
      }
    }
  }

  dump(npcs) {
    const rows = [];
    let gProbe = 0, gSlide = 0, gBlocked = 0, gStuck = 0, gDirMismatch = 0, gSpeed0Walk = 0, gRoutingWM = 0, gDepartingOrphan = 0;

    for (const npc of npcs) {
      const id = this._entry(npc);
      const c  = this._counts.get(id);
      const s  = this._surface.get(id);
      const ratio = c.blocked_contact > 0
        ? (c.probe_steer / c.blocked_contact).toFixed(1)
        : c.probe_steer > 0 ? '∞' : '-';
      const mbRatio = c.blocked_contact > 0
        ? (c.dir_mismatch / c.blocked_contact).toFixed(1)
        : '-';
      const roadPct = s.total > 0 ? ((s.road ?? 0) / s.total * 100).toFixed(1) + '%' : '-';
      rows.push({
        id,
        probe_steer:           c.probe_steer,
        slide_steer:           c.slide_steer,
        blocked_contact:       c.blocked_contact,
        dir_mismatch:          c.dir_mismatch,
        vel0_walk:             c.vel0_walk,
        routing_with_walkmode: c.routing_with_walkmode,
        departing_orphan:      c.departing_orphan,
        stuck:                 c.stuck,
        'p:b ratio':           ratio,
        'm:b ratio':           mbRatio,
        'road%':               roadPct,
        sidewalk:              s.sidewalk,
        bike_far:              s.bike_far,
        bike_near:             s.bike_near,
        park:                  s.park,
      });
      gProbe            += c.probe_steer;
      gSlide            += c.slide_steer;
      gBlocked          += c.blocked_contact;
      gStuck            += c.stuck;
      gDirMismatch      += c.dir_mismatch;
      gSpeed0Walk       += c.vel0_walk;
      gRoutingWM        += c.routing_with_walkmode;
      gDepartingOrphan  += c.departing_orphan;
    }

    // Global totals row
    rows.push({
      id:                    '── TOTAL ──',
      probe_steer:           gProbe,
      slide_steer:           gSlide,
      blocked_contact:       gBlocked,
      dir_mismatch:          gDirMismatch,
      vel0_walk:             gSpeed0Walk,
      routing_with_walkmode: gRoutingWM,
      departing_orphan:      gDepartingOrphan,
      stuck:                 gStuck,
      'p:b ratio':           gBlocked > 0 ? (gProbe / gBlocked).toFixed(1) : gProbe > 0 ? '∞' : '-',
      'm:b ratio':           gBlocked > 0 ? (gDirMismatch / gBlocked).toFixed(1) : '-',
      'road%':               '',
      sidewalk:              '',
      bike_far:              '',
      bike_near:             '',
      park:                  '',
    });

    console.table(rows);
  }

  /** Return the same rows that dump() would print, without console.table. */
  rows(npcs) {
    const rows = [];
    let gProbe = 0, gSlide = 0, gBlocked = 0, gStuck = 0, gDirMismatch = 0, gSpeed0Walk = 0, gRoutingWM = 0, gDepartingOrphan = 0;
    for (const npc of npcs) {
      const id = this._entry(npc);
      const c  = this._counts.get(id);
      const s  = this._surface.get(id);
      const roadPct = s.total > 0 ? ((s.road ?? 0) / s.total * 100).toFixed(1) + '%' : '-';
      rows.push({ id, probe_steer: c.probe_steer, slide_steer: c.slide_steer,
        blocked_contact: c.blocked_contact, dir_mismatch: c.dir_mismatch,
        vel0_walk: c.vel0_walk, routing_with_walkmode: c.routing_with_walkmode,
        departing_orphan: c.departing_orphan,
        stuck: c.stuck, 'road%': roadPct,
        sidewalk: s.sidewalk, bike_far: s.bike_far, bike_near: s.bike_near, park: s.park });
      gProbe += c.probe_steer; gSlide += c.slide_steer; gBlocked += c.blocked_contact;
      gStuck += c.stuck; gDirMismatch += c.dir_mismatch; gSpeed0Walk += c.vel0_walk;
      gRoutingWM += c.routing_with_walkmode; gDepartingOrphan += c.departing_orphan;
    }
    rows.push({ id: '── TOTAL ──', probe_steer: gProbe, slide_steer: gSlide,
      blocked_contact: gBlocked, dir_mismatch: gDirMismatch, vel0_walk: gSpeed0Walk,
      routing_with_walkmode: gRoutingWM, departing_orphan: gDepartingOrphan,
      stuck: gStuck, 'road%': '', sidewalk: '', bike_far: '', bike_near: '', park: '' });
    return rows;
  }

  clear() {
    this._counts.clear();
    this._surface.clear();
    this._acc = 0;
  }
}

export const audit = new MovementAudit();
