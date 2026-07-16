/**
 * headless-sim.mjs — 无头行为仿真 harness
 *
 * 用法:
 *   node scripts/headless-sim.mjs [--minutes N] [--seed S] [--compare <pre-file>]
 *
 * 输出: docs/baselines/<YYYY-MM-DD>-<sha8>[-pre|-post].md
 * 若传 --compare <pre-file>，当前结果为 "post"，同时生成对照摘要。
 *
 * 实现约束:
 *   - 不改任何生产代码结构；所有渲染/浏览器依赖用最小 stub 顶掉
 *   - window 全局 shim 必须在所有 import 之前注册（动态 import 保证顺序）
 *   - 固定步长 dt = 1/60 s；帧数 = minutes × 60 × 60
 *
 * 能力边界:
 *   能验：行为状态转换正确性、NPC 离场成功率、stuck 计数、dir_mismatch / speed0_walk 审计指标、
 *         routing_with_walkmode 互斥约束；种子固定时结果完全确定性可复现。
 *   不能验：渲染正确性（无 PIXI / Canvas）、玩家交互流程、真实帧率抖动、
 *            实体视觉深度排序、CSS/DOM 叠加层。
 *   已修分歧：① NavGrid 空实体烘焙（bake([])走 Y 分带默认值，与游戏主路径等价）；
 *             ② mot.vel 通道提前清除（integratePhysics line 288 `mot.vel=null` 后
 *                line 303 `if(!mot.vel)` 恒真，vy 由 npc.vy 单独通道传递，harness 行为与游戏一致）。
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { execSync }  from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getFlag = (flag, def = null) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const MINUTES  = parseFloat(getFlag('--minutes', '10'));
const SEED     = getFlag('--seed');
const COMPARE  = getFlag('--compare');  // path to pre-fix baseline file

// ─── seeded PRNG ─────────────────────────────────────────────────────────────
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
if (SEED !== null) {
  Math.random = mulberry32(parseInt(SEED, 10));
  console.log(`[headless-sim] seed=${SEED}`);
}

// ─── window shim — MUST be before any import of Motor / StuckProbe ───────────
globalThis.window = { __stuck: [], __motorViolations: 0, __motorDebug: false };

// ─── all game module imports (dynamic so window shim is already set) ─────────
const { NavGrid, setNavGrid }         = await import('../js/behavior/nav/NavGrid.js');
const { EntityManager }               = await import('../js/core/EntityManager.js');
const { BehaviorManager }             = await import('../js/behavior/BehaviorManager.js');
const { ExitRegistry }                = await import('../js/npc/ExitRegistry.js');
const { initCrosswalks, initWalkPaths } = await import('../js/behavior/WalkMode.js');
const { audit }                       = await import('../js/debug/MovementAudit.js');
const { spawnPedestrians, spawnOnePedestrian } = await import('../js/npc/Pedestrians.js');
const { spawnAthletes }               = await import('../js/npc/Athletes.js');
const { expandSceneData }             = await import('../js/core/sceneData.js');
const { WORLD_WIDTH, FAR_Y, NEAR_Y, BUILDING_BASE_Y, PARK_BOTTOM } =
  await import('../js/core/Layout.js');

// ─── stub: minimal StickRenderer (no PIXI, no canvas) ────────────────────────
const stubRenderer = {
  getAnimation: () => ({ fps: 12, frameCount: 8, frames: new Array(8).fill({}) }),
  loadAnimation: () => {},
};

// ─── scene data ──────────────────────────────────────────────────────────────
const rawScene = JSON.parse(readFileSync(join(ROOT, 'assets/scene.json'), 'utf8'));
const { layout } = expandSceneData(rawScene);

// ─── NavGrid ─────────────────────────────────────────────────────────────────
// Pass empty entities array — Y-band defaults + walkPaths are enough for pedestrian testing.
const navGrid = new NavGrid();
navGrid.bake([], layout);
setNavGrid(navGrid);

// ─── WalkMode paths + crosswalks ─────────────────────────────────────────────
initWalkPaths(layout.walkPaths ?? {});
initCrosswalks(layout.crosswalks ?? []);

// ─── ExitRegistry ────────────────────────────────────────────────────────────
const exitReg = new ExitRegistry();
exitReg.register({ id: 'edge_left',  type: 'edge', x: -40,              y: null,
                   yZone: [BUILDING_BASE_Y, FAR_Y],  facing: -1 });
exitReg.register({ id: 'edge_right', type: 'edge', x: WORLD_WIDTH + 40, y: null,
                   yZone: [BUILDING_BASE_Y, FAR_Y],  facing:  1 });
exitReg.register({ id: 'park_left',  type: 'edge', x: -40,              y: null,
                   yZone: [NEAR_Y, PARK_BOTTOM],     facing: -1 });
exitReg.register({ id: 'park_right', type: 'edge', x: WORLD_WIDTH + 40, y: null,
                   yZone: [NEAR_Y, PARK_BOTTOM],     facing:  1 });

// ─── EntityManager + BehaviorManager ─────────────────────────────────────────
const em = new EntityManager();
const bm = new BehaviorManager(em, null);   // null poseCache → no ModifierLayer poses
bm.exitRegistry = exitReg;

// ─── spawn points (routes deleted from scene.json; use fixed edge points) ─────
const spawnPoints = [
  { x: 60,   y: 230, facing:  1 },
  { x: 1940, y: 230, facing: -1 },
  { x: 60,   y: 420, facing:  1 },
  { x: 1940, y: 420, facing: -1 },
];

spawnPedestrians(em, stubRenderer, bm, spawnPoints, 20);
spawnAthletes(em, stubRenderer, bm);

const allNpcs = bm.npcs;
console.log(`[headless-sim] ${allNpcs.length} NPCs spawned`);

// ─── tick loop ────────────────────────────────────────────────────────────────
const TOTAL_FRAMES = Math.round(MINUTES * 60 * 60);
const DT_MS        = (1 / 60) * 1000;   // fixed 60 fps step in milliseconds

// progress heartbeat every simulated minute
let heartbeatFrame = Math.round(60 * 60);
let heartbeatMin   = 1;
let aliveMin = allNpcs.length, aliveMax = 0;

let departedOk = 0;
for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  // Track per-attempt departure duration (harness-only: _depSince must not enter js/ code)
  for (const npc of allNpcs) {
    const ag  = npc.mem('agenda');
    const mot = npc.mem('motor');
    // New departure attempt starting (routeTarget with exitType just appeared)
    if (npc.alive && mot.routeTarget?.exitType && npc._depSince == null) {
      npc._depSince = frame;
    }
    // Attempt ended without death: E2 cleared departing or ExitSceneTask aborted
    if (npc.alive && npc._depSince != null && !ag.departing && !mot.routeTarget?.exitType) {
      npc._depSince = null;
    }
    // Success: NPC died on arrival
    if (!npc.alive && npc._depSince != null) {
      departedOk++;
      npc._depSince = null;
    }
  }

  em.update(DT_MS);
  bm.update(DT_MS);

  // replenish departed NPCs to keep population ~stable
  const alive = allNpcs.filter(n => n.alive).length;
  if (alive < aliveMin) aliveMin = alive;
  if (alive > aliveMax) aliveMax = alive;
  if (alive < 15) {
    const pt = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    spawnOnePedestrian('pedestrian', em, stubRenderer, bm, { x: pt.x, y: pt.y });
  }

  if (frame >= heartbeatFrame) {
    process.stdout.write(`\r[headless-sim] ${heartbeatMin}/${MINUTES} min  alive=${allNpcs.filter(n=>n.alive).length}`);
    heartbeatMin++;
    heartbeatFrame += Math.round(60 * 60);
  }
}
console.log();
console.log(`[headless-sim] done. alive range ${aliveMin}–${aliveMax}`);

// ─── post-sim assertions ──────────────────────────────────────────────────────
// Zombie = alive NPC whose current departure attempt has been running >90s (abandonAfter=60 + grace)
// In-flight departures (<90s) are normal and excluded.
const zombies = allNpcs.filter(n => {
  if (!n.alive || !n.mem('agenda').departing) return false;
  if (n._depSince == null) return false;
  return (TOTAL_FRAMES - n._depSince) / 60 > 90;
}).length;
const auditRowsRaw  = audit.rows(allNpcs);
const totalRowRaw   = auditRowsRaw[auditRowsRaw.length - 1];
const routingWM     = totalRowRaw.routing_with_walkmode ?? 0;

let assertFailed = false;
if (departedOk === 0) {
  console.error(`[ASSERT FAIL] departedOk=0 — no NPC successfully departed`);
  assertFailed = true;
}
if (zombies !== 0) {
  console.error(`[ASSERT FAIL] zombies=${zombies} — alive NPCs stuck in departing >90s`);
  assertFailed = true;
}
if (routingWM > 1) {
  console.error(`[ASSERT FAIL] routing_with_walkmode=${routingWM} > 1`);
  assertFailed = true;
}
if (!assertFailed) {
  console.log(`[headless-sim] assertions PASSED  departedOk=${departedOk}  zombies=${zombies}  routing_with_walkmode=${routingWM}`);
}

// ─── collect results ──────────────────────────────────────────────────────────
const auditRows  = audit.rows(allNpcs);
const totalRow   = auditRows[auditRows.length - 1];
const stuckFinal = window.__stuck.slice();

// ─── markdown helpers ─────────────────────────────────────────────────────────
function mdTable(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const header = '| ' + keys.join(' | ') + ' |';
  const sep    = '| ' + keys.map(() => '---').join(' | ') + ' |';
  const body   = rows.map(r => '| ' + keys.map(k => String(r[k] ?? '')).join(' | ') + ' |').join('\n');
  return [header, sep, body].join('\n');
}

function metricLine(label, val, ref) {
  if (ref === undefined) return `- **${label}**: ${val}`;
  const delta = val - ref;
  const sign  = delta > 0 ? '+' : '';
  return `- **${label}**: ${val} (${sign}${delta} vs pre)`;
}

// ─── git sha ──────────────────────────────────────────────────────────────────
let sha8 = 'unknown';
try { sha8 = execSync('git rev-parse --short=8 HEAD', { cwd: ROOT }).toString().trim(); }
catch (_) { /* not a git repo or no HEAD */ }

const dateStr  = new Date().toISOString().slice(0, 10);
const label    = COMPARE ? 'post' : 'pre';
const filename = `${dateStr}-${sha8}-s${SEED ?? 'x'}-${label}.md`;
const outPath  = join(ROOT, 'docs/baselines', filename);
mkdirSync(join(ROOT, 'docs/baselines'), { recursive: true });

// ─── parse pre-fix baseline for comparison ────────────────────────────────────
let preTotals = null;
if (COMPARE) {
  try {
    const preContent = readFileSync(COMPARE, 'utf8');
    const m = preContent.match(/<!--totals:(\{.*?\})-->/s);
    if (m) preTotals = JSON.parse(m[1]);
  } catch (e) {
    console.warn('[headless-sim] could not parse pre-fix totals from', COMPARE, e.message);
  }
}

// embed totals as hidden comment for future --compare reads
const totalsComment = `<!--totals:${JSON.stringify({
  stuck:                 totalRow.stuck,
  slide_steer:           totalRow.slide_steer,
  dir_mismatch:          totalRow.dir_mismatch,
  speed0_walk:           totalRow.speed0_walk,
  routing_with_walkmode: totalRow.routing_with_walkmode,
  departedOk,
  zombies,
})}-->`;

// ─── build markdown ───────────────────────────────────────────────────────────
const lines = [];
lines.push(`# Headless Sim Baseline — ${label}`);
lines.push('');
lines.push(`- **date**: ${dateStr}  **sha**: ${sha8}  **seed**: ${SEED ?? 'none'}  **minutes**: ${MINUTES}`);
lines.push('');

if (COMPARE && preTotals) {
  lines.push('## Diff Summary (post − pre)');
  lines.push('');
  lines.push(metricLine('stuck',        totalRow.stuck,        preTotals.stuck));
  lines.push(metricLine('slide_steer',  totalRow.slide_steer,  preTotals.slide_steer));
  lines.push(metricLine('dir_mismatch', totalRow.dir_mismatch, preTotals.dir_mismatch));
  lines.push(metricLine('speed0_walk',  totalRow.speed0_walk,  preTotals.speed0_walk));
  lines.push('');
}

lines.push('## Audit Table');
lines.push('');
lines.push(mdTable(auditRows));
lines.push('');

if (COMPARE) {
  try {
    const preContent = readFileSync(COMPARE, 'utf8');
    const preTableMatch = preContent.match(/## Audit Table\n\n([\s\S]*?)(?:\n## |$)/);
    if (preTableMatch) {
      lines.push('## Pre-fix Audit Table (reference)');
      lines.push('');
      lines.push(preTableMatch[1].trim());
      lines.push('');
    }
  } catch (_) {}
}

lines.push('## StuckProbe Last Snapshot');
lines.push('');
lines.push('```json');
lines.push(JSON.stringify(stuckFinal, null, 2));
lines.push('```');
lines.push('');
lines.push(totalsComment);

writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`[headless-sim] baseline written → ${outPath}`);
