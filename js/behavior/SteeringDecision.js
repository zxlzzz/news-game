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
//
// M-1b（走路卡死修复，2026-08-07）：nav_waypoint / walk_goal 的世界像素宽容度
// （threshold × npc.scale）不得超过 NavGrid.js 的 NPC_HALF_W（Minkowski 障碍物
// 外扩安全边；O-1 前为 7px），否则"判到达"允许 NPC 停在比规划假设更靠近障碍物的
// 位置——路点本身是安全格心（外扩边保证的），但松弛容差可能让 NPC 实际落点比
// 格心更贴边，贴到刚好卡进障碍物凸出边缘的程度，导致下一腿"整向被挡+单轴也被
// 挡"卡死（只剩垂直让行分支能动，原地小步来回抖，直到 goal 超时才解脱）。human
// 骨架最大 npc.scale ≈ 0.369（旧版随 y 变化的景深缩放坡峰值 0.434 × skeletonScale
// 0.85，PARK_BOTTOM 深度），故两条 threshold 按 7 / 0.369 ≈ 19 封顶，留出余量定为
// 16 / 14（原 30 / 23，实测偏大——最大 scale 下分别越界到 11.1px / 8.5px，
// 均超过 7px 安全边）。
// O-1 后记：该缩放坡已删除，npc.scale 现恒等于 skeletonScale（不再随 y 变化，
// human 固定 0.85），上述"封顶"推导的前提已不成立；NPC_HALF_W 也已改为 37
// （骨架单位，随 CELL 10→53 等比重标）。按新前提重算：16 骨架单位 × scale 0.85
// = 13.6，14 × 0.85 = 11.9，均 < 37，新安全边比旧安全边更宽松，未发现"对不上"
// （即未发现现有 threshold 在新单位下会越界），故未改动数值——仅记录前提已变，
// 供后续如需重新校准安全边时参考。
export const ARRIVAL_RULES = {
  nav_waypoint:           { threshold: 16,  reason: 'navPath 中间路点推进（骨架单位，消费时乘 scale；封顶见上方 M-1b 注记，7/scale_max≈19）',   src: '责任1-C' },
  walk_goal:              { threshold: 14,  reason: 'walk 分支终点，比路点紧防过早 onArrive（骨架单位，消费时乘 scale；封顶见上方 M-1b 注记）', src: '责任1-D' },
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
