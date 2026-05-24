/**
 * OverlayLayer — 叠加动作层（如 phone_look）
 *
 * 对未被 Activity 锁定的 NPC 每帧 tick：依据 profile.overlays 配置决定
 * 哪些叠加动作可用、兼容哪些基础状态、触发概率与持续时长。
 * 本次只置/清 npc.overlay 标志，视觉表现由后续肢体代码实现。
 */

const rand   = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

export function tickOverlay(npc, profile, dt) {
  const defs = profile.overlays || {};

  // 已有叠加动作：状态不兼容则立即清除，否则倒计时
  if (npc.overlay) {
    const def = defs[npc.overlay];
    if (!def || !def.on.includes(npc.state)) { npc.overlay = null; return; }
    npc._overlayTimer -= dt;
    if (npc._overlayTimer <= 0) npc.overlay = null;
    return;
  }

  // 无叠加动作：按各 overlay 的兼容状态与概率尝试触发
  for (const name in defs) {
    const def = defs[name];
    if (def.on.includes(npc.state) && chance(def.chance)) {
      npc.overlay = name;
      npc._overlayTimer = rand(def.dur[0], def.dur[1]);
      break;
    }
  }
}
