#!/usr/bin/env node
// scripts/rbx-trace-deps.mjs — static import graph walk starting from the
// RBX factory entry points. Lists every .js/.mjs file actually needed to
// build all 5 production targets, plus the data files (.json) those modules
// load synchronously. Output: sorted list of repo-relative paths to stdout.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

const ENTRY_POINTS = [
  'rbx.mjs',
  'scripts/rbx-build-all.mjs',
  'scripts/rbx-verify.mjs',
  'test-rbxlx-emit.mjs',
  'test-lua-factory.mjs',
  'test-future-machine.mjs',
];

const seen = new Set();
const dataFiles = new Set();

// import / require regexes (single + double quoted, relative + bare)
const IMPORT_RE  = /(?:^|\s)(?:import\s+(?:[^'";]*\s+from\s+)?|export\s+(?:[^'"]*\s+from\s+)?)['"]([^'"]+)['"]/gm;
const REQUIRE_RE = /(?:^|[^a-zA-Z0-9_])require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
const READ_RE    = /(?:readFileSync|readFile|createReadStream)\s*\(\s*[^,)]*['"]([^'"]+\.(?:json|lua|rbxlx|xml|txt|md))['"]/g;
const JOIN_RE    = /path\.join\([^)]*['"]([^'"]+\.(?:json|lua|rbxlx|xml|txt|md))['"]/g;

function resolveImport(from, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null; // bare package
  const base = path.resolve(path.dirname(from), spec);
  const candidates = [
    base,
    base + '.js', base + '.mjs', base + '.cjs', base + '.json',
    path.join(base, 'index.js'), path.join(base, 'index.mjs'),
  ];
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}

function walk(absPath) {
  if (seen.has(absPath)) return;
  seen.add(absPath);
  let src;
  try { src = fs.readFileSync(absPath, 'utf8'); } catch { return; }
  for (const re of [IMPORT_RE, REQUIRE_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const next = resolveImport(absPath, m[1]);
      if (next) walk(next);
    }
  }
  for (const re of [READ_RE, JOIN_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) dataFiles.add(m[1]);
  }
}

for (const ep of ENTRY_POINTS) {
  const abs = path.join(ROOT, ep);
  if (fs.existsSync(abs)) walk(abs);
  else console.error('# missing entry: ' + ep);
}

// Always-required runtime files (loaded by filename, not by import)
const ALWAYS = [
  'package.json',
  'package-lock.json',
  't3/Factory/rbx-production/zone-budgets.json', // path.join(__dirname, …)
  'runtime/rbx-runtime/manifest.template.json',  // runtime manifest template
  // Lua runtime modules — copied verbatim into ZIP src/ tree by LuauGenerator.injectRuntime
  'runtime/event-bus.lua',
  'runtime/state-store.lua',
  'runtime/service-registry.lua',
  'runtime/runtime-init.lua',
  'runtime/network-layer.lua',
  'runtime/audit-runtime.lua',
  'runtime/permission-layer.lua',
];

// Always-required directory trees (data, templates, targets)
const ALWAYS_DIRS = [
  'targets',
  'packageProfiles',
  't3/Factory/rbx-production/templates',
  't3/roblox-rbx',
  'production',
];

function walkDir(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  for (const e of fs.readdirSync(abs)) {
    const full = path.join(abs, e);
    const r = path.join(rel, e);
    const s = fs.statSync(full);
    if (s.isDirectory()) walkDir(r);
    else seen.add(full);
  }
}

for (const f of ALWAYS) {
  const abs = path.join(ROOT, f);
  if (fs.existsSync(abs)) seen.add(abs);
}
for (const d of ALWAYS_DIRS) walkDir(d);

const all = [...seen]
  .map(p => path.relative(ROOT, p))
  .filter(p => !p.startsWith('node_modules'))
  .sort();

console.log('# RBX factory dependency graph');
console.log('# entry points: ' + ENTRY_POINTS.join(', '));
console.log('# total files: ' + all.length);
console.log('');
for (const f of all) console.log(f);

console.log('');
console.log('# data file hints (relative refs found in code):');
for (const f of [...dataFiles].sort()) console.log('# ' + f);
