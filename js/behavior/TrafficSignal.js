/**
 * TrafficSignal — 红绿灯 stub
 * 现在永远返回绿灯。将来在 update() 里实现计时切换。
 */
export class TrafficSignal {
  constructor(cfg) {
    this.x     = cfg.x;
    this.state = 'green'; // 'green' | 'yellow' | 'red'
  }

  getState() { return this.state; }

  update(delta) {
    // TODO: 将来在这里实现红绿灯计时
  }
}
