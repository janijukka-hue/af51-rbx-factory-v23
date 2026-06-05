#!/usr/bin/env node
// scripts/rbx-build-all.mjs — sequentially build all 5 production targets.
// Determinism is on by default (see rbx.mjs); set RBX_DETERMINISTIC_BUILD=0
// to opt out for a debug run.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RobloxOrchestrator, INTENT } from '../m2/roblox/roblox-orchestrator.js';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const ROOT         = path.resolve(__dirname, '..');
const TARGETS_DIR  = path.join(ROOT, 'targets');
const PROFILES_DIR = path.join(ROOT, 'packageProfiles');
const EXPORTS_DIR  = path.join(ROOT, 'exports-rbx');

const TARGETS = ['obby', 'tycoon', 'simulator', 'rpg', 'fps'];

if (process.env.RBX_DETERMINISTIC_BUILD !== '0') {
  process.env.RBX_DETERMINISTIC_BUILD = '1';
}

function silentAudit() {
  const noop = () => {};
  return { log: noop, debug: noop, info: noop, warn: noop, error: noop, critical: noop };
}

const t0 = Date.now();
const results = [];
let ok = 0;

for (const targetId of TARGETS) {
  const ts = Date.now();
  process.stdout.write(`  ${targetId.padEnd(10)} `);
  const r = await RobloxOrchestrator.process(
    { type: INTENT.BUILD, targetId, profileId: 'production' },
    { targetsDir: TARGETS_DIR, profilesDir: PROFILES_DIR, exportsDir: EXPORTS_DIR, auditLedger: silentAudit() }
  );
  const ms = Date.now() - ts;
  if (r.ok) {
    ok++;
    process.stdout.write(`✓ ${ms.toString().padStart(5)}ms  ${r.buildId}\n`);
    results.push({ targetId, ok: true, ms, buildId: r.buildId, zipPath: r.zipPath });
  } else {
    process.stdout.write(`✗ FAILED  ${(r.errors || [r.error]).join('; ')}\n`);
    results.push({ targetId, ok: false, ms, errors: r.errors || [r.error] });
  }
}

const totalMs = Date.now() - t0;
console.log('');
console.log(`  ── ${ok}/${TARGETS.length} targets OK in ${totalMs}ms ──`);
process.exit(ok === TARGETS.length ? 0 : 1);
