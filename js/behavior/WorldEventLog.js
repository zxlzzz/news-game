/**
 * WorldEventLog — 世界事件流水账
 *
 * CONTRACT:
 *   WRITES: 内部数组 `_events`；`emitEvent()` 是唯一写入点。
 *   READS:  `getEvents()`/`clearEvents()` 提供读取口，但目前暂无消费者——
 *           本模块是 W-1 纯记录地基，感知/信念层（Perception.js 的下游，见
 *           docs/design-plans/witness-memory-v1.md）尚未接线到这里。只记录，
 *           不消费，接入本模块不改变任何现有行为。
 *   MUST NOT: 任何模块绕过 emitEvent() 直接 push 进 `_events`。
 *
 * kind 必须是 EventDefs.js#EVENT_DEFS 里声明过的键，未声明直接抛错——
 * 避免事件类型悄悄漂移出声明表却没人发现（同项目其余"配置缺失即抛错"惯例）。
 *
 * 已知限制（留给接入消费者的批次一并处理，此刻不预先设计）：`_events` 无上限
 * 增长，无过期/裁剪机制。
 */

import { EVENT_DEFS } from './data/EventDefs.js';
import { gameClock } from '../core/GameClock.js';

const _events = [];
let _idSeq = 0;

/** {kind, actors, x, y} → 追加一条 {id, kind, actors[], x, y, t} 记录 */
export function emitEvent({ kind, actors, x, y }) {
  if (!EVENT_DEFS[kind]) throw new Error(`WorldEventLog: unknown event kind '${kind}'`);
  const ev = { id: `evt_${++_idSeq}`, kind, actors: [...actors], x, y, t: gameClock() };
  _events.push(ev);
  return ev;
}

export function getEvents()   { return _events; }
export function clearEvents() { _events.length = 0; }
