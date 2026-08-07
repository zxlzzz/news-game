/**
 * Activity 基类 — 多 NPC 共同参与的高层行为单元
 *
 * 五 phase 契约（docs/contracts/activity-lifecycle-v1.md）：
 *   ① Create  — 子类构造函数：存引用、声明 requiredRoster，对每个初始成员调用 admit()。
 *   ② Admit   — admit(npc, role)：成员入场配置的唯一入口，初始成员与后期加入者共用。
 *               base 版只做 join（roster 记账）；子类 override 时 super.admit() 打底，
 *               再补 setState / 清 modifier / 设 tag 等姿势配置。
 *   ③ Drive   — update(dt)：每帧推进，子类实现。
 *   ④ Dismiss — dismiss(npc, reason)：放走一个成员、activity 本体继续活的唯一入口。
 *               base 版：release + participants 摘除 + （存活时）setState('walk')；
 *               子类 override 时先做自己的槽位清理，再 super.dismiss()。
 *   ⑤ End     — destroy()：整体散场，自然结束（update→false）/ interrupt / 参与者死亡
 *               三个入口都汇到这里。
 */
import { setState } from '../Motor.js';

export class Activity {
  constructor(id, type) {
    this.id = id;
    this.type = type;
    this.participants = [];
    this.occupiedProps = [];
    this.timer = 0;
    this.subState = 'init';
    this.alive = true;
    this._endReason = 'natural';
    this.requiredRoster = 0; // 子类构造函数中声明所需成员数
  }

  get label() { return `${this.type}#${this.id}`; }

  roleOf(npc) {
    const p = this.participants.find(p => p.npc === npc);
    return p ? p.role : null;
  }

  join(npc, role) {
    this.participants.push({ npc, role });
    npc.mem('social').activity = this;
  }

  release(npc) {
    npc.mem('social').activity = null;
  }

  occupy(prop) {
    if (!prop) return;
    prop._occupiedBy = this.id;
    this.occupiedProps.push(prop);
  }

  /** Admit（②）— base 版只做 join；子类 override 补姿势配置，见文件头注释。 */
  admit(npc, role) {
    this.join(npc, role);
  }

  /** Dismiss（④）— base 版：release + 摘除 participants +（存活时）setState('walk')。 */
  dismiss(npc, reason) {
    this.release(npc);
    this.participants = this.participants.filter(p => p.npc !== npc);
    if (npc.alive) setState(npc, 'walk', reason || 'dismiss');
  }

  update(dt) { return this.alive; }

  interrupt(reason) { this._endReason = reason || 'interrupt'; this.alive = false; }

  destroy() {
    for (const { npc } of this.participants) this.release(npc);
    for (const prop of this.occupiedProps) prop._occupiedBy = null;
    this.participants = [];
    this.occupiedProps = [];
  }
}
