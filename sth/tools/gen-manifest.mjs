#!/usr/bin/env node
/**
 * gen-manifest.mjs — 扫描 assets/animations/ 生成纯派生索引 assets/manifest.json
 *
 * 格式: { "clips": { "<id>": { path, kind, facing, skeleton, variant_of } } }
 *
 * id   = 文件 basename（去 .json）
 * kind = 一级目录名（cycle / overlay / transition）；
 *        variant/ 目录下的 clip 从 base clip 继承 kind（两遍扫描）。
 * facing / skeleton / variant_of 读自 clip JSON；facing 省略时默认 'side'。
 *
 * 跳过 new_assets/ 子目录（校对中的原始素材，尚未注册）。
 *
 * 执行: node sth/tools/gen-manifest.mjs
 */

import fs            from 'node:fs';
import path          from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync }  from 'node:child_process';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const ANIM_DIR    = path.resolve(__dirname, '../../assets/animations');
const MANIFEST    = path.resolve(__dirname, '../../assets/manifest.json');
const VALIDATE    = path.resolve(__dirname, './validate.mjs');

// 1. Run validate first (errors abort; warns are ok)
try {
  execFileSync(process.execPath, [VALIDATE], { stdio: 'inherit' });
} catch {
  console.error('\nAborted: fix validation errors before generating manifest.');
  process.exit(1);
}

// 2. Scan clips
function walkDir(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else if (e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

const clips = {};
const dupes = [];
const MANIFEST_DIR = path.dirname(MANIFEST);

// First pass: cycle / overlay / transition directories
for (const abs of walkDir(ANIM_DIR)) {
  const relFromAnimDir = path.relative(ANIM_DIR, abs).replace(/\\/g, '/');

  // Skip new_assets/ — unreviewed raw assets not yet registered
  if (relFromAnimDir.startsWith('new_assets/')) continue;

  const topDir = relFromAnimDir.split('/')[0];

  // variant/ is resolved in second pass
  if (topDir === 'variant') continue;

  // Only process known kind directories
  if (topDir !== 'cycle' && topDir !== 'overlay' && topDir !== 'transition') continue;

  let clip;
  try { clip = JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch { continue; }

  const id      = path.basename(abs, '.json');
  const kind    = topDir;
  const relPath = path.relative(MANIFEST_DIR, abs).replace(/\\/g, '/');
  const { facing, skeleton, variant_of } = clip;

  if (clips[id]) {
    dupes.push(`duplicate id "${id}": ${relPath} vs ${clips[id].path}`);
    continue;
  }

  const entry = { path: relPath, kind };
  if (facing   && facing   !== 'side')  entry.facing     = facing;
  if (skeleton && skeleton !== 'human') entry.skeleton   = skeleton;
  if (variant_of)                        entry.variant_of = variant_of;
  clips[id] = entry;
}

// Second pass: variant/ directory — inherit kind from base clip
for (const abs of walkDir(ANIM_DIR)) {
  const relFromAnimDir = path.relative(ANIM_DIR, abs).replace(/\\/g, '/');
  if (!relFromAnimDir.startsWith('variant/')) continue;

  let clip;
  try { clip = JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch { continue; }

  const id      = path.basename(abs, '.json');
  const relPath = path.relative(MANIFEST_DIR, abs).replace(/\\/g, '/');
  const { facing, skeleton, variant_of } = clip;

  if (clips[id]) {
    dupes.push(`duplicate id "${id}": ${relPath} vs ${clips[id].path}`);
    continue;
  }

  const baseKind = (variant_of && clips[variant_of]?.kind) ?? 'cycle';
  const entry = { path: relPath, kind: baseKind };
  if (facing   && facing   !== 'side')  entry.facing     = facing;
  if (skeleton && skeleton !== 'human') entry.skeleton   = skeleton;
  if (variant_of)                        entry.variant_of = variant_of;
  clips[id] = entry;
}

if (dupes.length > 0) {
  console.error('\nDuplicate clip IDs:');
  dupes.forEach(d => console.error('  ' + d));
  process.exit(1);
}

// 3. Check variant_of references
const dangling = [];
for (const [id, entry] of Object.entries(clips)) {
  if (entry.variant_of && !clips[entry.variant_of])
    dangling.push(`"${id}" variant_of="${entry.variant_of}" — not found`);
}
if (dangling.length > 0) {
  console.warn('\nDangling variant_of references (warn):');
  dangling.forEach(d => console.warn('  ' + d));
}

fs.writeFileSync(MANIFEST, JSON.stringify({ clips }, null, 2) + '\n');
console.log(`\nManifest written: ${Object.keys(clips).length} clips → assets/manifest.json`);
