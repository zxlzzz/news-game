#!/usr/bin/env node
/**
 * validate.mjs — 校验 assets/animations/ 所有 JSON（已转换格式）
 *
 * 检查项:
 *   1. 关节名 ⊆ 对应骨架的 joints（含 root 节点名）
 *      未知关节 = 违规；按 clip.skeleton 字段选骨架（缺省 human，pet → dog）
 *   2. delta 分量幅度 ≤120（|dx|≤120 且 |dy|≤120）
 *
 * 执行: node sth/tools/validate.mjs
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANIM_DIR  = path.resolve(__dirname, '../../assets/animations');
const SKEL_FILE = path.resolve(__dirname, '../../assets/skeleton.json');

// ─────────────────────────────────────────────────────────────────────────────
// 加载骨架
// ─────────────────────────────────────────────────────────────────────────────

const skelFile = JSON.parse(fs.readFileSync(SKEL_FILE, 'utf8'));
const SKELETONS = skelFile.skeletons; // { human: {...}, dog: {...} }

if (!SKELETONS) {
  console.error('skeleton.json missing "skeletons" key');
  process.exit(1);
}

/** 构造骨架的合法关节集合（含 root 节点名） */
function buildValidSet(skel) {
  const s = new Set(Object.keys(skel.joints));
  s.add(skel.root); // root 节点本身（body / body_back）
  return s;
}

const VALID = {
  human: buildValidSet(SKELETONS.human),
  dog:   buildValidSet(SKELETONS.dog),
};

const DELTA_MAX = 120;

// ─────────────────────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────────────────────

function walkDir(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else if (e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 校验单个文件
// ─────────────────────────────────────────────────────────────────────────────

function validateFile(abs) {
  const rel  = path.relative(ANIM_DIR, abs);
  const clip = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const violations = [];

  // sub_event: 跳过 keyframe 检查（保留 aDelta/bDelta 结构，无 keyframes）
  if (clip.type === 'sub_event' || clip.aDelta != null || clip.bDelta != null) {
    return violations;
  }

  const keyframes = clip.keyframes ?? [];
  if (keyframes.length === 0) return violations;

  // 选骨架: clip.skeleton === 'dog' → dog; 否则 human
  const skelName = clip.skeleton === 'dog' ? 'dog' : 'human';
  const validJoints = VALID[skelName];

  for (let fi = 0; fi < keyframes.length; fi++) {
    const kf = keyframes[fi];

    for (const [k, v] of Object.entries(kf)) {
      if (k === 'dur') continue;
      if (!Array.isArray(v)) continue;

      // 检查 1: 关节名合法性（所有未知关节均为违规）
      if (!validJoints.has(k)) {
        violations.push(`frame ${fi}: unknown joint "${k}" (skeleton: ${skelName})`);
        continue;
      }

      // 检查 2: delta 分量幅度
      if (Math.abs(v[0]) > DELTA_MAX || Math.abs(v[1]) > DELTA_MAX) {
        violations.push(`frame ${fi}: joint "${k}" delta [${v[0]},${v[1]}] exceeds ±${DELTA_MAX}`);
      }
    }
  }

  // 检查 3: blend_mode 合法值
  const BLEND_MODES = new Set(['additive', 'override', 'replace']);
  if (!BLEND_MODES.has(clip.blend_mode)) {
    violations.push(`blend_mode "${clip.blend_mode}" must be one of: additive, override, replace`);
  }

  // 检查 4: interrupt 合法值
  const INTERRUPT_MODES = new Set(['committed', 'blend', 'cut']);
  if (!INTERRUPT_MODES.has(clip.interrupt)) {
    violations.push(`interrupt "${clip.interrupt}" must be one of: committed, blend, cut`);
  }

  // 检查 5: weight 必须是正数
  if (typeof clip.weight !== 'number' || clip.weight <= 0) {
    violations.push(`weight "${clip.weight}" must be a positive number`);
  }

  // 检查 6: loop===false && type==="base" → from/to 必须是非空字符串
  if (clip.loop === false && clip.type === 'base') {
    if (typeof clip.from !== 'string' || clip.from === '') {
      violations.push(`loop=false base clip must have non-null "from" string`);
    }
    if (typeof clip.to !== 'string' || clip.to === '') {
      violations.push(`loop=false base clip must have non-null "to" string`);
    }
  }

  return violations.map(v => `  ${rel}: ${v}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 执行
// ─────────────────────────────────────────────────────────────────────────────

const files = walkDir(ANIM_DIR);
let checked = 0, failCount = 0;
const allViolations = [];

for (const abs of files) {
  try {
    const v = validateFile(abs);
    checked++;
    if (v.length > 0) {
      failCount++;
      allViolations.push(...v);
    }
  } catch (e) {
    const rel = path.relative(ANIM_DIR, abs);
    allViolations.push(`  ${rel}: PARSE ERROR — ${e.message}`);
    failCount++;
  }
}

if (allViolations.length > 0) {
  console.error(`\nValidation FAILED (${failCount}/${checked} files):\n`);
  for (const v of allViolations) console.error(v);
  process.exit(1);
} else {
  console.log(`Validation OK: ${checked} files checked, 0 violations.`);
}
