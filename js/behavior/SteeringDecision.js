/**
 * SteeringDecision — 到达裁决表（Steering 层唯一距离判定住址）
 *
 * 铁律（goal-pipeline-v1.md §2 铁律②③）：
 *   同层同职责的规则必须共存于该层唯一的决策文件，以声明式表格表达。
 *   距离比较只能出现在决策文件中；调用方只传测量值收布尔值。
 *
 * 迁移来源：behavior-redundancy-2026-07.md 责任1（到达判定）A~H 条目。
 */

// 到达裁决表（U-2：threshold 改骨架单位，消费时乘 npc.scale——原世界像素值与
// y 无关，同一条规则在远/近侧的实际宽松度相差可达 1.75 倍，见 U-2 commit）。
// 每行：threshold（骨架单位） | 语义 | 理由 | 迁移来源（审计责任1 行号）
export const ARRIVAL_RULES = {
  nav_waypoint:           { threshold: 30,  reason: 'navPath 中间路点推进（骨架单位，消费时乘 scale）',                                src: '责任1-C' },
  walk_goal:              { threshold: 23,  reason: 'walk 分支终点，比路点紧防过早 onArrive（骨架单位，消费时乘 scale）',         src: '责任1-D' },
  bench_radius:           { threshold: 305, reason: '长椅"已在附近"半径，语义非到达点（骨架单位，消费时乘 scale）',                    src: '责任1-G/H' },
  exit_building:          { threshold: 76,  reason: '楼门离场判宽，与 routing_final_building 对齐（骨架单位，消费时乘 scale）',        src: 'N3-a' },
  exit_offworld:          { threshold: 30,  reason: '边缘离场距离兜底；主要到达判据为 npc.x < 0 || > WORLD_WIDTH（骨架单位，消费时乘 scale）', src: 'N3-a' },
};

/** 距离判定唯一出口：调用方只传 ruleId、测量值（世界像素）、scale，收布尔值。
 *  threshold 是骨架单位，本函数内部乘 scale 换算成世界像素再比较——调用方不得
 *  自行预乘，也不得省略 scale（U-2：缺失就是配置错误，不给默认值）。 */
export function arrived(ruleId, dist, scale) {
  return dist < ARRIVAL_RULES[ruleId].threshold * scale;
}
