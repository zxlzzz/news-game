/** 卡死探针:每 2s 扫描,归类冻结 NPC,30s 打一次汇总。window.__stuck 可看明细 */
import { getNavGrid } from './nav/NavGrid.js';
import { audit } from '../debug/MovementAudit.js';

const last = new Map();          // id → {x, y}
let acc = 0, sumAcc = 0;
const tally = new Map();         // 类别 → count
window.__stuck = [];


export function stuckProbe(npcs, dt) {
  acc += dt; sumAcc += dt;
  if (acc < 2) return;
  acc = 0;
  window.__stuck.length = 0;

  const grid = getNavGrid();
  for (const n of npcs) {
    if (!n.alive) { last.delete(n.id); continue; }
    const p = last.get(n.id);
    last.set(n.id, { x: n.x, y: n.y });
    if (!p) continue;
    const moved = Math.hypot(n.x - p.x, n.y - p.y);

    let cat = null;
    const mot = n.mem('motor');
    const sc  = n.mem('social');
    const m   = mot.walkMode;
    if (sc.waitingBusStop && moved < 8) {
      cat = `WAIT:${n.state}`;                     // 公交等待者单列，不入 MOVE
    } else if (['walk', 'run', 'jog'].includes(n.state) && moved < 8) {
      cat = `MOVE:${n.state}/${m?.kind ?? 'nomode'}`;
    } else if (n.stateDur < Infinity && n.stateTimer > n.stateDur + 10) {
      cat = `STATE:${n.state}`;                    // 转换没触发
    } else if (n.mem('social').activity && moved < 8 && n.stateTimer > 60) {
      const act = n.mem('social').activity;
      cat = `ACT:${act.type}/${act.subState}`;
    } else if (n.stateDur === Infinity && !n.mem('social').activity && moved < 8
               && n.stateTimer > 45 && !['loiter','chess','chess_onlooker','jog'].includes(n.state)) {
      cat = `INF:${n.state}`;                      // 无限时长态滞留
    }
    if (!cat) continue;

    tally.set(cat, (tally.get(cat) ?? 0) + 1);

    // WAIT 类仅计 tally，不进 window.__stuck 明细
    if (cat.startsWith('WAIT:')) continue;

    const { gx, gy } = grid ? grid.worldToCell(n.x, n.y) : {};
    const info = {
      id: n.id, cat, at: [n.x | 0, n.y | 0],
      cell: grid ? grid.cost(gx, gy) : '?',
      st: `${n.state} ${n.stateTimer | 0}/${n.stateDur === Infinity ? '∞' : n.stateDur | 0}`,
      mode: m ? `${m.kind} el=${(m._elapsed ?? 0) | 0}/${m.abandonAfter ?? m.maxDuration ?? '-'}` : null,
      roam: n.roamTarget ? [n.roamTarget.x | 0, n.roamTarget.y | 0] : null,
      act: sc.activity?.type ?? null,
      anim: `${n.animation} done=${n.animDone}`,
      dir: n.direction,
      wait:  !!sc.waitingBusStop,
      board: !!sc.boardingBus,
      nb:    npcs.reduce((k, o) => k + (o !== n && o.alive && Math.hypot(o.x - n.x, o.y - n.y) < 30 ? 1 : 0), 0),
      bounds: [n.minX | 0, n.maxX | 0, n.minY | 0, n.maxY | 0],
      hasGoal:     !!mot.goal,
      pathIdx:     mot.path?.idx ?? null,
      pathLen:     mot.path?.pts.length ?? null,
      goalElapsed: mot.goal?.elapsed != null ? (mot.goal.elapsed | 0) : null,
      flips:       mot._obsFlipVx ?? 0,   // P-1: vx 符号翻转次数（探针窗口=2s）
    };
    mot._obsFlipVx = 0;   // 读取后归零（2s 探针窗口）

    window.__stuck.push(info);
    if (!cat.startsWith('ACT:')) audit.count(n, 'stuck');
  }

  if (sumAcc >= 30) {
    sumAcc = 0;
    console.log('[StuckProbe] 30s 汇总:', Object.fromEntries([...tally].sort((a, b) => b[1] - a[1])));
    console.log('[StuckProbe] 当前卡死明细:', window.__stuck);
    tally.clear();
  }
}
