/**
 * despawnNpc — 行人 `npc.alive = false` 的唯一写入点。
 *
 * 调用方：
 *   BaseStateMachine._routeToExit → onArrive   (332，经边缘/楼门离场)
 *   WaitForBusLayer._startBoarding → onArrive  (143，上公交车)
 *
 * 资源审计（C1.1）：
 *   leash       — 级联：主人死亡时其 leash 跟随者一并 alive = false（走 ctx.entities）
 *   modifier    — NpcPropManager.getDrawables() 过滤 !prop.npc.alive；_props 本身保留
 *   slot        — SocialLayer.update() 在下一 tick 清理死亡 NPC 占的槽位
 *   bench       — 正常路径下 standUp() 经 sit_bench.onExit 在 alive=false 之前就调过了；
 *                 下面那次调用只是防护非常规路径
 *   bus queue   — _startBoarding.onArrive 自行过滤 stop._boardingQueue
 */

import { dlog } from '../behavior/DebugLog.js';
import { standUp } from '../entity/seat/seat.js';

/**
 * @param {NPC}    npc
 * @param {string} reason  — 调试标签
 * @param {object} [ctx]
 * @param {Array}  [ctx.entities]  — em.entities（供绳索级联遍历）
 */
export function despawnNpc(npc, reason, ctx = {}) {
  if (!npc.alive) return;
  dlog(`[despawn] id=${npc.id} reason=${reason}`);
  npc.alive = false;

  // 绳索级联：谁的 leashTarget === 该 NPC → 一并死亡
  if (ctx.entities) {
    for (const e of ctx.entities) {
      if (e !== npc && e.alive && e.leashTarget === npc) {
        e.alive = false;
      }
    }
  }

  // 防御性座位释放（正常路径：sit_bench.onExit → standUp 早于 alive=false）
  const sc = npc.mem('social');
  if (sc?.bench) standUp(npc);
}
