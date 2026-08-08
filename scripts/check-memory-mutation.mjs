#!/usr/bin/env node
/**
 * check-memory-mutation.mjs — P-6 记忆演化层静态采样验证
 *
 * 形态照抄 scripts/check-witness-distribution.mjs：纯函数采样，不启动游戏/
 * PIXI/EntityManager，只用合成 mock NPC（`{mem(ns)}` 最小集，evolveMemory()
 * 所需字段）反复调用 Belief.evolveMemory()。属于 check-invariants.mjs 同类
 * "静态验证"工具，不算 CLAUDE.md 里禁止默认运行的游戏/harness/模拟验证。
 *
 * 覆盖 tasks.md P-6 要求的三个场景：
 *   ① 时间推进后槽位保真率单调下降，且降到某个下界后不再继续降（衰减减速）
 *   ② strength 高的槽显著比 strength 低的槽更耐变异
 *   ③ 转移变异只会取到同一 NPC 自己其他 claim 的值，不会凭空取到别人的
 */

import { evolveMemory, slotFidelity } from '../js/behavior/Belief.js';
import { EVENT_DEFS } from '../js/behavior/data/EventDefs.js';

const red   = s => `\x1b[0;31m${s}\x1b[0m`;
const green = s => `\x1b[0;32m${s}\x1b[0m`;
let FAIL = false;
const fail = msg => { process.stderr.write(red('FAIL: ' + msg) + '\n'); FAIL = true; };
const ok   = msg => console.log(green(`  ok — ${msg}`));

function mockNpc() {
  return { _mem: {}, mem(ns) { return (this._mem ??= {})[ns] ??= {}; } };
}

const ACTION_KIND = Object.keys(EVENT_DEFS)[0]; // 任取一个真实存在的 kind，避免硬编码字面量脱钩

// ── 场景 1：保真率随演化推进单调下降，且降速逐渐放缓 ──────────────────────────
console.log('场景 1: 时间推进后槽位保真率应下降，且降速逐渐放缓（趋于下界）');
{
  const N = 1000;
  const npcs = Array.from({ length: N }, () => {
    const npc = mockNpc();
    npc.mem('belief').claims = [{
      id: 'c', q: 0.9, channel: 'sight',
      actor: 'jogger#1', action: ACTION_KIND, target: 'jogger#2',
      place: 'SIDEWALK(100,200)', time: 8.0,
      sources: { actor: 'witness', action: 'witness', target: 'witness', place: 'witness', time: 'witness' },
      strength: {}, // 全部未强化过（strength=0），P-6 最不耐变异的起点
    }];
    return npc;
  });

  const SLOTS = ['actor', 'action', 'target', 'place', 'time'];
  function fineFraction() {
    let fine = 0, total = 0;
    for (const npc of npcs) {
      const claim = npc.mem('belief').claims[0];
      for (const s of SLOTS) { total++; if (slotFidelity(s, claim[s]) === 'fine') fine++; }
    }
    return fine / total;
  }

  const f0 = fineFraction();
  evolveMemory(npcs, 15);
  const f1 = fineFraction();
  evolveMemory(npcs, 15); // 累计 30
  const f2 = fineFraction();
  evolveMemory(npcs, 30); // 累计 60
  const f3 = fineFraction();

  const drop1 = f0 - f1;   // 前 15 tick 的降幅
  const drop2 = f2 - f3;   // 后 30 tick（tick 30→60）的降幅

  if (f1 >= f0 || f2 >= f1 || f3 >= f2) {
    fail(`保真率未能单调下降：f0=${f0.toFixed(3)} f1=${f1.toFixed(3)} f2=${f2.toFixed(3)} f3=${f3.toFixed(3)}`);
  } else if (drop2 >= drop1) {
    fail(`降速未见放缓（未趋于下界）：前 15 tick 降 ${drop1.toFixed(3)}，后 30 tick 仅降 ${drop2.toFixed(3)}，后者应更小`);
  } else {
    ok(`保真率单调下降且降速放缓：${f0.toFixed(3)} → ${f1.toFixed(3)} → ${f2.toFixed(3)} → ${f3.toFixed(3)}（前 15 tick 降 ${drop1.toFixed(3)}，后 30 tick 仅降 ${drop2.toFixed(3)}）`);
  }
}

// ── 场景 2：strength 高的槽显著更耐变异 ────────────────────────────────────
console.log('场景 2: strength 高的槽应显著比 strength 低的槽更耐变异');
{
  const N = 500;
  const TICKS = 20;
  const HIGH_STRENGTH = 10;

  function buildGroup(strength) {
    return Array.from({ length: N }, () => {
      const npc = mockNpc();
      npc.mem('belief').claims = [{
        id: 'c', q: 0.9, channel: 'sight',
        actor: 'x#1', action: null, target: null, place: null, time: null,
        sources: { actor: 'witness', action: null, target: null, place: null, time: null },
        strength: strength > 0 ? { actor: strength } : {},
      }];
      return npc;
    });
  }

  const lowGroup  = buildGroup(0);
  const highGroup = buildGroup(HIGH_STRENGTH);
  evolveMemory(lowGroup, TICKS);
  evolveMemory(highGroup, TICKS);

  const survival = g => g.filter(npc => npc.mem('belief').claims[0].actor === 'x#1').length / g.length;
  const lowSurvival  = survival(lowGroup);
  const highSurvival = survival(highGroup);

  if (highSurvival <= lowSurvival + 0.3) {
    fail(`strength=${HIGH_STRENGTH} 组存活率（${highSurvival.toFixed(3)}）未显著高于 strength=0 组（${lowSurvival.toFixed(3)}），差距应 > 0.3`);
  } else {
    ok(`strength=0 存活率 ${lowSurvival.toFixed(3)}，strength=${HIGH_STRENGTH} 存活率 ${highSurvival.toFixed(3)}（差距 ${(highSurvival - lowSurvival).toFixed(3)}）`);
  }
}

// ── 场景 3：转移变异只在同一 NPC 内部发生，不会跨 NPC 串号 ─────────────────
console.log('场景 3: 转移变异只会取到同一 NPC 自己其他 claim 的值，不会凭空取到别人的');
{
  const CLAIMS_PER_NPC = 6;
  const TICKS = 300;

  function buildTaggedNpc(prefix) {
    const npc = mockNpc();
    const claims = [];
    for (let i = 0; i < CLAIMS_PER_NPC; i++) {
      claims.push({
        id: `${prefix}_${i}`, q: 0.9, channel: 'sight',
        actor: `${prefix}_${i}#1`, action: null, target: null, place: null, time: null,
        sources: { actor: 'witness', action: null, target: null, place: null, time: null },
        strength: {},
        _origin: prefix, _origIdx: i, // 测试脚手架字段，Belief.js 不读取，evolveMemory 不受影响
      });
    }
    npc.mem('belief').claims = claims;
    return npc;
  }

  const npcA = buildTaggedNpc('A_marker');
  const npcB = buildTaggedNpc('B_marker');
  evolveMemory([npcA, npcB], TICKS);

  let leaked = 0, mutatedWithinScope = 0;
  for (const [npc, ownPrefix, otherPrefix] of [[npcA, 'A_marker', 'B_marker'], [npcB, 'B_marker', 'A_marker']]) {
    for (const claim of npc.mem('belief').claims) {
      const v = claim.actor;
      if (v != null && v.startsWith(otherPrefix)) leaked++;
      if (v !== `${claim._origin}_${claim._origIdx}#1`) mutatedWithinScope++;
    }
  }

  if (leaked > 0) {
    fail(`检测到 ${leaked} 处跨 NPC 串号：转移变异取到了另一个 NPC 的值`);
  } else if (mutatedWithinScope === 0) {
    fail(`${TICKS} 个 tick 后没有任何槽发生变化，测试未能触发变异（阳性对照缺失，无法验证转移边界）`);
  } else {
    ok(`零跨 NPC 串号；${mutatedWithinScope}/${CLAIMS_PER_NPC * 2} 个槽在演化中发生了变化（含转移/退化/遗忘），均未越出各自 NPC 的范围`);
  }
}

console.log('');
if (!FAIL) {
  console.log(green('All memory-mutation checks pass.'));
  process.exit(0);
} else {
  process.stderr.write(red('One or more memory-mutation checks failed.') + '\n');
  process.exit(1);
}
