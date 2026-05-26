/**
 * OverlayLayer — 叠加动作层
 *
 * 对未被 Activity 锁定的 NPC 每帧 tick，依据 profile.overlays 决定：
 *   - 随机 overlay：phone_look / phone_call / smoke / cross_arm
 *       · 仅在兼容基础状态触发；smoke 需 npc._traits.smoker；
 *       · chanceMultiplier 按当前状态放大概率（如靠墙抽烟更自然）。
 *       · 若 overlay 定义含 pose 字段，自动写入 npc.overlayPose 产生视觉效果。
 *   - 持久特征 overlay：hold_bag（profile 标 persistent:true）
 *       · 不随机触发/消失，由 spawner 给 npc.persistentOverlay 赋值；
 *       · 没有其它 overlay 占用且当前状态兼容时回退显示。
 */

const rand   = (a, b) => a + Math.random() * (b - a);

function traitOK(npc, def) {
  if (!def.traitRequired) return true;
  return !!(npc._traits && npc._traits[def.traitRequired]);
}

function clearOverlay(npc, def) {
  if (def && def.pose) npc.overlayPose = null;
  npc.overlay = null;
}

export function tickOverlay(npc, profile, dt) {
  const defs = profile.overlays || {};
  const persistent = npc.persistentOverlay || null;

  // 1) 处理当前活跃的「随机」overlay 计时（持久 overlay 不计时）
  if (npc.overlay && npc.overlay !== persistent) {
    const def = defs[npc.overlay];
    if (!def || !def.on.includes(npc.state)) {
      clearOverlay(npc, def);
    } else {
      npc._overlayTimer -= dt;
      if (npc._overlayTimer <= 0) clearOverlay(npc, def);
    }
  }

  // 2) 当前无随机 overlay（可能只挂着持久的）→ 尝试触发新的随机 overlay
  if (!npc.overlay || npc.overlay === persistent) {
    for (const name in defs) {
      const def = defs[name];
      if (def.persistent) continue;
      if (!def.on.includes(npc.state)) continue;
      if (!traitOK(npc, def)) continue;
      let p = def.chance;
      if (def.chanceMultiplier && def.chanceMultiplier[npc.state]) p *= def.chanceMultiplier[npc.state];
      if (Math.random() < p) {
        npc.overlay = name;
        npc._overlayTimer = rand(def.dur[0], def.dur[1]);
        if (def.pose) npc.overlayPose = def.pose;
        break;
      }
    }
  }

  // 3) 持久 overlay 回退：无随机 overlay 且当前状态兼容时显示 hold_bag
  if (!npc.overlay && persistent) {
    const def = defs[persistent];
    if (def && def.on.includes(npc.state)) npc.overlay = persistent;
  }
}
