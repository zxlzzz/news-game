/**
 * TalkToTask — 占住 primary 槽，等 TalkActivity 自然结束
 *
 * SocialLayer._tryPairTalk 创建 TalkActivity（设 npc._activity）后，
 * 同时向双方 runner 提交本 task。当 Activity.destroy() 清零 npc._activity 时，
 * 本 task 返回 'done'，Agenda 在下一帧重新选目标。
 *
 * BehaviorManager 在 _activity 检查之前先 tick runner，确保本 task 能运行。
 */

export class TalkToTask {
  onStart(_npc, _runner) {}

  tick(npc, _dt) {
    return npc.mem('social').activity ? null : 'done';
  }

  onAbort(_npc)    {}
  onInterrupt(_npc) {}
  onResume(_npc)   {}
}
