/**
 * GameClock — 虚拟游戏时钟（全局单例）
 *
 * 默认速度：1 实秒 = 1 游戏分钟（speed=1.0）
 * 即 1 实分 = 1 游戏时，60× 加速。
 * 起始时间：8:00，24 小时回绕。
 *
 * API：
 *   clockUpdate(dt)   — 每帧推进（dt=实秒）
 *   gameClock()       — 当前十进制小时（8.0 = 8:00）
 *   gameHour()        — 整数小时
 *   gameMinute()      — 整数分钟 0-59
 *   gameTimeStr()     — 格式化 "HH:MM"
 *   setClockSpeed(s)  — 调速（1.0=默认，2.0=双倍速）
 *   setGameTime(h)    — 直接设定时间（调试用）
 */

let _hours = 8.0;
let _speed = 1.0;   // 游戏分钟/实秒；1.0 = 1 实分→1 游戏时

export function clockUpdate(dt) {
  _hours = (_hours + dt * _speed / 60) % 24;
}

export function gameClock()  { return _hours; }
export function gameHour()   { return Math.floor(_hours); }
export function gameMinute() { return Math.floor((_hours % 1) * 60); }

export function gameTimeStr() {
  const h = String(gameHour()).padStart(2, '0');
  const m = String(gameMinute()).padStart(2, '0');
  return `${h}:${m}`;
}

export function setClockSpeed(s) { _speed = Math.max(0.01, s); }
export function setGameTime(h)   { _hours = ((h % 24) + 24) % 24; }
