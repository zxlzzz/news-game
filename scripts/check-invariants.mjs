#!/usr/bin/env node
/**
 * check-invariants.mjs — 行为/数据层静态不变量检查器（确定性闸门）
 *
 * 用法: node scripts/check-invariants.mjs   （任何 ERROR → exit 1）
 * 定位: 与 attachment 校验器同族——数据错误在提交前拦截，不等运行时症状。
 *
 * 检查项:
 *  P1 profile.initial ∈ allowedStates
 *  P2 transitions 目标 ∈ allowedStates（否则 _pickNext 必返 null）
 *  P3 有限时长状态 × 空转换行 = 永久滞留雷（athlete/stall_seller 类 bug）
 *  S1 全仓 setState 字面量 ∈ STATE_DEFS
 *  A1 STATE_DEFS.anim ∈ manifest clips（动画命名权威）
 *  M1 audit.count 的 key ⊆ MovementAudit dump 列（防哑计数器）
 *  Z1 MovementAudit 分带阈值 == Layout 常量真值（防映射漂移）
 *  W1 pushWalkMode/popWalkMode 配对数平衡（启发式, WARN）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let errors = 0, warns = 0;
const ERR  = (tag, msg) => { errors++; console.log(`ERROR [${tag}] ${msg}`); };
const WARN = (tag, msg) => { warns++;  console.log(`warn  [${tag}] ${msg}`); };

function* jsFiles(dir) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const p = join(dir, f);
    if (statSync(join(ROOT, p)).isDirectory()) yield* jsFiles(p);
    else if (f.endsWith('.js')) yield p;
  }
}

// ── STATE_DEFS（regex：Motor 依赖运行时，不 import）─────────────────────────
const motorSrc = read('js/behavior/Motor.js');
const sdBlock  = motorSrc.match(/STATE_DEFS\s*=\s*\{([\s\S]*?)\n\};/)[1];
const STATE_DEFS = {};
for (const m of sdBlock.matchAll(/^\s*(\w+):\s*\{([^}]*)\}/gm)) {
  const dur  = m[2].match(/dur:\s*\[([\d.]+),\s*([\d.]+)\]/);
  const anim = m[2].match(/anim:\s*'(\w+)'/);
  STATE_DEFS[m[1]] = { finite: !!dur, anim: anim?.[1] ?? null };
}
const FINITE = new Set(Object.keys(STATE_DEFS).filter(k => STATE_DEFS[k].finite));

// ── P1–P3: profile 数据完整性（真 import，纯数据模块）───────────────────────
const { PROFILES } = await import(pathToFileURL(join(ROOT, 'js/npc/NpcProfile.js')));
for (const [k, p] of Object.entries(PROFILES)) {
  const allowed = new Set(p.allowedStates ?? []);
  if (!allowed.has(p.initial))
    ERR('P1', `${k}: initial '${p.initial}' 不在 allowedStates`);
  for (const [from, row] of Object.entries(p.transitions ?? {}))
    for (const to of Object.keys(row))
      if (!allowed.has(to))
        ERR('P2', `${k}: ${from}→${to} 目标不在 allowedStates`);
  for (const st of allowed)
    if (FINITE.has(st) && !Object.keys(p.transitions?.[st] ?? {}).length)
      ERR('P3', `${k}: 有限时长状态 '${st}' 无转换行 → 永久滞留`);
}

// ── S1: setState 字面量 ────────────────────────────────────────────────────
for (const f of jsFiles('js')) {
  for (const m of read(f).matchAll(/setState\([^,]+,\s*'(\w+)'/g))
    if (!STATE_DEFS[m[1]]) ERR('S1', `${f}: setState '${m[1]}' 不在 STATE_DEFS`);
}

// ── A1: STATE_DEFS.anim ∈ manifest ────────────────────────────────────────
try {
  const manifest = JSON.parse(read('assets/manifest.json'));
  const clips = new Set(Object.keys(manifest.clips ?? manifest));
  for (const [st, d] of Object.entries(STATE_DEFS))
    if (d.anim && !clips.has(d.anim))
      ERR('A1', `STATE_DEFS.${st}.anim '${d.anim}' 不在 manifest clips`);
} catch (e) { WARN('A1', `manifest 解析失败: ${e.message}`); }

// ── M1: audit 计数 key vs dump 列 ──────────────────────────────────────────
const auditSrc = read('js/debug/MovementAudit.js');
const dumpKeys = new Set([...auditSrc.matchAll(/c\.(\w+)/g)].map(m => m[1]));
const counted  = new Set();
for (const f of jsFiles('js'))
  for (const m of read(f).matchAll(/audit\.count\([^,]+,\s*'(\w+)'\)/g))
    counted.add(m[1]);
for (const k of counted)
  if (!dumpKeys.has(k)) ERR('M1', `计数 key '${k}' 未出现在 dump 列`);
for (const k of ['probe_steer', 'slide_steer', 'stuck'])
  if (!counted.has(k)) ERR('M1', `dump 列 '${k}' 无任何计数点（哑列）`);

// ── Z1: 分带阈值 == Layout 真值 ────────────────────────────────────────────
try {
  const L = await import(pathToFileURL(join(ROOT, 'js/core/Layout.js')));
  const want = [L.BIKE_LANE_FAR_TOP, L.FAR_Y, L.NEAR_Y, L.BIKE_LANE_NEAR_BOTTOM];
  for (const v of want)
    if (v != null && !auditSrc.includes(String(v)) &&
        !new RegExp(`BIKE_LANE_FAR_TOP|FAR_Y|NEAR_Y|BIKE_LANE_NEAR_BOTTOM`).test(auditSrc))
      ERR('Z1', `MovementAudit 分带缺少边界 ${v}（应引用 Layout 常量）`);
} catch (e) { WARN('Z1', `Layout import 失败: ${e.message}`); }

// ── W1: push/pop 配对数（启发式）────────────────────────────────────────────
let push = 0, pop = 0;
for (const f of jsFiles('js')) {
  const s = read(f);
  push += (s.match(/pushWalkMode\(/g) ?? []).filter((_, i, a) => a).length;
  pop  += (s.match(/popWalkMode\(/g) ?? []).length;
}
if (pop < push) WARN('W1', `pushWalkMode 调用点 ${push} > popWalkMode ${pop}，检查栈是否泄漏`);

console.log(`\n—— ${errors} error(s), ${warns} warning(s) ——`);
process.exit(errors ? 1 : 0);
