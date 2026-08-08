import { setState }          from '../Motor.js';
import { Activity }          from './Activity.js';
import { ClipPlayer }        from '../ClipPlayer.js';
import { registerActivity }  from '../ActivityRegistry.js';
import { TalkToTask }        from '../tasks/TalkToTask.js';
import { StallSellerTask }   from '../tasks/StallSellerTask.js';
import { getStallGestures } from '../data/StallPoseStore.js';
import { emitEvent }         from '../WorldEventLog.js';

const rand   = (a, b) => a + Math.random() * (b - a);

export class StallActivity extends Activity {
  /**
   * prop-as-host（Patch H）：卖家独自守摊已挪去 StallSellerTask（ChainTask，
   * 不再是 Activity），本类只在**买家已经到位**时才由 onSlotArrival 钩子
   * Create——roster 从一开始就是满的，不存在 `buyer:null` 的降级 Drive。
   */
  constructor(id, seller, buyer, buyerSlot, prop) {
    super(id, 'stall');
    this.requiredRoster = 2;
    this.seller    = seller;
    this.buyer     = buyer;
    this.buyerSlot = buyerSlot;
    this.prop      = prop;
    this.admit(seller, 'seller');
    this.admit(buyer, 'buyer');
    this.occupy(prop);
    prop._stallActivity = this;

    this._sellerPlayer = new ClipPlayer(seller, '_stall');
    this._giving           = false;
    this._sellerGivePlayer = null;
    this._done              = false;

    this._buyerPhase  = 'point';
    this._buyerTimer  = 0;
    this._buyerDur    = rand(2, 4);
    this._buyerPlayer = new ClipPlayer(buyer, '_stall_buyer');
    this._buyerPlayer.play(getStallGestures().buyer_point);
    buyer.mem('social').tags = ['transaction', 'shopping'];

    seller.direction = (buyer.x >= seller.x) ? 1 : -1;
    buyer.direction  = (seller.x >= buyer.x) ? 1 : -1;
  }

  /** Admit（②）— seller/buyer 共用同一入口，按 role 分派各自的初始姿势配置。 */
  admit(npc, role) {
    super.admit(npc, role);
    if (role === 'seller') {
      setState(npc, 'stand', 'stall-setup');
      npc.modifiers  = npc.modifiers.filter(m => m.kind === 'trait');
      npc.mem('social').tags = ['vendor'];
    } else if (role === 'buyer') {
      setState(npc, 'stand', 'stall-buyer-setup');
      npc.modifiers = npc.modifiers.filter(m => m.kind === 'trait');
    }
  }

  update(dt) {
    if (!this.seller.alive || !this.buyer.alive || this._done) return false;

    if (this._giving) {
      if (this._sellerGivePlayer) this._sellerGivePlayer.update(dt);
    } else {
      this._sellerPlayer.update(dt);
    }
    this._tickBuyer(dt);
    return !this._done;
  }

  _tickBuyer(dt) {
    this._buyerTimer += dt;

    if (this._buyerPhase === 'point') {
      this._buyerPlayer.update(dt);
      if (this._buyerTimer >= this._buyerDur) {
        this._buyerPhase       = 'give';
        this._giving           = true;
        this._sellerGivePlayer = new ClipPlayer(this.seller, '_stall');
        this._sellerGivePlayer.play(getStallGestures().seller_give);
        this._buyerPlayer.play(getStallGestures().buyer_give_get);
      }
    } else if (this._buyerPhase === 'give') {
      this._buyerPlayer.update(dt);
      const sDone = !this._sellerGivePlayer || this._sellerGivePlayer.done;
      if (this._buyerPlayer.done && sDone) {
        this._done = true;
        // 交易完成点（P-4）：两个 ClipPlayer 都播完 'give' 阶段那一刻。同 P-3，
        // 一场交易只发一次，不需要像 chess_move 那样降频。
        emitEvent({
          kind: 'stall_trade', actors: [this.seller.id, this.buyer.id],
          x: (this.seller.x + this.buyer.x) / 2, y: (this.seller.y + this.buyer.y) / 2,
        });
      }
    }
  }

  interrupt(reason) { super.interrupt(reason); }

  /**
   * End（⑤）— 买家走了 = 整场交易结束，不再像旧版那样让 Activity 带着
   * `buyer:null` 继续跑降级 Drive（那正是 prop-as-host 要消灭的模式）。
   * 卖家存活且摊位还在，就重新交回一个 StallSellerTask，回到"独自守摊"态，
   * 等下一个买家把它顶替回来——对称于 Create 侧"roster 满才 Create"。
   */
  destroy() {
    if (this._buyerPlayer)      this._buyerPlayer.clear();
    if (this._sellerGivePlayer) this._sellerGivePlayer.clear();
    if (this._sellerPlayer)     this._sellerPlayer.clear();
    if (this.buyer.alive) this.buyer.mem('social').tags = null;
    if (this.prop) this.prop._stallActivity = null;

    if (this.seller.alive) {
      const sellerSlot = this.prop?.alive && this.prop._slots.find(s => s.role === 'seller');
      const runner      = this.seller.mem('agenda').runner;
      if (sellerSlot && runner) {
        runner.setPrimary(new StallSellerTask(this.prop, sellerSlot), this.seller);
      } else {
        setState(this.seller, 'walk', 'activity-end');
      }
    }

    super.destroy();
  }
}

registerActivity('stall', (id, participants, props) => {
  const seller = participants.find(p => p.role === 'seller')?.npc;
  const buyer  = participants.find(p => p.role === 'buyer')?.npc;
  if (!seller || !buyer) return null; // roster 满才 Create（prop-as-host）
  return new StallActivity(id, seller, buyer, null, props[0]);
}, {
  /**
   * 只有买家会走到这里——卖家独占守摊已改走 StallSellerTask，不再经
   * onSlotArrival（见 sceneFeatures.js#stall_sellers）。买家路由目前仍是
   * 已知空缺（同旧版注记："stall_buyer 仍待迁移，暂无 buyer 路由"，见
   * BehaviorManager.js 头注释），本钩子只保证"万一以后接上买家路由"时
   * 行为是对的：找到正在守摊的 StallSellerTask 就顶替它、起真正的双人
   * StallActivity；找不到就放弃这轮（摊上没人张罗，买家走开）。
   */
  onSlotArrival(npc, prop, slot, socialLayer) {
    const sellerTask = prop._stallSellerTask;
    if (sellerTask && sellerTask.npc?.alive) {
      const seller = sellerTask.npc;
      const act = socialLayer.createActivity('stall',
        [{ npc: seller, role: 'seller' }, { npc, role: 'buyer' }], [prop]);
      if (act) seller.mem('agenda').runner?.setPrimary(new TalkToTask(), seller);
      else socialLayer._abandonSlot(npc, slot, 'stall_create_failed');
    } else {
      socialLayer._abandonSlot(npc, slot, 'stall_no_seller');
    }
  },
});
