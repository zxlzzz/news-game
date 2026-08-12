#!/usr/bin/env node
/**
 * check-syntax — 全仓库 JS 语法门
 *
 * 为什么需要它：本项目无打包器、无测试框架，语法错误只有在浏览器加载到那个
 * 模块时才会暴露；而五个静态门都不解析全部源码，所以一个括号没闭合可以一路
 * 绿灯躺到实机白屏。2026-08-12 就发生过：脚本批量改 `registerProp(...)` 时把
 * 行尾吞进了注释，13 个文件被改坏，五个门全绿，最后靠浏览器报
 * `Unexpected end of input` 才发现。**凡是脚本批量改过 js/，跑一下这个。**
 *
 * ⚠️ 为什么不直接 `node --check <file>.js`：node 按"最近的 package.json 的
 * type 字段"决定用 CJS 还是 ESM 语法检查 `.js`。本仓库的 `package.json` 被
 * `.gitignore` 忽略（新克隆下来根本没有这个文件），届时 node 回落到 **CommonJS**
 * 语法——上面那个坏文件会被判为**通过**（实测：无 package.json 时退出码 0，
 * 有 `"type":"module"` 时退出码 1）。一道正确性依赖未追踪文件的门等于没有门。
 * 所以这里把源码内容写进临时 `.mjs` 再检查：`.mjs` 扩展名强制 ESM 语法，
 * 与 package.json 在不在、写了什么完全无关。
 */
import { readdirSync, statSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const SKIP = new Set(['node_modules', '.git']);
const ROOTS = ['js', 'scripts', 'sth', 'assets'];

function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p, out);
    else if (name.endsWith('.js') || name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap(r => {
  try { return collect(r); } catch { return []; }   // 目录不存在就跳过
});

const work = mkdtempSync(join(tmpdir(), 'syntax-'));
const CONCURRENCY = 16;
const failures = [];
let idx = 0;

async function worker(slot) {
  // 每个 worker 复用一个临时文件，避免 167 次创建/删除
  const scratch = join(work, `w${slot}.mjs`);
  while (idx < files.length) {
    const f = files[idx++];
    writeFileSync(scratch, readFileSync(f));
    try {
      await execFileP(process.execPath, ['--check', scratch]);
    } catch (e) {
      // node --check 的 stderr 形如：
      //   /tmp/.../w3.mjs:46
      //   <出错那行源码>
      //        ^
      //   SyntaxError: Unexpected end of input
      // 取行号和 "XxxError: ..."；文件名要换回真实路径（报的是临时文件）
      // 注意 trim：Windows 上 stderr 是 CRLF，不去掉 \r 的话 /$/ 锚不住行号
      const lines = String(e.stderr || e.message).split('\n').map(l => l.trimEnd());
      const lineNo = (lines[0] || '').match(/:(\d+)$/)?.[1] ?? '?';
      const what = lines.find(l => /^\s*\w*Error:/.test(l))?.trim() ?? '语法错误';
      failures.push({ file: f, detail: `${f}:${lineNo}\n    ${what}` });
    }
  }
}

try {
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
} finally {
  rmSync(work, { recursive: true, force: true });
}

const GREEN = '\x1b[0;32m', RED = '\x1b[0;31m', OFF = '\x1b[0m';
if (failures.length) {
  failures.sort((a, b) => a.file.localeCompare(b.file));
  for (const { detail } of failures) console.log(`${RED}✗${OFF} ${detail}`);
  console.log(`\n${RED}${failures.length} 个文件语法错误（共检查 ${files.length} 个）${OFF}`);
  process.exit(1);
}
console.log(`${GREEN}All ${files.length} JS files parse.${OFF}`);
