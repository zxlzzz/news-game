#!/usr/bin/env node
/**
 * check-invariants.mjs — movement + animation subsystem hard gates
 * Run from repo root: node scripts/check-invariants.mjs
 * exit 0 = clean; exit 1 = violation found.
 * See docs/contracts/movement.md and docs/contracts/known-violations.md.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));

let FAIL = false;

const red   = s => `\x1b[0;31m${s}\x1b[0m`;
const green = s => `\x1b[0;32m${s}\x1b[0m`;
const fail  = msg => { process.stderr.write(red('FAIL: ' + msg) + '\n'); FAIL = true; };
const okMsg = ()  => process.stdout.write(green('  ok') + '\n');

function readText(p)  { return readFileSync(p, 'utf8'); }
function readJson(p)  { return JSON.parse(readText(p)); }

function walkFiles(dir, filter) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, filter));
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

// ── Rule 1 ─────────────────────────────────────────────────────────────────
// _extraTags is a legacy direct field; only TalkActivity.js is allowlisted.
console.log('Rule 1: no _extraTags in js/ (except TalkActivity.js allowlist)');
{
  const hits = walkFiles(join(ROOT, 'js'), f => f.endsWith('.js'))
    .filter(p => !p.endsWith('TalkActivity.js') && readText(p).includes('_extraTags'));
  if (hits.length > 0) {
    fail('_extraTags outside known-violations allowlist:\n  ' + hits.join('\n  '));
  } else {
    okMsg();
  }
}

// ── Rule 2 ─────────────────────────────────────────────────────────────────
// Animation clip JSON files must not contain a "kind" key.
console.log('Rule 2: animation clip JSONs must not contain "kind"');
{
  const hits = walkFiles(join(ROOT, 'assets', 'animations'), f => f.endsWith('.json'))
    .filter(p => /"kind"/.test(readText(p)));
  if (hits.length > 0) {
    fail('"kind" in clip JSON files:\n  ' + hits.join('\n  '));
  } else {
    okMsg();
  }
}

// ── Rule 3 ─────────────────────────────────────────────────────────────────
// npc.speed / npc.state / npc.animation must not be written outside Motor.js / Npc.js.
console.log('Rule 3: npc.{speed,state,animation} = only in Motor.js (and Npc.js constructor)');
{
  const re = /\bnpc\.(speed|state|animation)\s*=[^=]/;
  const hits = [];
  for (const p of walkFiles(join(ROOT, 'js'), f => f.endsWith('.js'))
      .filter(p => !p.endsWith('Motor.js') && !p.endsWith('Npc.js'))) {
    const lines = readText(p).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i]))
        hits.push(`${p}:${i + 1}: ${lines[i].trim()}`);
    }
  }
  if (hits.length > 0) {
    fail('direct write to protected npc field outside Motor.js:\n  ' + hits.join('\n  '));
  } else {
    okMsg();
  }
}

// ── Rule 4 ─────────────────────────────────────────────────────────────────
// Walk-state clips (speedK > 0 in STATE_DEFS) must have |meanX| ≤ 4.
// "Walk-state" = any state whose NPC is visibly moving; currently walk/run/jog.
// dog/mounted clips are not referenced in STATE_DEFS and are exempt automatically.
console.log('Rule 4: walk-state clips (speedK>0 in STATE_DEFS) must have |meanX| ≤ 4');
{
  const motorSrc  = readText(join(ROOT, 'js', 'behavior', 'Motor.js'));
  const manifest  = readJson(join(ROOT, 'assets', 'manifest.json'));
  const skeletons = readJson(join(ROOT, 'assets', 'skeleton.json')).skeletons;

  // Collect anim names for states with speedK > 0 (all such entries are single-line)
  const walkAnims = new Set();
  for (const line of motorSrc.split('\n')) {
    const m = line.match(/anim:\s*'([^']+)'.*speedK:\s*([\d.]+)/);
    if (m && parseFloat(m[2]) > 0) walkAnims.add(m[1]);
  }

  function computeMeanX(kfs, dp) {
    let total = 0;
    for (const kf of kfs)
      for (const [j, base] of Object.entries(dp))
        total += base[0] + (kf[j] ?? [0, 0])[0];
    return kfs.length * Object.keys(dp).length > 0
      ? total / (kfs.length * Object.keys(dp).length) : 0;
  }

  let ruleOk = true;
  for (const animId of walkAnims) {
    const entry = manifest.clips[animId];
    if (!entry) { process.stderr.write(`  WARN: ${animId} not in manifest\n`); continue; }
    const raw = readJson(join(ROOT, 'assets', entry.path));
    if (raw.variant_of) { console.log(`  SKIP ${animId}: variant`); continue; }
    const dp     = skeletons[raw.skeleton ?? 'human'].defaultPose;
    const meanX  = computeMeanX(raw.keyframes ?? [], dp);
    const passed = Math.abs(meanX) <= 4;
    console.log(`  ${animId}: meanX=${meanX.toFixed(2)} ${passed ? '✓' : '✗'}`);
    if (!passed) { fail(`${animId} |meanX|=${Math.abs(meanX).toFixed(2)} > 4`); ruleOk = false; }
  }
  if (ruleOk) okMsg();
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (!FAIL) {
  console.log(green('All enforced invariants pass.'));
  process.exit(0);
} else {
  process.stderr.write(red('One or more invariants failed. See output above.') + '\n');
  process.exit(1);
}
