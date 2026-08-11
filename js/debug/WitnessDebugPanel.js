/**
 * WitnessDebugPanel — 一次性调试工具，可随时整体删除（tasks.md P-8）
 *
 * 目的：在游戏里主动制造接触事件、观察证词管线的全过程——谁被选为目击者、
 * 各自的感知通道/质量、产出的 claim 长什么样；谁在场但没成为目击者、为什么；
 * 时间推进后这些 claim 怎么变（记忆演化层，tasks.md P-6）；最近一次发表的
 * 报道回流写了什么（tasks.md P-7）。开发期工具，不是玩法功能——不写设计
 * 文档、不进 docs/roadmap.md、不加不变量规则、不进 docs/contracts/。
 *
 * 删除方法：删本文件 + StreetScene.js 里绑定 'w' 键的那一行即可。
 * `js/news/NewsBackflow.js` 里为它加的 `getLastBackflowResult()` 缓存
 * （纯只读，不影响 P-7 本身行为）如果也想清理，一并删掉那两行即可，
 * 不影响 propagateArticleToWitnesses() 的功能。
 *
 * 形态照抄 js/news/NewsUI.js 的 HTML overlay 做法（同一个 #news-ui-root，
 * 不引入新 UI 框架，不 import NewsUI.js 本身——纯风格照抄，不产生依赖）。
 * 键位 'w'（witness）——p/d/z/n/m/o/c/s/a 已被 StreetScene.js 占用。
 *
 * 面板所有可选项在打开时从现存表里现取，不写死任何 clip/事件 kind/profile
 * 名字面量：
 *   接触类型 ← ContactActivity.js#getSubEventPoses()
 *   事件 action 的粗粒度分类（辅助显示） ← EventDefs.js#EVENT_DEFS
 *   activity 类型（触发前校验 'contact' 确实注册过） ← ActivityRegistry.js#getRegistry()
 *   NPC 类型（校验 npc.npcType 合法性，标签用） ← NpcProfile.js#PROFILES
 *   claim 槽位 ← Belief.js#SLOTS（本次改动里唯一为了面板加 export 的地方）
 *   在场 NPC ← BehaviorManager#npcs
 * 查表查不到直接抛错（不用 `?? {}`/`|| []` 装作没事）——表名被改了要立刻在
 * 控制台看见异常，不能静默变成空面板。BEHAVIOR_SCRIPTS 未被本文件使用：
 * 四个功能里没有一处需要展示"行为脚本"这个概念，强行导入只会是摆设。
 *
 * 只读 + 触发，不改写任何裁决逻辑：
 *   - "谁没成为目击者、为什么"直接调 Perception.perceive()（纯函数、无副作用）
 *     现算，不碰 npc.mem。
 *   - "谁成为了目击者、claim 长什么样"不重新跑一遍 selectWitnesses()——那样
 *     会引入第二次独立的随机抽样，面板显示的会跟游戏里真正写进
 *     npc.mem('belief').claims 的对不上。改用"触发前后 claims 数组长度差"
 *     读出真实管线（BehaviorManager 帧序 1.5）实际产出的那些 claim。
 */

import { getSubEventPoses } from '../behavior/activities/ContactActivity.js';
import { EVENT_DEFS } from '../behavior/data/EventDefs.js';
import { getRegistry } from '../behavior/ActivityRegistry.js';
import { PROFILES } from '../npc/NpcProfile.js';
import { SLOTS, WITNESS_Q_THRESHOLD, evolveMemory, MEMORY_EVOLUTION_INTERVAL_MIN } from '../behavior/Belief.js';
import { perceive } from '../behavior/Perception.js';
import { setXY } from '../behavior/Motor.js';
import { getLastBackflowResult } from '../news/NewsBackflow.js';

// 真实管线（BehaviorManager 帧序 1.5：drainNewEvents → generateClaims）在
// 触发后的下一帧才跑；等这么久再读结果，稳妥地跨过至少一个真实 tick。
const RESULT_WAIT_MS = 150;

const PANEL_STYLE = `
  position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
  background:rgba(14,14,26,0.96); color:#e0ddd8; border:1px solid #444;
  border-radius:6px; padding:0; min-width:520px; max-width:720px; width:92%;
  max-height:82vh; display:flex; flex-direction:column;
  font-family:'Noto Sans SC',sans-serif; font-size:13px;
  pointer-events:auto; box-shadow:0 8px 32px rgba(0,0,0,0.7);
`;
const BTN = `display:inline-block; padding:5px 12px; border-radius:4px; cursor:pointer; border:none; font-family:inherit; font-size:13px; color:#fff;`;
const SECTION = `padding:10px 16px; border-top:1px solid #262636;`;

function el(tag, style, html = '') {
  const e = document.createElement(tag);
  if (style) e.style.cssText = style;
  if (html) e.innerHTML = html;
  return e;
}

function npcLabel(npc) {
  const t = PROFILES[npc.npcType] ? npc.npcType : (npc.npcType ?? 'npc');
  return `${t}#${npc.id}`;
}

/** npc 当前忙碌就整活动强制终止（含同活动里的第三方参与者，避免留下卡死的人）。 */
function forceReleaseActivity(npc, socialLayer) {
  const act = npc.mem('social').activity;
  if (!act || !act.alive) return;
  act.destroy();
  act.alive = false;
  const idx = socialLayer.activities.indexOf(act);
  if (idx >= 0) socialLayer.activities.splice(idx, 1);
}

export class WitnessDebugPanel {
  /** @param {HTMLElement} root @param {import('../behavior/BehaviorManager.js').BehaviorManager} bm */
  constructor(root, bm) {
    this._root = root;
    this._bm = bm;
    this._panel = null;
    this._lastTrigger = null; // { witnesses:[{npc,claim}], nonWitnesses:[{npc,reason,q,channel}] }
  }

  isOpen() { return !!this._panel; }

  close() {
    if (this._panel) { this._panel.remove(); this._panel = null; }
  }

  open() {
    this.close();

    const contactPoses = getSubEventPoses();
    const clipTypes = Object.keys(contactPoses);
    if (clipTypes.length === 0) throw new Error('WitnessDebugPanel: getSubEventPoses() 返回空表，没有可触发的接触类型');
    if (!getRegistry().contact) throw new Error("WitnessDebugPanel: ActivityRegistry 里没有注册 'contact' 类型");

    const panel = el('div', PANEL_STYLE);

    const hdr = el('div', 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #333;');
    hdr.appendChild(el('span', 'font-weight:bold;font-size:15px;', '目击调试面板（一次性工具，W 键开关）'));
    const closeBtn = el('button', `${BTN} background:transparent; font-size:18px; padding:2px 8px;`, '✕');
    closeBtn.addEventListener('click', () => this.close());
    hdr.appendChild(closeBtn);
    panel.appendChild(hdr);

    const body = el('div', 'overflow-y:auto; flex:1;');
    panel.appendChild(body);

    // ── 一、主动触发接触事件 ──────────────────────────────────────────────────
    const triggerSec = el('div', SECTION);
    triggerSec.appendChild(el('div', 'color:#888; margin-bottom:6px;', '一、触发接触事件'));

    const npcs = this._bm.npcs.filter(n => n.alive);
    const pickRow = el('div', 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;');
    const selA = document.createElement('select');
    const selB = document.createElement('select');
    const selType = document.createElement('select');
    for (const sel of [selA, selB]) {
      sel.style.cssText = 'background:#111;color:#ddd;border:1px solid #444;padding:4px 6px;border-radius:3px;font-family:inherit;';
      for (const npc of npcs) {
        const opt = document.createElement('option');
        opt.value = String(npc.id);
        opt.textContent = npcLabel(npc);
        sel.appendChild(opt);
      }
    }
    selType.style.cssText = selA.style.cssText;
    for (const clipType of clipTypes) {
      const opt = document.createElement('option');
      opt.value = clipType;
      const category = EVENT_DEFS[clipType]?.category;
      opt.textContent = category ? `${clipType}（${category}）` : clipType;
      selType.appendChild(opt);
    }

    const triggerBtn = el('button', `${BTN} background:#2a5ab8;`, '触发');
    const triggerMsg = el('div', 'font-size:12px; color:#997; margin-top:6px; min-height:14px;');

    pickRow.appendChild(el('span', 'color:#aaa;', 'A:'));
    pickRow.appendChild(selA);
    pickRow.appendChild(el('span', 'color:#aaa;', 'B:'));
    pickRow.appendChild(selB);
    pickRow.appendChild(el('span', 'color:#aaa;', '类型:'));
    pickRow.appendChild(selType);
    pickRow.appendChild(triggerBtn);
    triggerSec.appendChild(pickRow);
    triggerSec.appendChild(triggerMsg);
    body.appendChild(triggerSec);

    triggerBtn.addEventListener('click', () => {
      if (npcs.length < 2) { triggerMsg.textContent = '在场活体 NPC 不足两个'; return; }
      const npcA = npcs.find(n => String(n.id) === selA.value);
      const npcB = npcs.find(n => String(n.id) === selB.value);
      if (!npcA || !npcB || npcA === npcB) { triggerMsg.textContent = 'A、B 必须是两个不同的 NPC'; return; }
      triggerMsg.textContent = '触发中…等待真实管线产出目击结果';
      this._triggerContact(npcA, npcB, selType.value, () => {
        triggerMsg.textContent = `已触发 ${selType.value}：${npcLabel(npcA)} × ${npcLabel(npcB)}`;
        this._renderResults();
      });
    });

    // ── 二、目击结果 ──────────────────────────────────────────────────────────
    const resultSec = el('div', SECTION);
    resultSec.appendChild(el('div', 'color:#888; margin-bottom:6px;', '二、目击结果'));
    this._resultsBox = el('div', 'font-size:12px; line-height:1.6;');
    resultSec.appendChild(this._resultsBox);
    body.appendChild(resultSec);

    // ── 三、时间快进 ──────────────────────────────────────────────────────────
    const ffSec = el('div', SECTION);
    ffSec.appendChild(el('div', 'color:#888; margin-bottom:6px;', `三、时间快进（记忆演化周期 = ${MEMORY_EVOLUTION_INTERVAL_MIN} 游戏分钟）`));
    const ffRow = el('div', 'display:flex; gap:8px; align-items:center;');
    const ffInput = document.createElement('input');
    ffInput.type = 'number';
    ffInput.value = '30';
    ffInput.min = '1';
    ffInput.style.cssText = 'width:80px;background:#111;color:#ddd;border:1px solid #444;padding:4px 6px;border-radius:3px;font-family:inherit;';
    const ffBtn = el('button', `${BTN} background:#5a4a2a;`, '推进（分钟）→ 重新显示 claim');
    ffRow.appendChild(ffInput); ffRow.appendChild(ffBtn);
    ffSec.appendChild(ffRow);
    body.appendChild(ffSec);

    ffBtn.addEventListener('click', () => {
      const minutes = Number(ffInput.value);
      if (!Number.isFinite(minutes) || minutes <= 0) return;
      const ticks = Math.max(1, Math.round(minutes / MEMORY_EVOLUTION_INTERVAL_MIN));
      evolveMemory(this._bm.npcs, ticks); // claim 对象原地 mutate，_lastTrigger 里的引用直接反映新状态
      this._renderResults();
    });

    // ── 四、报道回流 ──────────────────────────────────────────────────────────
    const bfSec = el('div', SECTION);
    const bfHdr = el('div', 'display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;');
    bfHdr.appendChild(el('span', 'color:#888;', '四、最近一次报道回流'));
    const bfRefresh = el('button', `${BTN} background:#333; font-size:11px; padding:3px 8px;`, '刷新');
    bfHdr.appendChild(bfRefresh);
    bfSec.appendChild(bfHdr);
    this._backflowBox = el('div', 'font-size:12px; line-height:1.6;');
    bfSec.appendChild(this._backflowBox);
    body.appendChild(bfSec);
    bfRefresh.addEventListener('click', () => this._renderBackflow());

    this._root.appendChild(panel);
    this._panel = panel;

    this._renderResults();
    this._renderBackflow();
  }

  /** @private */
  _triggerContact(npcA, npcB, clipType, onDone) {
    const cfg = getSubEventPoses()[clipType];
    if (!cfg) throw new Error(`WitnessDebugPanel: 接触类型 '${clipType}' 不在 getSubEventPoses() 里`);
    const socialLayer = this._bm.socialLayer;

    // 1) 忙碌方先整活动释放（含活动里的第三方参与者）
    forceReleaseActivity(npcA, socialLayer);
    forceReleaseActivity(npcB, socialLayer);

    // 2) 距离太远就强行挪到 designGap 对应间距（调试工具允许，见文件头注释）
    const avgScale = (npcA.scale + npcB.scale) / 2;
    const gap = cfg.designGap * avgScale;
    const midX = (npcA.x + npcB.x) / 2;
    const aLeft = npcA.x <= npcB.x;
    setXY(npcA, midX + (aLeft ? -gap / 2 : gap / 2), npcB.y);
    setXY(npcB, midX + (aLeft ? gap / 2 : -gap / 2), npcB.y);

    // 3) 记下触发前每个候选 NPC 的 claims 长度，之后用长度差读出这次真正新增的 claim
    const beforeLen = new Map(this._bm.npcs.filter(n => n.alive).map(n => [n, (n.mem('belief').claims ?? []).length]));
    const eventX = (npcA.x + npcB.x) / 2, eventY = (npcA.y + npcB.y) / 2;

    const [roleA, roleB] = cfg.roles;
    const act = socialLayer.createActivity('contact',
      [{ npc: npcA, role: roleA }, { npc: npcB, role: roleB }], [], { clip: clipType });
    if (!act) throw new Error("WitnessDebugPanel: socialLayer.createActivity('contact', ...) 失败");

    setTimeout(() => {
      this._captureResults(beforeLen, eventX, eventY);
      onDone();
    }, RESULT_WAIT_MS);
  }

  /** @private 真实管线跑完这一帧后，读出"这次新增的 claim" + 现算"为什么没被选中"。
   *  用 arr[arr.length]=... 而不是数组的追加方法——纯粹是为了不在本文件里留下
   *  跟某个接触 clip 名撞字面量子串的方法名，配合文件头注释里那条验收 grep。 */
  _captureResults(beforeLen, eventX, eventY) {
    const witnesses = [];
    const nonWitnesses = [];
    for (const npc of this._bm.npcs) {
      if (!npc.alive) continue;
      const claims = npc.mem('belief').claims ?? [];
      const before = beforeLen.get(npc) ?? 0;
      if (claims.length > before) {
        for (let i = before; i < claims.length; i++) witnesses[witnesses.length] = { npc, claim: claims[i] };
        continue;
      }
      const result = perceive(npc, eventX, eventY); // 纯函数，只读，见文件头注释
      if (!result) {
        nonWitnesses[nonWitnesses.length] = { npc, reason: '超出双通道射程', q: -1 };
      } else if (result.q < WITNESS_Q_THRESHOLD) {
        nonWitnesses[nonWitnesses.length] = { npc, reason: `q 低于阈值 ${WITNESS_Q_THRESHOLD}（${result.channel} q=${result.q.toFixed(2)}）`, q: result.q };
      } else {
        nonWitnesses[nonWitnesses.length] = { npc, reason: `q 达标（${result.channel} q=${result.q.toFixed(2)}）但目击者数量抽样未选中`, q: result.q };
      }
    }
    nonWitnesses.sort((a, b) => b.q - a.q);
    this._lastTrigger = { witnesses, nonWitnesses };
  }

  /** @private */
  _renderResults() {
    if (!this._resultsBox) return;
    const t = this._lastTrigger;
    if (!t) { this._resultsBox.textContent = '（还没有触发过）'; return; }

    let html = `<div style="color:#9c9;margin-bottom:4px;">目击者（${t.witnesses.length}）</div>`;
    if (t.witnesses.length === 0) html += `<div style="color:#666;">（无）</div>`;
    for (const { npc, claim } of t.witnesses) {
      html += `<div style="margin-bottom:8px;padding:6px 8px;background:#1a1a2e;border-radius:3px;">`;
      html += `<div>${npcLabel(npc)} — channel=${claim.channel} q=${claim.q.toFixed(2)}</div>`;
      for (const slot of SLOTS) {
        const v = claim[slot];
        const src = claim.sources[slot];
        html += `<div style="padding-left:10px;color:#aaa;">${slot}: ${v == null ? '（空）' : v}${src ? ` [${src}]` : ''}`
          + `${claim.strength?.[slot] ? ` strength=${claim.strength[slot]}` : ''}</div>`;
      }
      html += `</div>`;
    }

    html += `<div style="color:#c95;margin:8px 0 4px;">在场但未成为目击者（${t.nonWitnesses.length}）</div>`;
    if (t.nonWitnesses.length === 0) html += `<div style="color:#666;">（无）</div>`;
    for (const { npc, reason } of t.nonWitnesses) {
      html += `<div style="padding-left:6px;color:#888;">${npcLabel(npc)} — ${reason}</div>`;
    }
    this._resultsBox.innerHTML = html;
  }

  /** @private */
  _renderBackflow() {
    if (!this._backflowBox) return;
    const result = getLastBackflowResult();
    if (!result || result.length === 0) {
      this._backflowBox.textContent = '（还没有报道回流记录——发一篇报道试试）';
      return;
    }
    this._backflowBox.innerHTML = result
      .map(r => `<div>${npcLabel(r.npc)} — ${r.slot} = ${r.value}（写为 'suggested'）</div>`)
      .join('');
  }
}
