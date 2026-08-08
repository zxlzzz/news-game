/**
 * NewsBackflow — 报道回流（tasks.md P-7）
 *
 * 目标："框架建构现实"：玩家发表的报道写回 NPC 的信念。依赖 P-6（回流写入的
 * 槽之后要经过同一套 evolveMemory 演化，不开豁免）。
 *
 * 机制：把"本次报道贡献了 testimony 的目击者群体"（NewsUI.js openComposer
 * 传入的同一个 witnesses 数组）按 `claim.eventId`（P-7，Belief.js#_fillClaim
 * 产出）分组——同一事件的不同目击者互相校对：谁的槽有值、谁的槽还空着，把
 * 有值的填进还空着的（`Belief.js#injectSuggestion`，不建新 claim，来源标
 * 'suggested'——报道和审问诱导在认识论上是同一件事，不新开一种 source 值）。
 * 传播规则（影响范围有边界，不能全场 NPC 一起被写）是声明式表
 * `MemoryMutationTables.js#NEWS_BACKFLOW`：只影响本来就对同一事件有 claim
 * 的 NPC（这批目击者自身），不外溢到没有为这次报道贡献过目击 claim 的旁观
 * NPC——后者需要新建 claim，与 injectSuggestion 的既有硬约束冲突，未采用。
 *
 * 单人目击（该事件只有一个人有 claim）没有"互相校对"的对象，天然跳过，
 * 不是 bug。
 */

import { injectSuggestion } from '../behavior/Belief.js';
import { NEWS_BACKFLOW } from '../behavior/data/MemoryMutationTables.js';

const SLOTS = ['actor', 'action', 'target', 'place', 'time'];

/**
 * 报道发表 → 回流写入的唯一调用点（check-invariants.mjs Rule 18 守住，
 * 只允许出现在 NewsUI.js）。
 *
 * @param {object[]} witnesses  本次报道的目击者（openComposer 参数原样传入）
 * @returns {{npc:object, claimId:string, slot:string, value:*}[]} 实际写入的槽，
 *   供调试/未来 UI（tasks.md P-8）消费；无写入返回空数组。
 */
export function propagateArticleToWitnesses(witnesses) {
  const written = [];

  // 按 eventId 把不同 NPC 的 claim 分组——同一事件的不同目击者。
  const byEvent = new Map();
  for (const npc of witnesses) {
    for (const claim of npc.mem('belief').claims ?? []) {
      if (claim.eventId == null) continue;
      if (!byEvent.has(claim.eventId)) byEvent.set(claim.eventId, []);
      byEvent.get(claim.eventId).push({ npc, claim });
    }
  }

  outer:
  for (const group of byEvent.values()) {
    if (group.length < 2) continue; // 单人目击，没有互相校对的对象

    for (const slot of SLOTS) {
      const donor = group.find(g => g.claim[slot] != null);
      if (!donor) continue;

      for (const { npc, claim } of group) {
        if (claim === donor.claim) continue;
        if (written.length >= NEWS_BACKFLOW.maxFillsPerArticle) break outer;
        const result = injectSuggestion(npc, claim.id, slot, donor.claim[slot]);
        if (result) written.push({ npc, claimId: claim.id, slot, value: donor.claim[slot] });
      }
    }
  }

  return written;
}
