/**
 * DebugLog — 行为系统结构化日志（console）
 *
 * 用 localStorage.setItem('npc-debug', '1') 开启，默认关闭。
 * 与 D 键的可视 overlay 相互独立：overlay 看实时状态，日志看事件流水。
 *
 * 注意：behavior 模块在 Node 单测里也会被 import，故访问 localStorage 需做存在性判断。
 */

let _cache = null;   // null=未探测；true/false=已探测结果

export function debugEnabled() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('npc-debug') === '1';
  } catch {
    return false;
  }
}

/** 每帧开头由调度器调用一次，缓存当帧开关，避免反复读 localStorage */
export function refreshDebugFlag() {
  _cache = debugEnabled();
  return _cache;
}

export function dlog(...args) {
  const on = _cache !== null ? _cache : debugEnabled();
  if (on) console.log(...args);
}
