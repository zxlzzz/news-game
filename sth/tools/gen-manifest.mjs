#!/usr/bin/env node
/**
 * gen-manifest.mjs — 校验后生成 assets/manifest.json
 *
 * 执行: node sth/tools/gen-manifest.mjs
 *
 * 输出格式:
 * {
 *   "clips": {
 *     "<id>": { "path": "...", "type": "...", "facing": ..., "variant_of": ..., "tags": [], "loop": ... }
 *   }
 * }
 */

import fs            from 'node:fs';
import path          from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync }  from 'node:child_process';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const ANIM_DIR    = path.resolve(__dirname, '../../assets/animations');
const MANIFEST    = path.resolve(__dirname, '../../assets/manifest.json');
const VALIDATE    = path.resolve(__dirname, './validate.mjs');

// ─────────────────────────────────────────────────────────────────────────────
// 1. 先跑 validate
// ─────────────────────────────────────────────────────────────────────────────

try {
  execFileSync(process.execPath, [VALIDATE], { stdio: 'inherit' });
} catch {
  console.error('\nAborted: fix validation errors before generating manifest.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 扫描，生成 clips 索引
// ─────────────────────────────────────────────────────────────────────────────

function walkDir(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else if (e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

const clips = {};
const files = walkDir(ANIM_DIR);
const dupes = [];

for (const abs of files) {
  const clip = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const { id, type, facing, variant_of, tags, loop } = clip;
  const relPath = path.relative(path.dirname(MANIFEST), abs).replace(/\\/g, '/');

  if (!id) {
    console.warn(`  WARN: no id in ${path.relative(ANIM_DIR, abs)}`);
    continue;
  }

  if (clips[id]) {
    dupes.push(`  duplicate id "${id}": ${relPath} vs ${clips[id].path}`);
  }

  clips[id] = {
    path: relPath,
    type: type ?? 'base',
    facing: facing ?? null,
    variant_of: variant_of ?? null,
    tags: tags ?? [],
    loop: loop ?? true,
  };
}

if (dupes.length > 0) {
  console.error('\nDuplicate clip IDs found:');
  dupes.forEach(d => console.error(d));
  process.exit(1);
}

// ── 悬空 variant_of 检查 ─────────────────────────────────────────────────────
const dangling = [];
for (const [id, clip] of Object.entries(clips)) {
  if (clip.variant_of && !clips[clip.variant_of]) {
    dangling.push(`  "${id}" variant_of="${clip.variant_of}" — not found in manifest`);
  }
}
if (dangling.length > 0) {
  console.error('\nDangling variant_of references:');
  dangling.forEach(d => console.error(d));
  process.exit(1);
}

const manifest = { clips };
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nManifest written: ${Object.keys(clips).length} clips → assets/manifest.json`);
