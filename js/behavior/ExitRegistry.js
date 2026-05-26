/**
 * ExitRegistry — 场景出口注册表
 *
 * 每个 ExitPoint 描述一个 NPC 可以离开场景的位置。
 * 所有出口在场景初始化时通过 register() 注册，
 * BehaviorManager 的离场逻辑读取它来为每个 NPC 选择合适的出口。
 *
 * 可扩展：后续加静止车辆、建筑门洞、地铁入口，
 * 只需注册新的 ExitPoint，不改核心离场逻辑。
 *
 * ExitPoint 结构：
 * {
 *   id:       'edge_left',   // 唯一标识
 *   type:     'edge',        // 'edge' | 'building' | 'vehicle'（未来扩展）
 *   x:        -30,           // 目标 X（到达后消失）
 *   y:        null,          // null = 使用 NPC 当前 Y；固定值 = 建筑/载具出口
 *   yZone:    [minY, maxY],  // NPC 的 Y 需在此范围内才能使用；null = 全场通用
 *   facing:   -1,            // NPC 朝向：-1=向左, 1=向右, 0=不改变
 * }
 */

export class ExitRegistry {
  constructor() {
    this._exits = [];
  }

  register(exitPoint) {
    this._exits.push(exitPoint);
  }

  /**
   * 为某 NPC 找一个合适的出口：
   * 1. 过滤 yZone 包含 npc.y 的出口
   * 2. 若 preferType 非空则优先匹配
   * 3. 从候选里随机选一个
   * 返回出口对象，或 null（无合适出口）
   */
  findExit(npc, preferType = null) {
    const candidates = this._exits.filter(e => {
      if (!e.yZone) return true;
      return npc.y >= e.yZone[0] && npc.y <= e.yZone[1];
    });
    if (candidates.length === 0) return null;
    const preferred = preferType
      ? candidates.filter(e => e.type === preferType)
      : [];
    const pool = preferred.length > 0 ? preferred : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
