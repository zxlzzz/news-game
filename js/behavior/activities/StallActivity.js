import { setState }         from '../BaseStateMachine.js';
import { Activity }         from './Activity.js';
import { ClipPlayer }       from '../ClipPlayer.js';
import { registerActivity } from '../ActivityRegistry.js';

const rand   = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

let STALL_GESTURES = {};

export function initStallGestures(gestures) {
  STALL_GESTURES = gestures || {};
}

export class StallActivity extends Activity {
  constructor(id, seller, prop) {
    super(id, 'stall');
    this.seller    = seller;
    this.prop      = prop;
    this.buyer     = null;
    this.buyerSlot = null;
    this.join(seller, 'seller');
    this.occupy(prop);
    prop._stallActivity = this;

    this._setupSeller(seller);
    this._sellerPlayer = new ClipPlayer(seller, '_stall');
    this._sellerSwitch = rand(4, 8);
    this._sellerTimer  = 0;
    this._pickSellerClip();

    this._giving           = false;
    this._sellerGivePlayer = null;
  }

  _setupSeller(npc) {
    setState(npc, 'stand', 'stall-setup');
    npc.modifiers  = npc.modifiers.filter(m => m.kind === 'trait');
    npc.mem('social').tags = ['vendor'];
  }

  _pickSellerClip() {
    this._sellerPlayer.play(STALL_GESTURES[chance(0.5) ? 'seller_tidy' : 'seller_call']);
  }

  addBuyer(npc, slot) {
    if (this.buyer) return false;
    this.buyer     = npc;
    this.buyerSlot = slot;
    this.join(npc, 'buyer');
    this._setupBuyer(npc);

    this._buyerPhase  = 'point';
    this._buyerTimer  = 0;
    this._buyerDur    = rand(2, 4);
    this._buyerPlayer = new ClipPlayer(npc, '_stall_buyer');
    this._buyerPlayer.play(STALL_GESTURES.buyer_point);
    npc.mem('social').tags = ['transaction', 'shopping'];

    this.seller.direction = (npc.x >= this.seller.x) ? 1 : -1;
    npc.direction         = (this.seller.x >= npc.x) ? 1 : -1;
    return true;
  }

  _setupBuyer(npc) {
    setState(npc, 'stand', 'stall-buyer-setup');
    npc.modifiers = npc.modifiers.filter(m => m.kind === 'trait');
  }

  update(dt) {
    if (!this.seller.alive) return false;

    if (this._giving) {
      if (this._sellerGivePlayer) this._sellerGivePlayer.update(dt);
    } else {
      this._sellerPlayer.update(dt);
      this._sellerTimer += dt;
      if (this._sellerTimer >= this._sellerSwitch) {
        this._sellerTimer  = 0;
        this._sellerSwitch = rand(4, 8);
        this._pickSellerClip();
      }
    }

    if (this.buyer) this._tickBuyer(dt);
    return true;
  }

  _tickBuyer(dt) {
    if (!this.buyer.alive) { this._endBuyer(false); return; }
    this._buyerTimer += dt;

    if (this._buyerPhase === 'point') {
      this._buyerPlayer.update(dt);
      if (this._buyerTimer >= this._buyerDur) {
        this._buyerPhase       = 'give';
        this._giving           = true;
        this._sellerGivePlayer = new ClipPlayer(this.seller, '_stall');
        this._sellerGivePlayer.play(STALL_GESTURES.seller_give);
        this._buyerPlayer.play(STALL_GESTURES.buyer_give_get);
      }
    } else if (this._buyerPhase === 'give') {
      this._buyerPlayer.update(dt);
      const sDone = !this._sellerGivePlayer || this._sellerGivePlayer.done;
      if (this._buyerPlayer.done && sDone) this._endBuyer(true);
    }
  }

  _endBuyer(walkAway) {
    const b = this.buyer;
    if (this._buyerPlayer)      this._buyerPlayer.clear();
    if (this._sellerGivePlayer) { this._sellerGivePlayer.clear(); this._sellerGivePlayer = null; }
    this._giving = false;

    if (this.buyerSlot) {
      this.buyerSlot.reserved = null;
      this.buyerSlot.ready    = false;
      this.buyerSlot.npc      = null;
    }
    if (b) {
      b.mem('social').tags = null;
      this.release(b);
      this.participants = this.participants.filter(p => p.npc !== b);
      if (walkAway && b.alive) setState(b, 'walk', 'stall-done');
    }
    this.buyer     = null;
    this.buyerSlot = null;

    this._sellerTimer  = 0;
    this._sellerSwitch = rand(4, 8);
    this._pickSellerClip();
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    if (this._buyerPlayer)      this._buyerPlayer.clear();
    if (this._sellerGivePlayer) this._sellerGivePlayer.clear();
    if (this._sellerPlayer)     this._sellerPlayer.clear();
    if (this.buyer && this.buyer.alive) setState(this.buyer, 'walk', 'stall-interrupt');
    if (this.seller.alive) this.seller.mem('social').tags = null;
    if (this.prop) this.prop._stallActivity = null;
    super.destroy();
  }
}

registerActivity('stall', (id, participants, props) => {
  const seller = participants.find(p => p.role === 'seller')?.npc;
  if (!seller) return null;
  return new StallActivity(id, seller, props[0]);
}, {
  onSlotArrival(npc, prop, slot, socialLayer) {
    if (slot.role === 'seller') {
      npc.minY = prop.y - 24;
      npc.maxY = prop.y + 24;
      socialLayer.createActivity('stall', [{ npc, role: 'seller' }], [prop]);
    } else {
      const act = prop._stallActivity;
      if (act && act.alive && !act.buyer) act.addBuyer(npc, slot);
      else socialLayer._abandonSlot(npc, slot, 'stall_no_seller');
    }
  },
});
