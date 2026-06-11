/**
 * SocialLayer — 社交 / Activity 统一模型
 *
 * Activity 是多个 NPC（+道具）共同参与的高层行为单元（对话/下棋/遛狗…）。
 * 加入 Activity 的 NPC 被"锁定"（npc._activity 置位），BehaviorManager 跳过其
 * 基础状态机，由 Activity 全权驱动；释放后归还给 BaseStateMachine。
 *
 * Activity 类型通过 registerActivity（ActivityRegistry.js）注册工厂。
 * 各 Activity 文件 import registerActivity 并自注册；SocialLayer 负责 side-effect import。
 * createActivity 查 REGISTRY['*'] 为通配符兜底（UsePropActivity）。
 */

import { setState }       from './BaseStateMachine.js';
import { dlog }           from './DebugLog.js';
import { getRegistry }    from './ActivityRegistry.js';
import { TalkToTask }     from './tasks/TalkToTask.js';
export { registerActivity } from './ActivityRegistry.js';

// Side-effect imports：触发各 Activity 文件的 registerActivity 自注册
import './activities/TalkActivity.js';
import './activities/ChessActivity.js';
import './activities/DogWalkActivity.js';
import './activities/StallActivity.js';
import './activities/UsePropActivity.js';

// poseCache 初始化入口（由 SocialLayer 构造函数转发到各 Activity 模块）
import { initSubEventPoses } from './activities/TalkActivity.js';
import { initGestureClips }  from './activities/UsePropActivity.js';
import { initStallGestures } from './activities/StallActivity.js';

const chance = (p) => Math.random() < p;

// ─── SocialLayer 管理器 ───────────────────────────────────────────────────────
export class SocialLayer {
  /** @param {EnvironmentQuery} envQuery @param {object} poseCache */
  constructor(envQuery, poseCache) {
    this.envQuery = envQuery;
    this.activities = [];
    this.talkScanTimer = 0;
    this._idSeq = 0;
    this.lastScanInfo = { standers: 0, paired: 0 };

    if (poseCache) {
      initSubEventPoses(poseCache.sub_event      || {});
      initGestureClips(poseCache.gesture         || {});
      initStallGestures(poseCache.stall_gestures || {});
    }
  }

  update(npcs, dt) {
    // 1) tick 所有活跃 Activity；结束的 destroy
    for (let i = this.activities.length - 1; i >= 0; i--) {
      const act = this.activities[i];
      const alive = act.alive && act.update(dt);
      if (!alive) {
        dlog(`[Activity ${act.label}] destroyed(reason=${act._endReason})`);
        act.destroy();
        this.activities.splice(i, 1);
      }
    }

    // 2) 周期性尝试配对新的 TalkActivity
    this.talkScanTimer += dt;
    if (this.talkScanTimer >= 0.8) {
      this.talkScanTimer = 0;
      this._tryPairTalk(npcs);
    }

    // 3) 槽位等待超时（20s 内无第二个人到位） → 放弃，重新 walk
    //    死亡 NPC 的槽位也必须回收（不跳过 !alive）
    for (const npc of npcs) {
      if (!npc._slotWaitProp) continue;
      if (!npc.alive) {
        for (const s of npc._slotWaitProp._slots) {
          if (s.npc === npc) { s.ready = false; s.npc = null; }
        }
        this.envQuery.releaseSlotReservation(npc);
        npc._slotWaitProp = null;
        continue;
      }
      if (npc._activity) continue;
      npc._slotWaitTimer = (npc._slotWaitTimer || 0) + dt;
      if (npc._slotWaitTimer > 20) {
        for (const s of npc._slotWaitProp._slots) {
          if (s.npc === npc) { s.ready = false; s.npc = null; }
        }
        this.envQuery.releaseSlotReservation(npc);
        npc._slotWaitProp = null;
        setState(npc, 'walk', 'slot_wait_timeout');
      }
    }
  }

  // 外部触发：创建指定类型的 Activity
  createActivity(type, participants, props = []) {
    const id = ++this._idSeq;
    const REGISTRY = getRegistry();
    const entry = REGISTRY[type] ?? REGISTRY['*'];
    const act = entry ? entry.factory(id, participants, props, type) : null;
    if (act) {
      this.activities.push(act);
      dlog(`[Activity ${act.label}] created`);
    }
    return act;
  }

  // 外部触发：打断某个 Activity
  interruptActivity(activityId, reason) {
    const act = this.activities.find(a => a.id === activityId);
    if (act) act.interrupt(reason);
  }

  /** Smart Object 槽位到达：优先用注册项的 onSlotArrival 钩子，否则走默认多槽凑齐逻辑 */
  onSlotArrival(npc, prop, slot) {
    slot.ready = true;
    slot.npc   = npc;
    const type  = prop.smartDef.activityType;
    const entry = getRegistry()[type];

    if (entry?.onSlotArrival) {
      entry.onSlotArrival(npc, prop, slot, this);
      return;
    }

    // 默认（单/多槽）：凑齐所有槽位即创建 Activity，否则原地站等
    const allReady = prop._slots.every(s => s.ready);
    if (allReady) {
      const participants = prop._slots.map(s => ({ npc: s.npc, role: s.role }));
      this.createActivity(type, participants, [prop]);
      for (const s of prop._slots) { s.reserved = null; s.ready = false; s.npc = null; }
    } else {
      setState(npc, 'stand', 'slot_wait');
      npc.stateDur       = Infinity;
      npc._slotWaitTimer = 0;
      npc._slotWaitProp  = prop;
    }
  }

  _abandonSlot(npc, slot, reason) {
    slot.reserved = null;
    slot.ready    = false;
    slot.npc      = null;
    setState(npc, 'walk', reason);
  }

  _tryPairTalk(npcs) {
    const standers = npcs.filter(n =>
      n.alive && !n._activity && !n._departing && n.state === 'stand' &&
      n._profile && n._profile.activities.includes('talk'));
    let paired = 0;
    for (let i = 0; i < standers.length; i++) {
      for (let j = i + 1; j < standers.length; j++) {
        const a = standers[i], b = standers[j];
        if (a._activity || b._activity) continue;
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        if (dx < 70 && dx > 14 && dy < 24 && chance(0.5)) {
          const act = this.createActivity('talk', [{ npc: a, role: 'speaker' }, { npc: b, role: 'speaker' }]);
          if (act) {
            a._runner?.setPrimary(new TalkToTask(), a);
            b._runner?.setPrimary(new TalkToTask(), b);
          }
          paired++;
        }
      }
    }
    this.lastScanInfo = { standers: standers.length, paired };
  }
}
