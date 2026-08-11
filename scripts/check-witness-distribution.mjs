#!/usr/bin/env node
/**
 * check-witness-distribution.mjs — W-5 静态采样验证
 *
 * 验证 Belief.selectWitnesses() 的目击者数量分布符合
 * docs/design-plans/witness-memory-v1.md §5 的设计目标：
 *   - 候选充足时目击者数量落在 [2,4]
 *   - 候选稀缺（0-1 人）时如实反映，不强行凑数
 *   - 超出双通道射程的候选正确排除
 *
 * 纯函数采样，不启动游戏/PIXI/EntityManager——只用合成 mock NPC
 * （{x,y,direction,modifiers:[]}，Perception.perceive() 所需字段的最小集）
 * 反复调用 selectWitnesses()。属于 check-invariants.mjs 同类"静态验证"
 * 工具，不算 CLAUDE.md 里禁止默认运行的游戏/harness/模拟验证。
 */

import { selectWitnesses } from '../js/behavior/Belief.js';

const red   = s => `\x1b[0;31m${s}\x1b[0m`;
const green = s => `\x1b[0;32m${s}\x1b[0m`;
let FAIL = false;
const fail = msg => { process.stderr.write(red('FAIL: ' + msg) + '\n'); FAIL = true; };

function mockNpc(x, y, direction = 1) {
  return { x, y, direction, modifiers: [] };
}

// ── 场景 1：候选充足（10 人散布在事件周边 100px 内）──────────────────────────
console.log('场景 1: 候选充足场景下目击者数量应落在 [2,4]');
{
  const counts = [];
  for (let trial = 0; trial < 500; trial++) {
    const candidates = [];
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r   = Math.random() * 100;
      candidates.push(mockNpc(Math.cos(ang) * r, Math.sin(ang) * r, Math.random() < 0.5 ? 1 : -1));
    }
    counts.push(selectWitnesses(candidates, 0, 0).length);
  }
  const outOfRange = counts.filter(c => c < 2 || c > 4);
  if (outOfRange.length > 0) {
    fail(`候选充足场景下仍有 ${outOfRange.length}/500 次目击者数量落在 [2,4] 区间外`);
  } else {
    const hist = [2, 3, 4].map(n => `${n}:${counts.filter(c => c === n).length}`).join(' ');
    console.log(green(`  ok — 500 次采样全部落在 [2,4]（分布 ${hist}）`));
  }
}

// ── 场景 2：候选稀缺（0-1 人）不强行凑数 ──────────────────────────────────
console.log('场景 2: 候选稀缺（0-1 人）时如实反映，不强行凑数');
{
  let bad = 0;
  for (let trial = 0; trial < 200; trial++) {
    const n = Math.random() < 0.5 ? 0 : 1;
    const candidates = Array.from({ length: n }, () => mockNpc(10, 10));
    const witnesses = selectWitnesses(candidates, 0, 0);
    if (witnesses.length !== n) bad++;
  }
  if (bad > 0) {
    fail(`候选稀缺场景下 ${bad}/200 次未如实反映候选数量`);
  } else {
    console.log(green('  ok — 0-1 人候选场景如实反映，不强行凑数'));
  }
}

// ── 场景 3：超出射程的候选被正确排除 ──────────────────────────────────────
console.log('场景 3: 超出视距/听距射程的候选应被排除');
{
  const farCandidates = Array.from({ length: 5 }, () => mockNpc(10000, 10000));
  const witnesses = selectWitnesses(farCandidates, 0, 0);
  if (witnesses.length !== 0) {
    fail(`超出射程的候选未被排除，仍产出 ${witnesses.length} 名目击者`);
  } else {
    console.log(green('  ok — 超出双通道射程的候选正确排除为 0 目击者'));
  }
}

console.log('');
if (!FAIL) {
  console.log(green('All witness-distribution checks pass.'));
  process.exit(0);
} else {
  process.stderr.write(red('One or more witness-distribution checks failed.') + '\n');
  process.exit(1);
}
