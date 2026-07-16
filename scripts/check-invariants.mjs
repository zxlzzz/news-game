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

// ── Rule 5 ─────────────────────────────────────────────────────────────────
// Each type in OBSTACLE_TYPES must have a footprint(e) that declares shape + blocks.
console.log('Rule 5: each OBSTACLE_TYPE has footprint with shape and blocks fields');
{
  // Mapping: propType → entity module path (relative to ROOT)
  const FP_MODULE = {
    fountain:     'js/entity/fountain/fountain.js',
    stall:        'js/entity/stall/stall.js',
    tree:         'js/entity/tree/tree.js',
    bench:        'js/entity/seat/seat.js',
    trash:        'js/entity/trash/trash.js',
    hydrant:      'js/entity/hydrant/hydrant.js',
    mailbox:      'js/entity/mailbox/mailbox.js',
    newsrack:     'js/entity/newsrack/newsrack.js',
    planter:      'js/entity/planter/planter.js',
    vending:      'js/entity/vending/vending.js',
    phonebooth:   'js/entity/phonebooth/phonebooth.js',
    'chess-table':'js/entity/chess-table/chessTable.js',
  };

  // Extract OBSTACLE_TYPES from PropEntity.js source
  const propEntitySrc = readText(join(ROOT, 'js', 'core', 'PropEntity.js'));
  const setMatch = propEntitySrc.match(/const OBSTACLE_TYPES\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  const obstacleTypes = setMatch
    ? [...setMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])
    : [];

  let ruleOk = true;
  for (const t of obstacleTypes) {
    const modPath = FP_MODULE[t];
    if (!modPath) {
      fail(`OBSTACLE_TYPE '${t}' has no entry in FP_MODULE mapping`);
      ruleOk = false;
      continue;
    }
    const src = readText(join(ROOT, modPath));
    const hasShape  = /\bshape\s*:/.test(src);
    const hasBlocks = /\bblocks\s*:/.test(src);
    const passed = hasShape && hasBlocks;
    console.log(`  ${t}: shape=${hasShape} blocks=${hasBlocks} ${passed ? '✓' : '✗'}`);
    if (!passed) { fail(`${t} footprint missing shape or blocks`); ruleOk = false; }
  }
  if (ruleOk) okMsg();
}

// ── Rule 6 ─────────────────────────────────────────────────────────────────
// No _sortY = outside known allowlist (PropEntity.js + seat.js + Chess.js).
console.log('Rule 6: _sortY= writes only in PropEntity.js, seat.js, Chess.js');
{
  const ALLOWLIST = ['PropEntity.js', 'seat.js', 'Chess.js'];
  const re = /_sortY\s*=/;
  const hits = [];
  for (const p of walkFiles(join(ROOT, 'js'), f => f.endsWith('.js'))) {
    if (ALLOWLIST.some(a => p.endsWith(a))) continue;
    const lines = readText(p).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i]))
        hits.push(`${p}:${i + 1}: ${lines[i].trim()}`);
    }
  }
  if (hits.length > 0) {
    fail('_sortY= write outside allowlist:\n  ' + hits.join('\n  '));
  } else {
    okMsg();
  }
}

// ── Rule 7 ─────────────────────────────────────────────────────────────────
// Distance comparisons (Math.hypot + < number, or dist/moved/disp < number)
// and timer accumulations (+= dt/delta) outside decision-file whitelist are
// WARNING-only — they flag code that should migrate into a layer decision file
// per goal-pipeline-v1.md.  Zero exit-code impact.
console.log('Rule 7: distance comparisons and timer accums in js/behavior/** (warning only)');
{
  const yellow = s => `\x1b[0;33m${s}\x1b[0m`;
  const warn   = msg => process.stdout.write(yellow('WARN: ' + msg) + '\n');

  // Files that currently legitimately contain these patterns.
  // N-series annotation = planned migration knife.
  const WHITELIST = new Set([
    'Motor.js',           // distance: progress monitor (15 px)       — N-3 target
    'BaseStateMachine.js',// distance+timer: arrival thresholds + stateTimer — N-1/N-3 target
    'GotoTask.js',        // distance+timer: watchdog (8 px) + elapsed — N-2/N-3 target
    'StuckProbe.js',      // distance+timer: observer (permanent)      — keep
    'SocialLayer.js',     // timer: talkScanTimer                      — low priority
    'WaitBusActivity.js', // timer: boarding/wait timers
    'PlayPoseTask.js',    // timer: pose duration
    'StrollTask.js',      // timer: stroll phase elapsed
    'UseBenchTask.js',    // timer: sitting elapsed
    'ChessActivity.js',   // timer: chess phase timers
    'StallActivity.js',   // timer: stall phase timers
    'TalkActivity.js',    // timer: talk timers
  ]);

  // Distance: Math.hypot(...) < <number>  OR  dist*/moved/disp < <number>
  const DIST_RE  = /Math\.hypot[^)]*\).*<\s*[\d.]|(?:dist\w*|moved|disp)\s*<\s*[\d.]/;
  // Timer: += dt or += delta
  const TIMER_RE = /\+=\s*(?:dt|delta)\b/;

  const behaviorDir = join(ROOT, 'js', 'behavior');
  const navDir      = join(behaviorDir, 'nav');

  const hits = [];
  for (const p of walkFiles(behaviorDir, f => f.endsWith('.js'))) {
    // Exclude nav/ subdirectory (A*, NavGrid, Lookahead legitimately use these)
    if (p.startsWith(navDir)) continue;
    const base = p.split(/[\\/]/).pop();
    if (WHITELIST.has(base)) continue;
    const lines = readText(p).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (DIST_RE.test(lines[i]) || TIMER_RE.test(lines[i]))
        hits.push(`${p}:${i + 1}: ${lines[i].trim()}`);
    }
  }
  if (hits.length > 0) {
    warn(`${hits.length} distance/timer pattern(s) outside whitelist (migrate to decision file):\n  ` + hits.join('\n  '));
  } else {
    console.log(`  whitelist size=${WHITELIST.size}, zero unexpected violations`);
    okMsg();
  }
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
