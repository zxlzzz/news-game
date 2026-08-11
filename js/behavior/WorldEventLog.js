/**
 * WorldEventLog — 世界事件流水账
 *
 * CONTRACT:
 *   WRITES: 内部数组 `_events`；`emitEvent()` 是唯一写入点。
 *   READS:  `drainNewEvents()` 是唯一的读取点——返回自上次调用以来的新事件
 *           并把游标移到数组末尾。
 *   MUST NOT: 任何模块绕过 emitEvent() 直接 push 进 `_events`；任何模块绕过
 *             drainNewEvents() 自行维护"我读到哪了"的游标。
 *
 * kind 必须是 EventDefs.js#EVENT_DEFS 里声明过的键，未声明直接抛错——
 * 避免事件类型悄悄漂移出声明表却没人发现（同项目其余"配置缺失即抛错"惯例）。
 *
 * EVENT_LOG_CAP 是 `_events` 长度上限的唯一住址：超限从数组头部裁剪最旧的
 * 事件。裁剪与游标的对齐关系——`_drainCursor -= 裁剪数量`（钳制到 0）——
 * 保证「已经被 drainNewEvents() 读走的事件」在裁剪后不会被重新读到：裁剪只
 * 从头部移除，游标始终指向"数组当前内容里第一条未读事件"的位置，裁剪把
 * 数组和游标一起等量前移，相对关系不变；游标被钳到 0 的情况意味着那些被
 * 裁掉的事件本来就还没被读过（连同游标一起被"追平"），不会误标成已读。
 */

import { EVENT_DEFS } from './data/EventDefs.js';
import { gameClock } from '../core/GameClock.js';

const EVENT_LOG_CAP = 500;

const _events = [];
let _idSeq = 0;
let _drainCursor = 0;

/** {kind, actors, x, y} → 追加一条 {id, kind, actors[], x, y, t} 记录 */
export function emitEvent({ kind, actors, x, y }) {
  if (!EVENT_DEFS[kind]) throw new Error(`WorldEventLog: unknown event kind '${kind}'`);
  const ev = { id: `evt_${++_idSeq}`, kind, actors: [...actors], x, y, t: gameClock() };
  _events.push(ev);

  if (_events.length > EVENT_LOG_CAP) {
    const overflow = _events.length - EVENT_LOG_CAP;
    _events.splice(0, overflow);
    _drainCursor = Math.max(0, _drainCursor - overflow);
  }

  return ev;
}

/** 自上次调用以来的新事件；唯一游标推进点 */
export function drainNewEvents() {
  const fresh = _events.slice(_drainCursor);
  _drainCursor = _events.length;
  return fresh;
}
