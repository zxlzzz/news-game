import { setState }         from '../Motor.js';
import { Activity }         from './Activity.js';
import { ClipPlayer }       from '../ClipPlayer.js';
import { registerActivity } from '../ActivityRegistry.js';
import { emitEvent }        from '../WorldEventLog.js';

const CHESS_WAIT_MS = 3500;

// 每次回合切换（一次落子完成）时以此概率发一条 chess_move 事件。刻意调低：
// 一局棋回合切换数十次，每回合都发会把 EVENT_LOG_CAP=500 的流水账刷爆、
// 也会让证词管线被下棋淹没——目标是平均约十回合出一条，让"这盘棋在下"
// 偶尔被目击到即可，不需要逐手记录。
const CHESS_EVENT_PROB = 0.1;

// 落子手势（poseCache.chess_move，见 PoseCacheBuilder 的 chess 特例）——单条 clip，
// 覆盖全身 11 个关节，落到 ClipPlayer 的 '_chess_move' modifier 上会完全盖住
// STATE_DEFS.chess 自身的基座动画，因此 setState(npc,'chess',...) 仍然保留
// （StuckProbe / getTags 等系统认 npc.state，不认这条 modifier）。
let CHESS_MOVE = null;

export function initChessMove(clip) {
  CHESS_MOVE = clip;
}

export class ChessActivity extends Activity {
  constructor(id, players, props) {
    super(id, 'chess');
    this.requiredRoster = 2;
    this.a = players[0];
    this.b = players[1];
    this.table = props[0] || null;
    this.admit(this.a, 'player_a');
    this.admit(this.b, 'player_b');
    for (const p of props) this.occupy(p);

    this.subState = 'playing';
    this.active   = 'A';
    this.waiting  = false;
    this.waitMs   = 0;

    // 双方各持一个 ClipPlayer：当前落子的一方每帧 update() 播完即冻结在末帧；
    // 等待的一方 play() 后不再 update()，天然停在首帧（原 freezeAt0 语义）。
    this._aPlayer = new ClipPlayer(this.a, '_chess_move');
    this._bPlayer = new ClipPlayer(this.b, '_chess_move');
    this._aPlayer.play(CHESS_MOVE);
    this._bPlayer.play(CHESS_MOVE);
  }

  admit(npc, role) {
    super.admit(npc, role);
    setState(npc, 'chess', 'chess-setup');
  }

  update(dt) {
    if (!this.a.alive || !this.b.alive) return false;
    const curPlayer = this.active === 'A' ? this._aPlayer : this._bPlayer;
    curPlayer.update(dt);

    if (!this.waiting && curPlayer.done) {
      this.waiting = true;
      this.waitMs  = 0;
    }
    if (this.waiting) {
      this.waitMs += dt * 1000;
      if (this.waitMs >= CHESS_WAIT_MS) {
        this.waiting = false;
        // 刚落子的一方是切换前的 this.active；actors 第一位是落子方，第二位对手。
        if (Math.random() < CHESS_EVENT_PROB) {
          const mover    = this.active === 'A' ? this.a : this.b;
          const opponent = this.active === 'A' ? this.b : this.a;
          emitEvent({ kind: 'chess_move', actors: [mover.id, opponent.id], x: mover.x, y: mover.y });
        }
        this.active  = this.active === 'A' ? 'B' : 'A';
        // 双方都从头播：新落子方接下来会被 update() 逐帧推进；新等待方
        // 就此停在首帧，直到轮到它。
        this._aPlayer.play(CHESS_MOVE);
        this._bPlayer.play(CHESS_MOVE);
      }
    }
    return true;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    this._aPlayer.clear();
    this._bPlayer.clear();
    for (const { npc } of this.participants) {
      if (npc.alive) setState(npc, 'walk', 'activity-end');
    }
    super.destroy();
  }
}

registerActivity('chess', (id, participants, props) => {
  const players = participants.filter(p => p.role.startsWith('player')).map(p => p.npc);
  return new ChessActivity(id, players, props);
});
