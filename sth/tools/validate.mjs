#!/usr/bin/env node
/**
 * validate.mjs — 校验 assets/animations/ 所有 clip JSON（新 schema）
 *
 * 检查项:
 *   1. 顶层字段白名单（12 字段 + participants）
 *   2. kind 合法值
 *   3. transition: from/to 必须存在
 *   4. overlay: activeJoints 必须存在
 *   5. variant_of / overlay id 可解析（warn 不中止）
 *   6. 关节名属于声明骨架
 *   7. cycle 首末帧闭合（容差 12px）
 *   8. transition 首末帧衔接 from/to clip（容差 5px）—— warn only
 *   9. 地面契约: 首帧最低关节 y > 2 → warn（入地）; 首帧无接地点 → warn
 *  10. delta 分量 ≤ 180（超限 warn）
 *
 * 执行: node sth/tools/validate.mjs
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANIM_DIR  = path.resolve(__dirname, '../../assets/animations');
const SKEL_FILE = path.resolve(__dirname, '../../assets/skeleton.json');

// ─── Schema ───────────────────────────────────────────────────────────────────

const WHITELIST = new Set([
  'id', 'kind', 'keyframes', 'skeleton', 'facing',
  'from', 'to',
  'activeJoints', 'latched',
  'ref_speed',
  'variant_of', 'when', 'amp',
  'participants',
]);

const VALID_KINDS    = new Set(['cycle', 'transition', 'overlay']);
const VALID_FACINGS  = new Set(['side', 'front']);
const VALID_SKELETONS = new Set(['human', 'dog']);
const DELTA_WARN     = 180;
const GROUND_TOL     = 2;    // y > 2 → warn (入地)
const CLOSURE_TOL    = 12;   // cycle 首末帧闭合容差 px
const TRANSITION_TOL = 5;    // transition 衔接容差 px
const BONE_LEN_TOL   = 3;    // 骨长偏差容差 px（仅非人类骨架；人类动画允许自由拉伸）

// ─── Load skeletons ───────────────────────────────────────────────────────────

const skelData = JSON.parse(fs.readFileSync(SKEL_FILE, 'utf8'));
const SKELETONS = skelData.skeletons;
if (!SKELETONS) { console.error('skeleton.json missing "skeletons" key'); process.exit(1); }

/** All valid joint names for a skeleton (including root) */
function buildValidJoints(skel) {
  const s = new Set(Object.keys(skel.joints));
  s.add(skel.root);
  return s;
}
const VALID_JOINTS = {
  human: buildValidJoints(SKELETONS.human),
  dog:   buildValidJoints(SKELETONS.dog),
};

/** defaultPose as {joint: [x,y]} */
function getDefaultPose(skelName) {
  const skel = SKELETONS[skelName];
  return skel?.defaultPose ?? {};
}

// ─── Walk directory ───────────────────────────────────────────────────────────

function walkDir(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else if (e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

// ─── Load all clips for cross-reference ──────────────────────────────────────

function loadAll(files) {
  const map = {};   // id → clip
  for (const abs of files) {
    try {
      const c = JSON.parse(fs.readFileSync(abs, 'utf8'));
      if (c.id) map[c.id] = { ...c, _abs: abs };
    } catch {}
  }
  return map;
}

// ─── Per-file validation ──────────────────────────────────────────────────────

function validateFile(abs, allClips) {
  const rel = path.relative(ANIM_DIR, abs);
  let clip;
  try { clip = JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch (e) { return { errors: [`parse error: ${e.message}`], warns: [] }; }

  const errors = [];
  const warns  = [];
  const E = msg => errors.push(msg);
  const W = msg => warns.push(msg);

  // 1. Field whitelist
  for (const k of Object.keys(clip)) {
    if (!WHITELIST.has(k)) E(`unknown field: "${k}"`);
  }

  // 2. kind
  if (!clip.kind) E('missing "kind"');
  else if (!VALID_KINDS.has(clip.kind)) E(`invalid kind: "${clip.kind}"`);

  // 3. id
  if (!clip.id) E('missing "id"');

  // 4. skeleton / facing defaults
  if (clip.skeleton && !VALID_SKELETONS.has(clip.skeleton))
    E(`invalid skeleton: "${clip.skeleton}"`);
  if (clip.facing && !VALID_FACINGS.has(clip.facing))
    E(`invalid facing: "${clip.facing}"`);

  // 5. transition requires from/to
  if (clip.kind === 'transition') {
    if (!clip.from) W('"from" missing on transition');
    if (!clip.to)   W('"to" missing on transition');
  }

  // 6. overlay requires activeJoints (unless duet with participants only)
  if (clip.kind === 'overlay' && !clip.participants) {
    if (!clip.activeJoints || !Array.isArray(clip.activeJoints) || clip.activeJoints.length === 0)
      W('"activeJoints" missing or empty on overlay');
  }

  // 7. variant_of resolves
  if (clip.variant_of) {
    if (!allClips[clip.variant_of])
      W(`variant_of "${clip.variant_of}" not found in manifest`);
  }

  // 8. Validate keyframes
  const kfs = clip.keyframes;
  const skelName = clip.skeleton ?? 'human';
  const validJoints = VALID_JOINTS[skelName] ?? VALID_JOINTS.human;
  const dp = getDefaultPose(skelName);

  if (kfs && Array.isArray(kfs)) {
    // Check for duet keyframes (grouped by role): values are plain objects, not arrays
    const isRoleGrouped = kfs.length > 0 && kfs[0] && typeof kfs[0] === 'object' &&
      !Array.isArray(kfs[0]) && Object.keys(kfs[0]).every(k => {
        if (k === 'dur') return true;
        const v = kfs[0][k];
        return typeof v === 'object' && v !== null && !Array.isArray(v);
      });

    for (let fi = 0; fi < kfs.length; fi++) {
      const kf = kfs[fi];
      if (!kf || typeof kf !== 'object') continue;

      if (isRoleGrouped) {
        // Duet format: {dur?, role: {joint: [dx,dy]}}
        // Resolve per-role skeleton from participants array
        const roleSkels = {};
        for (const p of (clip.participants ?? [])) {
          roleSkels[p.role] = p.skeleton ?? 'human';
        }
        for (const [role, roleData] of Object.entries(kf)) {
          if (role === 'dur') continue;
          if (typeof roleData !== 'object' || Array.isArray(roleData)) continue;
          const roleSkelName = roleSkels[role] ?? skelName;
          const roleValidJoints = VALID_JOINTS[roleSkelName] ?? VALID_JOINTS.human;
          for (const [j, v] of Object.entries(roleData)) {
            if (!roleValidJoints.has(j))
              E(`frame ${fi} role "${role}": unknown joint "${j}"`);
            if (Array.isArray(v) && (Math.abs(v[0]) > DELTA_WARN || Math.abs(v[1]) > DELTA_WARN))
              W(`frame ${fi} role "${role}" joint "${j}": delta [${v[0]},${v[1]}] > ±${DELTA_WARN}`);
          }
        }
      } else {
        // Normal format: {joint: [dx,dy]}
        for (const [k, v] of Object.entries(kf)) {
          if (k === 'dur') continue;
          if (!Array.isArray(v) || v.length !== 2) continue;
          if (!validJoints.has(k)) E(`frame ${fi}: unknown joint "${k}"`);
          if (Math.abs(v[0]) > DELTA_WARN || Math.abs(v[1]) > DELTA_WARN)
            W(`frame ${fi} joint "${k}": delta [${v[0]},${v[1]}] > ±${DELTA_WARN}`);
        }
      }
    }

    // 9. Ground contract: first frame lowest joint
    if (!isRoleGrouped && kfs.length > 0 && Object.keys(dp).length > 0) {
      const kf0 = kfs[0];
      let maxAbsY = -Infinity;
      for (const [j, v] of Object.entries(kf0)) {
        if (j === 'dur' || !Array.isArray(v)) continue;
        if (!validJoints.has(j)) continue;
        const dpY = (dp[j] ?? [0, 0])[1];
        const absY = dpY + v[1];
        if (absY > maxAbsY) maxAbsY = absY;
      }
      if (maxAbsY > GROUND_TOL)
        W(`ground: first frame lowest joint at y=${maxAbsY.toFixed(1)} > ${GROUND_TOL} (入地)`);
      if (maxAbsY < -GROUND_TOL && kfs.length > 1)
        W(`ground: first frame no joint near y=0 (lowest=${maxAbsY.toFixed(1)})`);
    }

    // 10. cycle: first/last frame closure
    if (clip.kind === 'cycle' && kfs.length > 1 && !isRoleGrouped) {
      const kf0 = kfs[0];
      const kfN = kfs[kfs.length - 1];
      for (const j of Object.keys(kf0)) {
        if (j === 'dur' || !Array.isArray(kf0[j])) continue;
        if (!kfN[j]) continue;
        const dx = Math.abs((kf0[j][0]) - (kfN[j][0]));
        const dy = Math.abs((kf0[j][1]) - (kfN[j][1]));
        if (dx > CLOSURE_TOL || dy > CLOSURE_TOL)
          W(`cycle: joint "${j}" not closed (Δ=[${dx.toFixed(1)},${dy.toFixed(1)}] > ${CLOSURE_TOL}px)`);
      }
    }
    // 11. Bone length validation (non-human/non-child; human clips use free-stretch intentionally)
    if (!isRoleGrouped && skelName !== 'human' && skelName !== 'child' && Object.keys(dp).length > 0) {
      const jointsInfo = SKELETONS[skelName]?.joints ?? {};
      const maxDevByBone = {};
      for (const kf of kfs) {
        const absPos = {};
        for (const [j, dpCoords] of Object.entries(dp)) {
          const delta = kf[j];
          absPos[j] = Array.isArray(delta) && delta.length === 2
            ? [dpCoords[0] + delta[0], dpCoords[1] + delta[1]]
            : [dpCoords[0], dpCoords[1]];
        }
        for (const [child, info] of Object.entries(jointsInfo)) {
          if (!info.len || !absPos[child] || !absPos[info.parent]) continue;
          const actual = Math.hypot(
            absPos[child][0] - absPos[info.parent][0],
            absPos[child][1] - absPos[info.parent][1]
          );
          const dev = Math.abs(actual - info.len);
          if (dev > (maxDevByBone[child] ?? 0)) maxDevByBone[child] = dev;
        }
      }
      for (const [child, dev] of Object.entries(maxDevByBone)) {
        if (dev > BONE_LEN_TOL) {
          const info = jointsInfo[child];
          W(`bone "${info.parent}"→"${child}": length deviation ${dev.toFixed(1)}px > ±${BONE_LEN_TOL}`);
        }
      }
    }
  } else if (clip.kind && clip.kind !== 'cycle') {
    // variant parameter-only clips may have no keyframes (ok for cycle with variant_of)
    if (!clip.variant_of && clip.kind !== 'overlay') {
      W('no keyframes');
    }
  }

  return { errors, warns };
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const files = walkDir(ANIM_DIR);
const allClips = loadAll(files);

let errCount = 0, warnCount = 0;
const warnLines = [];

for (const abs of files) {
  const rel = path.relative(ANIM_DIR, abs);
  const { errors, warns } = validateFile(abs, allClips);

  if (errors.length > 0) {
    errCount++;
    for (const msg of errors) console.error(`  ERROR  ${rel}: ${msg}`);
  }
  for (const msg of warns) {
    warnCount++;
    warnLines.push(`  WARN   ${rel}: ${msg}`);
  }
}

for (const l of warnLines) console.warn(l);

console.log(`\nValidated ${files.length} clips: ${errCount} errors, ${warnCount} warnings`);
if (errCount > 0) process.exit(1);
