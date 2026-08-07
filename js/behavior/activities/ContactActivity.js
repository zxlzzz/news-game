/**
 * ContactActivity — 双人接触互动（Patch G，D1/D3/D5：`push`/`give_item`/
 * `handshake`/`point_at` 从 TalkActivity 抽出，成为独立、场合无关的 Activity）
 *
 * 只管一件事：驱动一个 DuetStager 把 poseCache.sub_event 里的某条 clip 播完，
 * 期间发生的 join/dismiss/emit 归 Activity 层管，编排（位置插值+关节步进）
 * 全权交给 DuetStager。当前唯一触发方是 TalkActivity 的子事件掷骰
 * （见 TalkActivity.js 的 handoff），但本身不依赖 Talk——设计文档 D5 的目标
 * 是"场合无关，任何场合可消费"，未来"走路中牵手"一类新触发方可以直接
 * `socialLayer.createActivity('contact', participants, [], {clip:'xxx'})`，
 * 不需要先进 Talk。
 *
 * Admit：不 override 基类——DuetStager 的 reach 阶段会从"当前姿势"（不管是
 * 说话手势、走路帧、还是别的）平滑过渡到接触姿势第 0 帧，join 时清空/重置
 * modifier 反而会破坏这个平滑过渡，所以刻意什么都不做，直接用基类的
 * join-only 版本。
 */

import { setState }         from '../Motor.js';
import { Activity }         from './Activity.js';
import { registerActivity } from '../ActivityRegistry.js';
import { emitEvent }        from '../WorldEventLog.js';
import { DuetStager }       from '../DuetStager.js';

// poseCache.sub_event 完整配置源（frames/roles/sustain/designGap/reach/release，
// 外加可选 ejectRole）——TalkActivity 的掷骰也读这份表，见该文件的
// `import { getSubEventPoses } from './ContactActivity.js'`。
let SUB_EVENT_POSES = {};

export function initSubEventPoses(poses) {
  SUB_EVENT_POSES = poses || {};
}

export function getSubEventPoses() {
  return SUB_EVENT_POSES;
}

export class ContactActivity extends Activity {
  /**
   * @param {number} id
   * @param {[{npc:object,role:string},{npc:object,role:string}]} participants
   * @param {string} clipType  SUB_EVENT_POSES 的 key（如 'handshake'/'push'）
   */
  constructor(id, participants, clipType) {
    super(id, 'contact');
    this.requiredRoster = 2;
    this.clipType = clipType;

    const cfg = SUB_EVENT_POSES[clipType];
    const { npc: a, role: roleA } = participants[0];
    const { npc: b, role: roleB } = participants[1];
    this.a = a; this.b = b;
    this.admit(a, roleA);
    this.admit(b, roleB);

    emitEvent({
      kind: clipType, actors: [a.id, b.id],
      x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
    });

    this._stager = new DuetStager(a, roleA, b, roleB, cfg, (npc, otherNpc, effect) => this._onEject(npc, otherNpc, effect));
  }

  update(dt) {
    if (!this.a.alive || !this.b.alive) return false;
    return this._stager.tick(dt);
  }

  /** DuetStager 命中 clip 声明的 ejectRole 时回调（如 push.json 让 victim 提前退场）。 */
  _onEject(npc, otherNpc, effect) {
    this.release(npc);
    this.participants = this.participants.filter(p => p.npc !== npc);
    if (npc.alive) setState(npc, effect.toState, 'contact-eject');
    if (effect.emitKind) {
      emitEvent({ kind: effect.emitKind, actors: [otherNpc.id, npc.id], x: npc.x, y: npc.y });
    }
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    this._stager.cancel();
    for (const { npc } of this.participants) {
      if (npc.alive) setState(npc, 'walk', 'activity-end');
    }
    super.destroy();
  }
}

registerActivity('contact', (id, participants, props, type, meta) =>
  new ContactActivity(id, participants, meta?.clip));
