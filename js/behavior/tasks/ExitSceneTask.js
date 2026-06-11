/**
 * ExitSceneTask — 等待 NPC 离场完成（triggerDeparture 由 BehaviorManager 调用）
 *
 * 作为 primary 占位，防止 Agenda 在 NPC 离场途中分配新目标。
 * 本 task 不直接驱动移动；triggerDeparture 设置 routing 状态，BSM 负责路径跟踪。
 */

export class ExitSceneTask {
  onStart(_npc, _runner) {}

  tick(npc, _dt) {
    return npc.alive ? null : 'done';
  }

  onAbort(_npc) {}
  onInterrupt(_npc) {}
  onResume(_npc) {}
}
