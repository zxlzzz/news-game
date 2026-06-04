import { setState }         from '../BaseStateMachine.js';
import { Activity }         from './Activity.js';
import { registerActivity } from '../ActivityRegistry.js';

const rand = (a, b) => a + Math.random() * (b - a);

const CHESS_WAIT_MS = 3500;

function startPlay(npc) {
  npc.playOnce   = true;
  npc.animDone   = false;
  npc.frameIndex = 0;
  npc.frameTimer = 0;
}
function freezeAt0(npc) {
  npc.animDone   = true;
  npc.frameIndex = 0;
}

export class ChessActivity extends Activity {
  constructor(id, players, onlookers, props) {
    super(id, 'chess');
    this.a = players[0];
    this.b = players[1];
    this.onlookers = onlookers || [];
    this.table = props[0] || null;
    this.join(this.a, 'player_a');
    this.join(this.b, 'player_b');
    for (const o of this.onlookers) this.join(o, 'onlooker');
    for (const p of props) this.occupy(p);
    if (this.table) this.table._chessActivity = this;

    this.subState = 'playing';
    this.active   = 'A';
    this.waiting  = false;
    this.waitMs   = 0;

    this._setupPlayer(this.a);
    this._setupPlayer(this.b);
    for (const o of this.onlookers) this._setupOnlooker(o);

    startPlay(this.a);
    freezeAt0(this.b);
  }

  _setupPlayer(npc) {
    npc.state      = null;
    npc.animation  = 'chess';
    npc.speed      = 0;
    npc.vy         = 0;
    npc.playOnce   = true;
  }

  _setupOnlooker(npc) {
    npc.state      = null;
    npc.animation  = 'chess_onlookers';
    npc.speed      = 0;
    npc.vy         = 0;
    npc.playOnce   = true;
    npc.animDone   = false;
    npc.frameIndex = 0;
    npc.frameTimer = 0;
  }

  _tickOnlooker(npc, dt) {
    if (npc.animDone) {
      npc.animDone   = false;
      npc.playOnce   = true;
      npc.frameIndex = 0;
    }
  }

  addOnlooker(npc, slot) {
    this.onlookers.push(npc);
    this.join(npc, 'onlooker');
    this._setupOnlooker(npc);
    npc._chessSlot     = slot || null;
    npc._onlookerTimer = 0;
    npc._onlookerDur   = rand(15, 40);
    if (this.table) npc.direction = (this.table.x >= npc.x) ? 1 : -1;
  }

  releaseOnlooker(npc) {
    const i = this.onlookers.indexOf(npc);
    if (i >= 0) this.onlookers.splice(i, 1);
    this.participants = this.participants.filter(p => p.npc !== npc);
    this.release(npc);
    if (npc._chessSlot) {
      npc._chessSlot.reserved = null;
      npc._chessSlot.ready    = false;
      npc._chessSlot.npc      = null;
      npc._chessSlot = null;
    }
    if (npc.alive) setState(npc, 'walk', 'onlooker-done');
  }

  update(dt) {
    if (!this.a.alive || !this.b.alive) return false;
    const cur = this.active === 'A' ? this.a : this.b;
    if (!this.waiting && cur.animDone) {
      cur.frameIndex = 0;
      this.waiting = true;
      this.waitMs  = 0;
    }
    if (this.waiting) {
      this.waitMs += dt * 1000;
      if (this.waitMs >= CHESS_WAIT_MS) {
        this.waiting = false;
        this.active  = this.active === 'A' ? 'B' : 'A';
        const next = this.active === 'A' ? this.a : this.b;
        const prev = this.active === 'A' ? this.b : this.a;
        startPlay(next);
        freezeAt0(prev);
      }
    }
    for (let i = this.onlookers.length - 1; i >= 0; i--) {
      const o = this.onlookers[i];
      if (!o.alive) {
        this.onlookers.splice(i, 1);
        this.participants = this.participants.filter(p => p.npc !== o);
        continue;
      }
      this._tickOnlooker(o, dt);
      o._onlookerTimer = (o._onlookerTimer || 0) + dt;
      if (o._onlookerDur != null && o._onlookerTimer >= o._onlookerDur) {
        this.releaseOnlooker(o);
      }
    }
    return true;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    for (const o of this.onlookers) {
      if (o._chessSlot) {
        o._chessSlot.reserved = null; o._chessSlot.ready = false; o._chessSlot.npc = null;
        o._chessSlot = null;
      }
    }
    if (this.table) this.table._chessActivity = null;
    for (const { npc } of this.participants) {
      if (npc.alive) setState(npc, 'walk', 'activity-end');
    }
    super.destroy();
  }
}

registerActivity('chess', (id, participants, props) => {
  const players   = participants.filter(p => p.role.startsWith('player')).map(p => p.npc);
  const onlookers = participants.filter(p => p.role === 'onlooker').map(p => p.npc);
  return new ChessActivity(id, players, onlookers, props);
}, {
  onSlotArrival(npc, prop, slot, socialLayer) {
    const act = prop._chessActivity;
    if (act && act.alive && act.addOnlooker) act.addOnlooker(npc, slot);
    else socialLayer._abandonSlot(npc, slot, 'chess_no_game');
  },
});
