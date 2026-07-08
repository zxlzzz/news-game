/**
 * CyclistSpawner — 非机动车道动态出入场管理器
 *
 * 参考 VehicleSpawner 的密度控制思路，管理两条非机动车道上的骑手（自行车 / 电动车）：
 *   FAR  车道：dir +1（上行），坐落远端非机动车道
 *   NEAR 车道：dir -1（下行），坐落近端非机动车道
 *
 * 骑手是 NPC（makeNPC 创建，drawExtra 画车），不进 BehaviorManager；
 * 由本类每帧维持密度 + 剔除驶出对侧边界的骑手（alive=false，渲染层按 alive 过滤）。
 *
 * 车型权重：自行车 3、电动车（外卖）2。
 * 绘制函数 drawBicycle / drawEbike 保留在 Vehicles.js，经构造参数注入。
 */

import { makeNPC }     from '../../npc/npcUtil.js';
import { bikeLaneFarY, bikeLaneNearY, WORLD_WIDTH } from '../../core/Layout.js';

const rand = (a, b) => a + Math.random() * (b - a);

// 出入场边界（屏幕外）：进入点在一侧屏外，剔除点在对侧屏外
const ENTRY_PAD = 60;
const CULL_PAD  = 50;

const LANES = [
  { id: 'far',  direction: +1, yFn: bikeLaneFarY,  target: 2 },
  { id: 'near', direction: -1, yFn: bikeLaneNearY, target: 2 },
];

// 车型权重（自行车 3、电动车 2）
const WEIGHTS = { bicycle: 3, ebike: 2 };

export class CyclistSpawner {
  /**
   * @param {object} opts
   * @param {EntityManager} opts.em
   * @param {StickRenderer} opts.sr
   * @param {{ bicycle: Function, ebike: Function }} opts.draw  - drawExtra 绘制函数
   */
  constructor({ em, sr, draw }) {
    this.em       = em;
    this.sr       = sr;
    this.draw     = draw;
    this.cyclists = [];     // 本类生成的骑手（用于密度统计 + 剔除）
    this._timer   = 0;
  }

  /** 场景初始化：将骑手分散铺满两条车道 */
  spawnInitial() {
    for (const lane of LANES) {
      for (let i = 0; i < lane.target; i++) {
        const x = ((i + 0.5) / lane.target) * WORLD_WIDTH;
        this._spawn(lane, x);
      }
    }
  }

  /** 每帧调用（delta ms）：剔除越界骑手 + 不足时从入口补充 */
  update(delta) {
    // 1) 标记已驶出对侧边界的骑手 alive=false（EntityManager 的 draw/update/getAlive
    //    均按 alive 过滤，等价于从渲染中移除；与 TrafficManager.removeVehicle 一致）
    for (const c of this.cyclists) {
      if (!c.alive) continue;
      if ((c.direction > 0 && c.x > WORLD_WIDTH + CULL_PAD) ||
          (c.direction < 0 && c.x < -CULL_PAD)) {
        c.alive = false;
      }
    }
    this.cyclists = this.cyclists.filter(c => c.alive);

    // 2) 定时密度检查（2~4s），不足 target 时从入口边缘补充
    this._timer -= delta;
    if (this._timer > 0) return;
    this._timer = 2000 + Math.random() * 2000;

    for (const lane of LANES) {
      const count = this.cyclists.filter(c => c.alive && c.direction === lane.direction).length;
      if (count < lane.target && Math.random() < 0.5) {
        const entryX = lane.direction > 0 ? -ENTRY_PAD : WORLD_WIDTH + ENTRY_PAD;
        this._spawn(lane, entryX);
      }
    }
  }

  _pickKind() {
    const total = WEIGHTS.bicycle + WEIGHTS.ebike;
    return (Math.random() * total < WEIGHTS.bicycle) ? 'bicycle' : 'ebike';
  }

  _spawn(lane, x) {
    const kind  = this._pickKind();
    const yFn   = lane.yFn;
    const speed = kind === 'ebike' ? rand(110, 130) : rand(95, 120);
    const n = makeNPC(this.em, this.sr, {
      x, y: yFn(0.5),
      animation: kind === 'ebike' ? 'mobile' : 'bike',
      direction: lane.direction, speed, vy: 0,
      minX: -100000, maxX: 100000,
      minY: yFn(0.05), maxY: yFn(0.95),
      tags: kind === 'ebike' ? ['delivery', 'e-bike', 'vehicle'] : ['cyclist', 'vehicle'],
    });
    n.drawExtra  = kind === 'ebike' ? this.draw.ebike : this.draw.bicycle;
    n.steadyFoot = true;
    this.cyclists.push(n);
    return n;
  }
}
