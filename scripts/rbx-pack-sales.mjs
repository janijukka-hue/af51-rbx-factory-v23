#!/usr/bin/env node
// scripts/rbx-pack-sales.mjs — build af51-rbx-onlyfactory.zip.
//
// Bundles ONLY the files needed to build all 5 production targets:
//   - 105 .js/.mjs/.json files (traced via scripts/rbx-trace-deps.mjs)
//   - A minimal package.json (archiver + yauzl, no Expo/RN)
//   - A minimal README explaining install + npm run rbx:build:all
//   - RBX_READINESS_REPORT.md (current state snapshot)
//
// Excludes: Expo UI, server.js, Ollama, m2/agents, s4/*, ui/MasterRoomUI.js,
// node_modules, exports-rbx, _runs, .cache, .git, images.
//
// Output: /workspace/af51-rbx-onlyfactory.zip (byte-stable: 1980-01-01 epoch).

import fs       from 'node:fs';
import path     from 'node:path';
import crypto   from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const OUT       = process.env.RBX_SALES_ZIP || '/workspace/af51-rbx-onlyfactory.zip';
const EPOCH     = new Date(315532800000); // 1980-01-01

// Run the dependency tracer and capture its file list.
const traced = spawnSync(process.execPath, [path.join(ROOT, 'scripts/rbx-trace-deps.mjs')], { cwd: ROOT });
if (traced.status !== 0) {
  console.error('rbx-trace-deps.mjs failed:', traced.stderr.toString());
  process.exit(1);
}
const files = traced.stdout.toString()
  .split('\n')
  .filter(l => l && !l.startsWith('#'))
  .map(l => l.trim());

// Sales-package exclusions:
//  - package.json / package-lock.json: shipped as minimal version below
//  - test-future-machine.mjs + ui/futureMachine/*: SSE test depends on server.js
//    which is not in the sales bundle; rbxlx-emit + rbx:verify give full
//    factory coverage (141 checks) without that runtime dependency.
const EXCLUDE_EXACT = new Set([
  'package.json',
  'package-lock.json',
  'test-future-machine.mjs',
  'ui/futureMachine/RingEvents.js',
  'ui/futureMachine/RingRuntime.js',
  'ui/futureMachine/RingState.js',
]);
const filtered = files.filter(f => !EXCLUDE_EXACT.has(f));

const MIN_PKG = {
  name: 'af51-rbx-factory',
  version: '1.0.0',
  description: 'AF51 RBX Factory — deterministic Roblox build pipeline (RBXLX emit, 16-stage)',
  license: 'UNLICENSED',
  author: 'Jani Segerman',
  type: 'module',
  private: true,
  main: 'rbx.mjs',
  scripts: {
    'test:all':            'node test-lua-factory.mjs && node test-rbxlx-emit.mjs',
    'test:lua-factory':    'node test-lua-factory.mjs',
    'test:rbxlx-emit':     'node test-rbxlx-emit.mjs',
    'rbx:build':           'node rbx.mjs build',
    'rbx:build:obby':      'node rbx.mjs build obby production',
    'rbx:build:tycoon':    'node rbx.mjs build tycoon production',
    'rbx:build:simulator': 'node rbx.mjs build simulator production',
    'rbx:build:rpg':       'node rbx.mjs build rpg production',
    'rbx:build:fps':       'node rbx.mjs build fps production',
    'rbx:build:all':       'node scripts/rbx-build-all.mjs',
    'rbx:verify':          'node scripts/rbx-verify.mjs',
    'rbx:list':            'node rbx.mjs list',
  },
  dependencies: {
    archiver: '^7.0.1',
    yauzl:    '^3.3.1',
  },
};

const README = '# AF51 RBX Factory — Sales Package\n\n' +
  'Deterministinen Roblox-buildiputki, 16 vaihetta, paikallisesti ajettava.\n' +
  'Yksi komento → `AF51.rbxlx` -tiedosto jonka voi tuplaklikata Roblox Studiossa.\n\n' +
  '## Asennus\n\n```bash\nnpm install\n```\n\n' +
  'Asentaa vain `archiver` ja `yauzl` — ei Expo/React Native -riippuvuuksia.\n\n' +
  '## Build\n\n```bash\nnpm run rbx:build:rpg              # tai obby / tycoon / simulator / fps\nnpm run rbx:build:all             # kaikki 5 kerralla\n```\n\n' +
  'Ulostulo: `exports-rbx/AF51-RBX-AF51-<TARGET>-<buildId>.zip`\n\n' +
  'Pura ZIP ja **tuplaklikkaa `AF51.rbxlx`** — Roblox Studio aukeaa scenen kanssa.\n\n' +
  '## Verifikaatio\n\n```bash\nnpm run rbx:verify                # 5 targetia × 11 checks (sis. byte-stability)\nnpm run test:all                  # 192 yksikkötestiä\n```\n\n' +
  '## Determinismi\n\nSama input → sama ZIP, sama SHA-256. Päällä oletuksena.\nOpt-out yhdelle ajolle: `RBX_DETERMINISTIC_BUILD=0 node rbx.mjs build rpg`\n\n' +
  '## Lisätieto\n\nKatso `RBX_READINESS_REPORT.md` ja `RBX_FLOW_SPEC.md`.\n';

const out = fs.createWriteStream(OUT);
const zip = archiver('zip', { zlib: { level: 9 } });
zip.pipe(out);

let included = 0;
for (const rel of filtered) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  zip.file(abs, { name: rel, date: EPOCH });
  included++;
}
zip.append(JSON.stringify(MIN_PKG, null, 2) + '\n', { name: 'package.json', date: EPOCH });
zip.append(README, { name: 'README.md', date: EPOCH });

// Bundled docs — buyer-facing reference
const EXTRA_DOCS = ['RBX_READINESS_REPORT.md', 'RBX_FLOW_SPEC.md'];
let extras = 0;
for (const doc of EXTRA_DOCS) {
  const abs = path.join(ROOT, doc);
  if (fs.existsSync(abs)) { zip.file(abs, { name: doc, date: EPOCH }); extras++; }
}

out.on('close', () => {
  const sz  = fs.statSync(OUT).size;
  const sha = crypto.createHash('sha256').update(fs.readFileSync(OUT)).digest('hex');
  console.log('  files:   ' + (included + 2 + extras));
  console.log('  size:    ' + sz + ' B (' + (sz / 1024).toFixed(1) + ' KB)');
  console.log('  sha256:  ' + sha);
  console.log('  output:  ' + OUT);
});
zip.finalize();
