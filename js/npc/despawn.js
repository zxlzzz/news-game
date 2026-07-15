/**
 * despawnNpc — единственная точка записи npc.alive = false для пешеходов.
 *
 * Вызовы:
 *   BaseStateMachine._routeToExit → onArrive   (покидает сцену через край/дверь)
 *   WaitForBusLayer._startBoarding → onArrive  (садится в автобус)
 *
 * Ресурсный аудит (C1.1):
 *   leash       — каскад: dog.alive = false при смерти владельца (ctx.entities)
 *   modifier    — NpcPropManager.getDrawables() фильтрует !prop.npc.alive; _props остаются
 *   slot        — SocialLayer.update() очищает слоты мёртвых NPC в следующем тике
 *   bench       — standUp() всегда вызывается до alive=false через sit_bench.onExit;
 *                 вызов ниже защищает нестандартные пути
 *   bus queue   — _startBoarding.onArrive сам фильтрует stop._boardingQueue
 */

import { dlog } from '../behavior/DebugLog.js';
import { standUp } from '../entity/seat/seat.js';

/**
 * @param {NPC}    npc
 * @param {string} reason  — метка для отладки
 * @param {object} [ctx]
 * @param {Array}  [ctx.entities]  — em.entities (для каскада поводка)
 */
export function despawnNpc(npc, reason, ctx = {}) {
  if (!npc.alive) return;
  dlog(`[despawn] id=${npc.id} reason=${reason}`);
  npc.alive = false;

  // Leash cascade: если у кого-то leashTarget === этот NPC → тоже умирает
  if (ctx.entities) {
    for (const e of ctx.entities) {
      if (e !== npc && e.alive && e.leashTarget === npc) {
        e.alive = false;
      }
    }
  }

  // Defensive bench release (нормальный путь: sit_bench.onExit→standUp до alive=false)
  const sc = npc.mem('social');
  if (sc?.bench) standUp(npc);
}
