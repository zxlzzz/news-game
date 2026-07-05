#!/usr/bin/env node
/**
 * validate.mjs — 校验 assets/animations/ 所有 JSON（已转换格式）
 *
 * 检查项:
 *   1. 关节名 ⊆ skeleton.json joints（含 body）
 *   2. delta 分量幅度 ≤120（|dx|≤120 且 |dy|≤120）
 *      注：骨长偏差检查已跳过——2D 美术动画存在透视缩短，骨长天然浮动 15–30%
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
// 加载骨骼
// ─────────────────────────────────────────────────────────────────────────────

const skel = JSON.parse(fs.readFileSync(SKEL_FILE, 'utf8'));
const VALID_JOINTS = new Set(Object.keys(skel.joints)); // neck,head,...
// body 是 root，转换后省略，但保留为合法名称以防万一
VALID_JOINTS.add('body');

const DELTA_MAX = 120; // 转换后单分量幅度上限（fall/get_up 极端姿态最大约 100）

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
  const rel = path.relative(ANIM_DIR, abs);
  const clip = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const violations = [];

  // sub_event / pet: 跳过 keyframe 检查
  // sub_event 保留 aDelta/bDelta 结构；pet 使用独立的狗骨骼，不在 skeleton.json 中
  if (clip.type === 'sub_event' || clip.type === 'pet' ||
      clip.aDelta != null || clip.bDelta != null) {
    return violations;
  }

  const keyframes = clip.keyframes ?? [];
  if (keyframes.length === 0) return violations;

  for (let fi = 0; fi < keyframes.length; fi++) {
    const kf = keyframes[fi];

    for (const [k, v] of Object.entries(kf)) {
      if (k === 'dur') continue;
      if (!Array.isArray(v)) continue;

      // 检查 1: 关节名合法性
      if (!VALID_JOINTS.has(k)) {
        violations.push(`frame ${fi}: unknown joint "${k}"`);
        continue;
      }

      // 检查 2: delta 分量幅度
      if (Math.abs(v[0]) > DELTA_MAX || Math.abs(v[1]) > DELTA_MAX) {
        violations.push(`frame ${fi}: joint "${k}" delta [${v[0]},${v[1]}] exceeds ±${DELTA_MAX}`);
      }
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
