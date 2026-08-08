/**
 * StallBuyerTask — 走到摊位的 buyer 槽位，到达后交给 SocialLayer.onSlotArrival
 *
 * 补上 tasks.md P-4 说的悬空路由：'stall_buyer' 早就在 NpcProfile.js 的
 * activities 数组里声明、StallActivity 的 onSlotArrival 钩子也早就写好了
 * "买家到位就凑满 roster 创建双人 StallActivity"，唯独没有任何东西真的把
 * 买家送到那个槽位——本 task 就是那个东西。
 *
 * 形状抄 UseSmartPropTask 的 goto 阶段（GotoTask 导航到槽位坐标），区别只在
 * 到达之后的处理：UseSmartPropTask 到达后自己播一段单人手势（_beginUsing），
 * 本任务到达后不演任何动作，直接把控制权交给 SocialLayer.onSlotArrival——
 * 是否成局（摊位上有没有 StallSellerTask 守着）、真正的买卖动画怎么播，
 * 全归 StallActivity 的 onSlotArrival 钩子决定，这里只负责"把人正确地送到"。
 *
 * 只挑摊位当前有人守着（`prop._stallSellerTask?.npc?.alive`）的 role:'buyer'
 * 槽——空摊子没有交易对象，不值得走过去。这个判据不能借 findAvailableSlot 的
 * requireOccupied 选项（它查的是 `prop._occupiedBy`，是 UseSmartPropTask
 * 用于 vending/trash 的单人占用标记，StallSellerTask 从不写这个字段，误用会
 * 让 requireOccupied:true 在 stall 上恒为空），所以在拿到候选槽之后另外核实
 * 一次——跟 onSlotArrival 钩子（StallActivity.js）核实的是同一个字段，只是
 * 提前在这里挡一道，避免买家白跑一趟空摊子。
 *
 * 依赖 envQuery.socialLayer（BehaviorManager 构造时挂上，见该文件构造函数
 * 里 `this.envQuery.socialLayer = this.socialLayer` 那行的注释）。
 */

import { GotoTask } from './GotoTask.js';

export class StallBuyerTask {
  /** @param {EnvironmentQuery} envQuery */
  constructor(envQuery) {
    this._envQuery = envQuery;
    this._phase    = 'init';
    this._goto     = null;
    this._prop     = null;
    this._slot     = null;
    this._runner   = null;
  }

  onStart(npc, runner) {
    this._runner = runner;

    const found = this._envQuery.findAvailableSlot('stall', npc, 250, { role: 'buyer' });
    if (!found || !found.prop._stallSellerTask?.npc?.alive) { this._phase = 'abort'; return; }

    const { prop, slot } = found;
    slot.reserved = npc.id;
    this._prop = prop;
    this._slot = slot;

    // 登记 holdings：中断/顶替时 runner 自动清 reserved（同 UseSmartPropTask 的做法）
    runner?.hold(slot);

    this._goto = new GotoTask({ x: prop.x + slot.dx, y: prop.y + slot.dy }, { timeout: 30 });
    this._goto.onStart(npc, null);
    this._phase = 'goto';
  }

  tick(npc, dt) {
    switch (this._phase) {
      case 'abort': return 'abort';

      case 'goto': {
        const r = this._goto.tick(npc, dt);
        if (r === 'abort') return 'abort';   // runner releases slot via holdings
        if (r === 'done') {
          // 槽位已消费：清 reserved（同 UseSmartPropTask），交给 onSlotArrival 接手，
          // 它可能成局（roster 凑满 → StallActivity）也可能放弃（_abandonSlot）——
          // 两条路径都是终态，本 task 到这里就算完成，不再关心后续。
          this._slot.reserved = null;
          this._envQuery.socialLayer.onSlotArrival(npc, this._prop, this._slot);
          this._phase = 'done';
          return 'done';
        }
        return null;
      }

      default: return 'done';
    }
  }

  onAbort(npc) {
    if (this._phase === 'goto') this._goto?.onAbort(npc);
  }

  onInterrupt(npc) {
    if (this._phase === 'goto') this._goto?.onAbort(npc);
  }

  onResume(npc) {
    if (this._phase !== 'done') {
      this._phase = 'init';
      this.onStart(npc, this._runner);
    }
  }
}
