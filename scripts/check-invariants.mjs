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
import { execSync } from 'child_process';

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
// _extraTags is fully retired (W-1: TalkActivity.js migrated to
// WorldEventLog.emitEvent()); no allowlist remains.
console.log('Rule 1: no _extraTags anywhere in js/');
{
  const hits = walkFiles(join(ROOT, 'js'), f => f.endsWith('.js'))
    .filter(p => readText(p).includes('_extraTags'));
  if (hits.length > 0) {
    fail('_extraTags found (field is fully retired):\n  ' + hits.join('\n  '));
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
// N3-c exemption: 'bike'/'mobile' are cyclist ride-state clips; position is motor-vel-driven
// (not steerRoam), so clip meanX does not cause visual drift and is intentionally large.
const RULE4_EXEMPT = new Set(['bike', 'mobile']);
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
    if (RULE4_EXEMPT.has(animId)) { console.log(`  SKIP ${animId}: motor-vel-driven (RULE4_EXEMPT)`); continue; }
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
// Every registerProp(..., { obstacle: true, ... }) call site's host file must
// also declare a footprint literal with shape + blocks fields.
// (Z-2d: obstacle types are no longer a PropEntity.js OBSTACLE_TYPES set —
//  each prop module self-registers via propRegistry.registerProp(); this rule
//  statically finds those call sites instead of reading a deleted constant.)
console.log('Rule 5: each registerProp(obstacle:true) call has shape + blocks in its file');
{
  // Find every `registerProp('type', ...)` call site across js/entity/ and js/core/,
  // paren-depth-matched so nested arrow-function bodies (e.g. busstop-roof's
  // `bounds: (e, s) => { ... }`) don't truncate the scan early.
  const callSites = []; // { type, file, obstacle }
  for (const p of walkFiles(join(ROOT, 'js'), f => f.endsWith('.js'))) {
    if (p.endsWith('propRegistry.js')) continue;  // defines registerProp; its JSDoc example isn't a call site
    const src = readText(p);
    const re = /registerProp\(\s*'([\w-]+)'\s*,/g;
    let m;
    while ((m = re.exec(src))) {
      const openParen = src.indexOf('(', m.index + 'registerProp'.length);
      let depth = 1, i = openParen + 1;
      while (i < src.length && depth > 0) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') depth--;
        i++;
      }
      const body = src.slice(openParen + 1, i - 1);
      callSites.push({ type: m[1], file: p, obstacle: /\bobstacle\s*:\s*true\b/.test(body) });
    }
  }

  if (callSites.length === 0) {
    fail('Rule 5: zero registerProp() call sites found — propRegistry wiring missing?');
  } else {
    let ruleOk = true;
    const obstacleSites = callSites.filter(c => c.obstacle);
    for (const { type, file } of obstacleSites) {
      const src = readText(file);
      const hasShape  = /\bshape\s*:/.test(src);
      const hasBlocks = /\bblocks\s*:/.test(src);
      const passed = hasShape && hasBlocks;
      console.log(`  ${type}: shape=${hasShape} blocks=${hasBlocks} ${passed ? '✓' : '✗'}`);
      if (!passed) { fail(`${type} (${file}) footprint missing shape or blocks`); ruleOk = false; }
    }
    if (ruleOk) okMsg();
  }
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
// ERRORS — new raw distance/timer comparisons must go into a decision file.
// N3-e: promoted from warning to error; routing/direct migration complete.
console.log('Rule 7: distance comparisons and timer accums in js/behavior/** must be in whitelist');
{
  // Files that legitimately contain these patterns.
  const WHITELIST = new Set([
    'SteeringDecision.js',// decision file — permanent
    'Motor.js',           // decision file (RECOVERY/SAFETY tables) — permanent
    'StuckProbe.js',      // pure observer — permanent
    'BaseStateMachine.js',// stateTimer accum — permanent (core state-machine bookkeeping)
    'SocialLayer.js',     // 非移动政策计时器 — permanent
    'WaitBusActivity.js', // 非移动政策计时器 — permanent
'StrollTask.js',      // 非移动政策计时器 — permanent
    'UseBenchTask.js',    // 非移动政策计时器 — permanent
    'ChessActivity.js',   // 非移动政策计时器 — permanent
    'StallActivity.js',   // 非移动政策计时器 — permanent
    'TalkActivity.js',    // 非移动政策计时器 — permanent
    'VisitTask.js',       // 非移动政策计时器（elapsed + waitTimer） — permanent
    'ChainTask.js',       // 非移动政策计时器（pose elapsed + goto waitTimer） — permanent
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
    fail(`${hits.length} distance/timer pattern(s) outside whitelist (add to decision file):\n  ` + hits.join('\n  '));
  } else {
    console.log(`  whitelist size=${WHITELIST.size}, zero violations`);
    okMsg();
  }
}

// ── Rule 8 ─────────────────────────────────────────────────────────────────
// M-1: rewritten — the field names this rule used to guard
// (crosswalkCost/jaywalkRoadCost/roadCostDefault) were PLANNING_RULES-era
// names that Z-1 (zone-profile split) deleted outright; the regex had zero
// possible hits left in the codebase and was permanently green regardless
// of what anyone wrote. The real single address for zone→cost policy today
// is NavGrid.js#DEFAULT_ZONE_COSTS, overridden by PlanService.js#_zoneCostsFor
// (profile.zoneCosts merge + jaywalk override) — see PlanService.js's own
// header comment ("代价表装配...唯一住址"). This rule guards THAT.
//
// Detection: a zone-keyed numeric literal — `[ZONE.xxx]: <number>` or
// `[ZONE.xxx] = <number>` — appearing anywhere outside NavGrid.js /
// PlanService.js. PathPlanner.js is exempted too, but for a different
// reason: it hosts ZONE_ROUGHNESS, a *distinct* table (line-of-sight
// straightening friction, explicitly documented as unrelated to planning
// cost — "roughness 不参与 A*，与 zoneCosts 两套独立序") that happens to
// share the same `[ZONE.x]: n` shape. Exempting the file doesn't mean
// PathPlanner.js is allowed to define cost policy — it isn't (see its own
// CONTRACT: "自身不持有代价政策").
//
// Verify this rule actually bites: add a line like `[ZONE.GRASS]: 5,` to
// any file other than NavGrid.js/PlanService.js/PathPlanner.js (e.g. drop
// it into NpcProfile.js) and rerun this script — Rule 8 should fail.
console.log('Rule 8: zone cost policy (DEFAULT_ZONE_COSTS/_zoneCostsFor) numeric definitions confined to NavGrid.js + PlanService.js');
{
  const ZONE_COST_RE = /\[ZONE\.\w+\]\s*[:=]\s*\d/;
  const EXEMPT = new Set(['NavGrid.js', 'PlanService.js', 'PathPlanner.js']);
  const hits = [];
  for (const p of walkFiles(join(ROOT, 'js'), f => f.endsWith('.js'))
      .concat(walkFiles(join(ROOT, 'scripts'), f => f.endsWith('.js') || f.endsWith('.mjs')))) {
    if (EXEMPT.has(p.split(/[\\/]/).pop())) continue;
    const lines = readText(p).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue; // doc comments/examples
      if (ZONE_COST_RE.test(lines[i]))
        hits.push(`${p}:${i + 1}: ${lines[i].trim()}`);
    }
  }
  if (hits.length > 0) {
    fail('zone cost policy value defined outside NavGrid.js/PlanService.js:\n  ' + hits.join('\n  '));
  } else {
    okMsg();
  }
}

// ── Rule 9 ─────────────────────────────────────────────────────────────────
// NPC position (x/y) must only be written via Motor API (setXY/nudgeXY/_slideMove).
// Direct npc.x= / npc.y= outside Motor is prohibited.
// Npc.js may write this.x / this.y only for leashTarget sync (binding, not steering).
console.log('Rule 9: no direct npc.x/npc.y assignment outside Motor.js');
{
  // Primary: npc.x / npc.y assignment in behavior/npc/entity dirs
  const ASSIGN_RE = /\bnpc\.[xy]\s*[+\-]?=(?!=)/;
  const scanDirs = [
    join(ROOT, 'js', 'behavior'),
    join(ROOT, 'js', 'npc'),
    join(ROOT, 'js', 'entity'),
  ];
  const hits = [];
  for (const dir of scanDirs) {
    for (const p of walkFiles(dir, f => f.endsWith('.js'))) {
      const lines = readText(p).split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (ASSIGN_RE.test(lines[i]))
          hits.push(`${p}:${i + 1}: ${lines[i].trim()}`);
      }
    }
  }
  if (hits.length > 0) {
    fail('direct npc.x/y assignment (use Motor setXY/nudgeXY):\n  ' + hits.join('\n  '));
  }

  // Secondary (independent): Npc.js this.x / this.y assigns must all be leashTarget sync
  const NPC_ASSIGN_RE = /\bthis\.[xy]\s*[+\-]?=(?!=)/;
  const npcSrc = readText(join(ROOT, 'js', 'npc', 'Npc.js')).split('\n');
  const npcHits = [];
  for (let i = 0; i < npcSrc.length; i++) {
    if (NPC_ASSIGN_RE.test(npcSrc[i]) && !npcSrc[i].includes('leashTarget'))
      npcHits.push(`Npc.js:${i + 1}: ${npcSrc[i].trim()}`);
  }
  if (npcHits.length > 0) {
    fail('Npc.js this.x/y assign outside leashTarget whitelist:\n  ' + npcHits.join('\n  '));
  }

  if (hits.length === 0 && npcHits.length === 0) okMsg();
}

// ── Rule 10 ────────────────────────────────────────────────────────────────
// npc.direction references in Motor.js and BaseStateMachine.js must match
// one of four whitelist categories — prevents direction policy from scattering.
// Category A: Motor.js#_updateDirection — walk/run/jog/ride facing derived from real x
//             displacement (space dead-zone, L-1; replaces the old steer-intent-velocity
//             + time hysteresis previously in BaseStateMachine.js, symbol deleted)
// Category B: dir_mismatch audit — read-only observation, not a policy write
// Category C: ride/leash/departure config — lane direction at spawn or exit, not steer-derived
// Category D: vel-init read — exact form: ride state constructs mot.vel (唯一合法行：ride 状态配置读取)
console.log('Rule 10: npc.direction in Motor.js / BaseStateMachine.js must match whitelist');
{
  const WHITELIST_PATTERNS = [
    /desired/,                                   // A: _updateDirection
    /dir_mismatch/,                              // B: audit observation
    /lt\.dir|leashTarget|spot\.facing|exit\.facing/, // C: ride/leash/departure config
    /vx: npc\.direction \* npc\.speed/,          // D: vel-init read (ride state only)
  ];

  const targets = [
    join(ROOT, 'js', 'behavior', 'Motor.js'),
    join(ROOT, 'js', 'behavior', 'BaseStateMachine.js'),
  ];
  const hits = [];
  for (const p of targets) {
    const lines = readText(p).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes('npc.direction')) continue;
      const trimmed = lines[i].trim();
      // Skip comment-only lines (JSDoc or inline //)
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
      if (!WHITELIST_PATTERNS.some(re => re.test(lines[i])))
        hits.push(`${p}:${i + 1}: ${trimmed}`);
    }
  }
  if (hits.length > 0) {
    fail('npc.direction outside whitelist in physics files:\n  ' + hits.join('\n  '));
  } else {
    okMsg();
  }
}

// ── Rule 11 ────────────────────────────────────────────────────────────────
// npc.vy must not exist in js/ — field deleted in V3-a; this rule prevents regression.
console.log('Rule 11: no npc.vy in js/ (field deleted in V3-a)');
{
  const hits = [];
  for (const p of walkFiles(join(ROOT, 'js'), f => f.endsWith('.js'))) {
    const lines = readText(p).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/\bnpc\.vy\b/.test(lines[i]))
        hits.push(`${p}:${i + 1}: ${lines[i].trim()}`);
    }
  }
  if (hits.length > 0) {
    fail('npc.vy reference found (dead field, use mot.vel.vy):\n  ' + hits.join('\n  '));
  } else {
    okMsg();
  }
}

// ── Rule 12 ────────────────────────────────────────────────────────────────
// assets/vehicle-anchors.js must match current FK derivation from skeleton+clips.
console.log('Rule 12: vehicle-anchors.js matches FK derivation');
try {
  execSync(`node ${join(ROOT, 'scripts', 'derive-vehicle-anchors.mjs')} --check`, { stdio: 'inherit' });
  okMsg();
} catch {
  fail('vehicle-anchors.js is stale; run: node scripts/derive-vehicle-anchors.mjs --write');
}

// ── Rule 13 ────────────────────────────────────────────────────────────────
// Every module that calls registerProp() must be imported by the props.all.js
// barrel (Z-2d) — otherwise the type "silently doesn't draw" (registration
// never fires, PropEntity's draw()/drawGround() no-op for that propType).
console.log('Rule 13: every registerProp() module is imported by props.all.js barrel');
{
  const barrelPath = join(ROOT, 'js', 'entity', 'props.all.js');
  const barrelSrc  = readText(barrelPath);
  const barrelDir  = dirname(barrelPath);
  const imported = new Set(
    [...barrelSrc.matchAll(/^import\s+'(\.[^']+)'/gm)]
      .map(m => join(barrelDir, m[1]).replace(/\\/g, '/'))
  );

  const registerModules = new Set();
  for (const p of walkFiles(join(ROOT, 'js'), f => f.endsWith('.js'))) {
    if (p.endsWith('propRegistry.js') || p.endsWith('props.all.js')) continue;
    if (/registerProp\(\s*'[\w-]+'\s*,/.test(readText(p))) registerModules.add(p.replace(/\\/g, '/'));
  }

  const missing = [...registerModules].filter(p => !imported.has(p));
  if (missing.length > 0) {
    fail('registerProp() module(s) missing from props.all.js barrel:\n  ' + missing.join('\n  '));
  } else {
    console.log(`  ${registerModules.size} registerProp() module(s), all present in barrel`);
    okMsg();
  }
}

// ── Rule 14 ────────────────────────────────────────────────────────────────
// emitEvent() call sites must live in js/behavior/activities/ (W-1: single
// entry point WorldEventLog.js is exempt — that's the definition, not a call).
console.log('Rule 14: emitEvent() call sites confined to js/behavior/activities/');
{
  const activitiesDir = join(ROOT, 'js', 'behavior', 'activities');
  const hits = [];
  for (const p of walkFiles(join(ROOT, 'js'), f => f.endsWith('.js'))) {
    if (p.endsWith('WorldEventLog.js')) continue;
    if (p.startsWith(activitiesDir)) continue;
    const lines = readText(p).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue; // doc comments
      if (/\bemitEvent\(/.test(lines[i])) hits.push(`${p}:${i + 1}`);
    }
  }
  if (hits.length > 0) {
    fail('emitEvent() called outside js/behavior/activities/:\n  ' + hits.join('\n  '));
  } else {
    okMsg();
  }
}

// ── Rule 15 ────────────────────────────────────────────────────────────────
// generateClaims() call sites: exactly one, and it must live in
// BehaviorManager.js (W-7a — the single consumption point for WorldEventLog
// events). Belief.js itself defines the function (contains "function
// generateClaims(") — that's not a call site, skip it explicitly.
console.log('Rule 15: generateClaims() called exactly once, from BehaviorManager.js');
{
  const hits = [];
  for (const p of walkFiles(join(ROOT, 'js'), f => f.endsWith('.js'))) {
    const lines = readText(p).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
      if (/\bfunction\s+generateClaims\s*\(/.test(lines[i])) continue; // definition, not a call
      if (/\bgenerateClaims\(/.test(lines[i])) hits.push(`${p}:${i + 1}`);
    }
  }
  const outsideBM = hits.filter(h => !h.replace(/\\/g, '/').includes('BehaviorManager.js'));
  if (hits.length !== 1 || outsideBM.length > 0) {
    fail(`generateClaims() must be called exactly once, from BehaviorManager.js; found ${hits.length} call site(s):\n  ` + hits.join('\n  '));
  } else {
    okMsg();
  }
}

// ── Rule 16 ────────────────────────────────────────────────────────────────
// L-2: cycle clip groundTravel 左右支撑脚一致性静态门。ClipLibrary.js#_deriveGroundTravel
// 是浏览器 ES module（用 fetch 载入资产），这里独立重新实现同一套算法的纯 node 版本
// （与 Rule 4 对 manifest/skeleton 的直接读取同一套模式）：报告每个 cycle clip 的推导
// groundTravel（或显式声明值，跳过推导）；推导值 < 8 骨架单位判定非位移循环（时间驱动，
// 不检查左右一致性）；否则按贡献关节名分左右累计，偏差 > 20% 判定 clip 缺陷，fail。
// 正确性咬合验证（验完已还原）：把 walk.json frame 0 的 l_foot x 改动 15 单位后，本规则
// 从 walk: groundTravel=96.0 left=48.0 right=48.0 diff=0% 变为 FAIL（偏差 >20%）。
console.log('Rule 16: cycle clip groundTravel + 左右支撑脚一致性');
{
  const manifest  = readJson(join(ROOT, 'assets', 'manifest.json'));
  const skeletons = readJson(join(ROOT, 'assets', 'skeleton.json')).skeletons;
  const GROUND_TOL = 1, DISPLACEMENT_MIN = 8, CONSISTENCY_MAX_DIFF = 0.2;

  const jointSide = (name) => {
    if (/^l_|^fl_|^bl_/.test(name)) return 'left';
    if (/^r_|^fr_|^br_/.test(name)) return 'right';
    return null;
  };

  function expandFrames(raw) {
    let kfs = raw.keyframes;
    let amp = 1;
    if (raw.variant_of) {
      const baseEntry = manifest.clips[raw.variant_of];
      if (!baseEntry) return null;
      kfs = readJson(join(ROOT, 'assets', baseEntry.path)).keyframes;
      amp = raw.amp ?? 1;
    }
    const dp = skeletons[raw.skeleton ?? 'human']?.defaultPose ?? {};
    return (kfs ?? []).map(kf => {
      const frame = {};
      for (const [k, v] of Object.entries(kf)) {
        if (k === 'dur' || !Array.isArray(v) || v.length !== 2) continue;
        const base = dp[k] ?? [0, 0];
        frame[k] = [base[0] + v[0] * amp, base[1] + v[1] * amp];
      }
      for (const [k, v] of Object.entries(dp)) if (!(k in frame)) frame[k] = [...v];
      return frame;
    });
  }

  function deriveGroundTravel(frames) {
    const n = frames.length;
    let sumMin = 0;
    const perJoint = {};
    for (let i = 0; i < n; i++) {
      const f0 = frames[i], f1 = frames[(i + 1) % n];
      let best = null, bestJ = null;
      for (const [j, coords] of Object.entries(f0)) {
        if (Math.abs(coords[1]) > GROUND_TOL) continue;
        const dx = f1[j][0] - coords[0];
        if (best === null || dx < best) { best = dx; bestJ = j; }
      }
      if (best !== null) { sumMin += best; perJoint[bestJ] = (perJoint[bestJ] ?? 0) + best; }
    }
    return { travel: Math.abs(sumMin), perJoint };
  }

  let ruleOk = true;
  for (const [id, entry] of Object.entries(manifest.clips)) {
    if (entry.kind !== 'cycle') continue;
    const raw = readJson(join(ROOT, 'assets', entry.path));
    if (typeof raw.groundTravel === 'number') {
      console.log(`  ${id}: groundTravel=${raw.groundTravel}（显式声明，跳过左右一致性推导）`);
      continue;
    }
    const frames = expandFrames(raw);
    if (!frames || frames.length === 0) continue;
    const { travel, perJoint } = deriveGroundTravel(frames);
    if (travel < DISPLACEMENT_MIN) {
      console.log(`  ${id}: travel=${travel.toFixed(1)}（<${DISPLACEMENT_MIN}，非位移循环，时间驱动）`);
      continue;
    }
    let left = 0, right = 0;
    for (const [j, v] of Object.entries(perJoint)) {
      const side = jointSide(j);
      if (side === 'left') left += v; else if (side === 'right') right += v;
    }
    let diffPct = null;
    if (left !== 0 && right !== 0) {
      const mags = [Math.abs(left), Math.abs(right)];
      diffPct = Math.abs(mags[0] - mags[1]) / Math.max(...mags);
    }
    const diffStr = diffPct === null ? 'n/a' : (diffPct * 100).toFixed(0) + '%';
    console.log(`  ${id}: groundTravel=${travel.toFixed(1)} left=${left.toFixed(1)} right=${right.toFixed(1)} diff=${diffStr}`);
    if (diffPct !== null && diffPct > CONSISTENCY_MAX_DIFF) {
      fail(`${id}: 左右支撑脚位移不一致（偏差 ${(diffPct * 100).toFixed(0)}% > 20%）`);
      ruleOk = false;
    }
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
