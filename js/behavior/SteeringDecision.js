/**
 * SteeringDecision — 到达裁决表（Steering 层唯一距离判定住址）
 *
 * 铁律（goal-pipeline-v1.md §2 铁律②③）：
 *   同层同职责的规则必须共存于该层唯一的决策文件，以声明式表格表达。
 *   距离比较只能出现在决策文件中；调用方只传测量值收布尔值。
 *
 * 迁移来源：behavior-redundancy-2026-07.md 责任1（到达判定）A~H 条目。
 */

// 到达裁决表
// 每行：threshold | 语义 | 理由 | 迁移来源（审计责任1 行号）
export const ARRIVAL_RULES = {
  routing_final_building: { threshold: 20, reason: '楼门出口判宽，防贴墙抖动',                            src: '责任1-A' },
  routing_final:          { threshold: 8,  reason: 'routing 终点默认',                                    src: '责任1-A' },
  route_waypoint:         { threshold: 8,  reason: 'routePts 中间路点推进',                               src: '责任1-B' },
  nav_waypoint:           { threshold: 8,  reason: 'navPath 中间路点推进',                                src: '责任1-C' },
  walk_goal:              { threshold: 6,  reason: 'walk 分支终点，比路点紧 2px 防过早 onArrive',         src: '责任1-D' },
  corner_cut:             { threshold: 2,  reason: 'nextTarget 角切，极紧，raycast 兜底',                 src: '责任1-E' },
  bench_radius:           { threshold: 80, reason: '长椅"已在附近"半径，语义非到达点',                    src: '责任1-G/H' },
  exit_building:          { threshold: 20, reason: '楼门离场判宽，与 routing_final_building 对齐',        src: 'N3-a' },
  exit_offworld:          { threshold: 8,  reason: '边缘离场距离兜底；主要到达判据为 npc.x < 0 || > WORLD_WIDTH', src: 'N3-a' },
};

/** 距离判定唯一出口：调用方只传 ruleId 和测量值，收布尔值。 */
export function arrived(ruleId, dist) {
  return dist < ARRIVAL_RULES[ruleId].threshold;
}
