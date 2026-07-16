/** WaitBusActivity — 公交等待行为（单 NPC Activity） */
import { setState }    from '../Motor.js';
import { setWalkMode } from '../WalkMode.js';
import { Activity }    from './Activity.js';

const MAX_WAIT_TIME = 120;

export class WaitBusActivity extends Activity {
  constructor(id, npc, stop) {
    super(id, 'wait_bus');
    this._stop        = stop;
    this._waitTimer   = 0;
    this._nextFidget  = 10 + Math.random() * 10;
    this._destroyed   = false;

    this.join(npc, 'waiter');
    stop._waiters.push(npc);
    npc.mem('social').waitingBusStop = stop;
    setState(npc, 'stand', 'wait_bus');
    npc.stateDur = Infinity;
  }

  update(dt) {
    if (!this.alive) return false;
    const npc = this.participants[0]?.npc;
    if (!npc || !npc.alive) return false;

    this._waitTimer += dt;
    if (this._waitTimer > MAX_WAIT_TIME) {
      this.interrupt('wait_timeout');
      return false;
    }

    if (npc.state === 'stand' && this._waitTimer > this._nextFidget) {
      this._nextFidget = this._waitTimer + 10 + Math.random() * 10;
      setState(npc, 'loiter', 'wait_fidget');
      npc.stateDur = 4 + Math.random() * 4;
    } else if (npc.state === 'loiter' && npc.stateTimer >= npc.stateDur) {
      setState(npc, 'stand', 'wait_resume');
      npc.stateDur = Infinity;
    }
    return true;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    const npc  = this.participants[0]?.npc;
    const stop = this._stop;

    if (this._endReason !== 'boarding') {
      if (stop) {
        stop._waiters       = stop._waiters.filter(n => n !== npc);
        stop._boardingQueue = (stop._boardingQueue ?? []).filter(n => n !== npc);
      }
      if (npc && npc.alive) {
        npc.mem('social').waitingBusStop = null;
        npc.mem('social').boardingBus    = null;
        if (this._endReason === 'wait_timeout') {
          setWalkMode(npc, null);
          setState(npc, 'walk', 'wait_timeout');
        }
      }
    }
    // boarding: waitingBusStop / boardingBus kept until NPC despawns at door
    super.destroy();
  }
}
