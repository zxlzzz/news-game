/**
 * WaitBusTask — 公交站等车（单人 ChainTask，Patch C 选项二：从 Activity 移出）
 *
 * 调用方保证 NPC 到达本 task 时已经站在候车区内（`WaitForBusLayer._scanForWaiters`
 * 的区域判定 / `ExitSceneTask` 的 `isInWaitZone` 判定），本 task 不含 goto 阶段，
 * `onStart` 直接进入等待：stand/loiter 交替 + 120s 超时自弃（原 `WaitBusActivity`
 * 的 fidget/timeout 逻辑逐字迁入）。
 *
 * 公交到站时（`WaitForBusLayer#_startBoarding`）直接
 * `runner.setPrimary(new GotoTask(...走向车门...), npc, cb)` 顶替本 task——
 * `TaskRunner.setPrimary` 自动调用本 task 的 `onAbort()`，不需要另开"被顶替"分支
 * （同 Patch H `StallSellerTask` 被买家到位顶替时的既有模式）。`onAbort` 靠
 * `npc.mem('social').boardingBus` 是否已被 `_startBoarding` 设置来判断"是不是
 * 正在上车"——是则 `waitingBusStop`/state 交给上车流程接管，不做多余清理；不是
 * 则按"等待被取消"正常清理、恢复 walk（例如 `ExitSceneTask` 因寿命到期改道，或
 * npc 中途死亡）。
 */
import { setState } from '../Motor.js';

const MAX_WAIT_TIME = 120;

export class WaitBusTask {
  /** @param {object} stop - BusStop 实例（`stop._waiters` 数组的唯一 owner 之一，另一 owner 见 WaitForBusLayer） */
  constructor(stop) {
    this._stop       = stop;
    this._waitTimer  = 0;
    this._nextFidget = 10 + Math.random() * 10;
  }

  onStart(npc, _runner) {
    this._stop._waiters.push(npc);
    npc.mem('social').waitingBusStop = this._stop;
    setState(npc, 'stand', 'wait_bus');
    npc.stateDur = Infinity;
  }

  tick(npc, dt) {
    if (!npc.alive) return 'done';

    this._waitTimer += dt;
    if (this._waitTimer > MAX_WAIT_TIME) {
      this._stop._waiters = this._stop._waiters.filter(n => n !== npc);
      npc.mem('social').waitingBusStop = null;
      setState(npc, 'walk', 'wait_timeout');
      return 'abort';
    }

    if (npc.state === 'stand' && this._waitTimer > this._nextFidget) {
      this._nextFidget = this._waitTimer + 10 + Math.random() * 10;
      setState(npc, 'loiter', 'wait_fidget');
      npc.stateDur = 4 + Math.random() * 4;
    } else if (npc.state === 'loiter' && npc.stateTimer >= npc.stateDur) {
      setState(npc, 'stand', 'wait_resume');
      npc.stateDur = Infinity;
    }
    return null;
  }

  /** 被顶替时调用（boarding 顶替 / 寿命到期改道 / 其它中断）。自然超时不经这里，见 tick()。 */
  onAbort(npc) {
    this._stop._waiters = this._stop._waiters.filter(n => n !== npc);
    if (npc.mem('social').boardingBus) return; // 正在上车：交给 _startBoarding 接管
    if (npc.alive) {
      npc.mem('social').waitingBusStop = null;
      setState(npc, 'walk', 'wait_bus_abort');
    }
  }

  onInterrupt(_npc) {}
  onResume(_npc) {}
}
