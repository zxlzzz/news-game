/**
 * SocialLayer — 社交 / Activity 统一模型
 *
 * Activity 是多个 NPC（+道具）共同参与的高层行为单元（对话/下棋/遛狗…）。
 * 加入 Activity 的 NPC 被"锁定"（npc._activity 置位），BehaviorManager 跳过其
 * 基础状态机，由 Activity 全权驱动；释放后归还给 BaseStateMachine。
 *
 * Activity 类型通过 registerActivity（ActivityRegistry.js）注册工厂。
 * 各 Activity 文件 import registerActivity 并自注册；SocialLayer 负责 side-effect import。
 *
 * Patch A：单人道具使用（trash/vending）已收口进 UseSmartPropTask，不再走 Activity；
 * REGISTRY 不再有 '*' 通配符兜底，createActivity 查不到 type 时返回 null。
 */

import { setState }       from './Motor.js';
import { dlog }           from './DebugLog.js';
import { getRegistry }    from './ActivityRegistry.js';
import { TalkToTask }     from './tasks/TalkToTask.js';
export { registerActivity } from './ActivityRegistry.js';

// Side-effect imports：触发各 Activity 文件的 registerActivity 自注册
import './activities/TalkActivity.js';
import './activities/ChessActivity.js';
import './activities/StallActivity.js';
import './activities/ContactActivity.js';

// poseCache 初始化入口（由 SocialLayer 构造函数转发到各 Activity 模块）
import { initTalkGestures }  from './activities/TalkActivity.js';
import { initStallGestures } from './activities/StallActivity.js';
import { initChessMove }     from './activities/ChessActivity.js';
import { initSubEventPoses } from './activities/ContactActivity.js';

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
      initStallGestures(poseCache.stall_gestures || {});
      initTalkGestures(poseCache.talk_gestures   || {});
      initChessMove(poseCache.chess_move ?? null);
    }
  }

  update(npcs, dt) {
    // 1) tick 所有活跃 Activity；结束的 destroy；声明了 handoff() 的紧接着创建后继
    for (let i = this.activities.length - 1; i >= 0; i--) {
      const act = this.activities[i];
      const alive = act.alive && act.update(dt);
      if (!alive) {
        dlog(`[Activity ${act.label}] destroyed(reason=${act._endReason})`);
        act.destroy();
        this.activities.splice(i, 1);
        if (act._followUp) {
          const { type, participants, meta } = act._followUp;
          const next = this.createActivity(type, participants, [], meta);
          // 这个循环从数组尾部往前走，本帧新 push 的 next 排在更靠后的下标，
          // 不会被这一轮 for 再扫到——立刻补一次 tick，避免它平白等到下一帧
          // 才开始播（旧版子事件是同一帧内联执行，这里补齐同等时效）。
          next?.update(dt);
        }
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
      if (!npc.mem('social').slotWaitProp) continue;
      if (!npc.alive) {
        for (const s of npc.mem('social').slotWaitProp._slots) {
          if (s.npc === npc) { s.ready = false; s.npc = null; }
        }
        this.envQuery.releaseSlotReservation(npc);
        npc.mem('social').slotWaitProp = null;
        continue;
      }
      if (npc.mem('social').activity) continue;
      npc.mem('social').slotWaitTimer = (npc.mem('social').slotWaitTimer || 0) + dt;
      if (npc.mem('social').slotWaitTimer > 20) {
        for (const s of npc.mem('social').slotWaitProp._slots) {
          if (s.npc === npc) { s.ready = false; s.npc = null; }
        }
        this.envQuery.releaseSlotReservation(npc);
        npc.mem('social').slotWaitProp = null;
        setState(npc, 'walk', 'slot_wait_timeout');
      }
    }
  }

  // 外部触发：创建指定类型的 Activity。meta 原样透传给工厂第 5 参
  // （ActivityRegistry.js 头部注释），供 'contact' 这类"一个 type 对应多条
  // clip"的场景区分具体播哪条——如 ContactActivity 用 meta.clip。
  createActivity(type, participants, props = [], meta) {
    const id = ++this._idSeq;
    const entry = getRegistry()[type];
    const act = entry ? entry.factory(id, participants, props, type, meta) : null;
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
      npc.mem('social').slotWaitTimer = 0;
      npc.mem('social').slotWaitProp  = prop;
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
      n.alive && !n.mem('social').activity && !n.mem('agenda').departing && n.state === 'stand' &&
      n.mem('agenda').profile && n.mem('agenda').profile.activities.includes('talk'));
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
            a.mem('agenda').runner?.setPrimary(new TalkToTask(), a);
            b.mem('agenda').runner?.setPrimary(new TalkToTask(), b);
          }
          paired++;
        }
      }
    }
    this.lastScanInfo = { standers: standers.length, paired };
  }
}
