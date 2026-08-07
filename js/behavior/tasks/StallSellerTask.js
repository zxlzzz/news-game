/**
 * StallSellerTask — 摊主独自守摊/叫卖（prop-as-host，Patch H）
 *
 * 阶段：'goto' → 'hawking'（无自然终点，常驻直到被买家顶替或摊主死亡）
 *   goto    : 导航到摊位 seller 槽；多次失败落位兜底（原 sceneFeatures.js
 *             #stall_sellers 的 publishGoal 重试+teleport 逻辑逐字迁入）。
 *   hawking : setState('stand')+stateDur=Infinity 挂住，ClipPlayer 循环播
 *             seller_tidy/seller_call（原 StallActivity 无买家时的 Drive 逐字迁入）。
 *
 * 买家到位时（StallActivity.js 的 onSlotArrival 钩子）直接
 * socialLayer.createActivity('stall', [seller,buyer], [prop]) 起真正的双人
 * StallActivity，再用 runner.setPrimary(new TalkToTask(), seller) 顶替本 task——
 * TaskRunner.setPrimary 会自动调用本 task 的 onAbort() 收尾清理，不需要本文件
 * 自己实现"被顶替"的分支（同 SocialLayer#_tryPairTalk 配对 TalkActivity 时的
 * 既有模式）。交易结束后 StallActivity.destroy() 会重新 new 一个本 task 把卖家
 * 交回来，摊主由此回到"独自守摊"态，不会把整场交易的 Activity 长期挂着跑
 * 部分-roster 的降级 Drive。
 *
 * prop._stallSellerTask 是买家到位时查找"这个摊有没有人守着"的唯一住址——
 * hawking 阶段开始时写入，onAbort/task 自身终止时清空。
 */

import { GotoTask }         from './GotoTask.js';
import { setState, setXY }  from '../Motor.js';
import { ClipPlayer }       from '../ClipPlayer.js';
import { getStallGestures } from '../data/StallPoseStore.js';

const rand   = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

export class StallSellerTask {
  /** @param {object} prop @param {object} slot - prop._slots 里 role==='seller' 的那个 */
  constructor(prop, slot) {
    this._prop    = prop;
    this._slot    = slot;
    this._phase   = 'init';
    this._goto    = null;
    this._retries = 0;
    this._player  = null;
    this.npc      = null; // hawking 阶段开始后指向自己 —— 供买家到位时读取
  }

  onStart(npc, runner) {
    runner?.hold(this._slot);
    this._startGoto(npc);
    this._phase = 'goto';
  }

  _startGoto(npc) {
    this._goto = new GotoTask(
      { x: this._prop.x + this._slot.dx, y: this._prop.y + this._slot.dy },
      { timeout: 60 },
    );
    this._goto.onStart(npc, null);
  }

  tick(npc, dt) {
    switch (this._phase) {
      case 'goto': {
        if (!npc.alive) return 'done';
        const r = this._goto.tick(npc, dt);
        if (r === 'abort') {
          if (this._retries < 2) {
            this._retries++;
            this._startGoto(npc);
            return null;
          }
          // 兜底：多次导航失败直接落位，保证摊位不空摊。
          setXY(npc, this._prop.x + this._slot.dx, this._prop.y + this._slot.dy);
          this._slot.reserved = null;
          this._beginHawking(npc);
          this._phase = 'hawking';
          return null;
        }
        if (r === 'done') {
          this._slot.reserved = null;
          this._beginHawking(npc);
          this._phase = 'hawking';
        }
        return null;
      }

      case 'hawking': {
        if (!npc.alive) { this._cleanup(); return 'done'; }
        this._player.update(dt);
        this._switchTimer += dt;
        if (this._switchTimer >= this._switchAt) {
          this._switchTimer = 0;
          this._switchAt = rand(4, 8);
          this._pickClip();
        }
        return null;
      }

      default: return 'done';
    }
  }

  _beginHawking(npc) {
    npc.minY = this._prop.y - 24;
    npc.maxY = this._prop.y + 24;
    setState(npc, 'stand', 'stall-seller-wait');
    npc.stateDur  = Infinity;
    npc.modifiers = npc.modifiers.filter(m => m.kind === 'trait');
    npc.mem('social').tags = ['vendor'];

    this._player       = new ClipPlayer(npc, '_stall');
    this._switchTimer   = 0;
    this._switchAt      = rand(4, 8);
    this._pickClip();

    this.npc = npc;
    this._prop._stallSellerTask = this;
  }

  _pickClip() {
    this._player.play(getStallGestures()[chance(0.5) ? 'seller_tidy' : 'seller_call']);
  }

  _cleanup() {
    this._player?.clear();
    if (this._prop._stallSellerTask === this) this._prop._stallSellerTask = null;
  }

  onAbort(npc) {
    if (this._phase === 'goto') { this._goto?.onAbort(npc); return; }
    if (this._phase === 'hawking') this._cleanup();
    // state/tags 交给顶替者处理（买家到位 → StallActivity.admit 会重设；
    // 摊主死亡 → BehaviorManager 自然清理），本函数不做多余 setState('walk')。
  }

  onInterrupt(npc) { if (this._phase === 'goto') this._goto?.onAbort(npc); }

  onResume(npc) {
    if (this._phase !== 'hawking') { this._phase = 'init'; this.onStart(npc, null); }
  }
}
