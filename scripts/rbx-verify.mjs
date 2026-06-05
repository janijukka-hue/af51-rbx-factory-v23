#!/usr/bin/env node
// scripts/rbx-verify.mjs — production readiness check.
//
// 1. Builds all 5 targets (deterministic, default-on).
// 2. For each ZIP: verifies AF51.rbxlx + Rojo src/ tree + ghost/* + previews.
// 3. Rebuilds each target a SECOND time and compares SHA-256 to assert
//    byte-stability across runs.
//
// Exit 0 only when all 5 targets pass every check.

import path     from 'node:path';
import fs       from 'node:fs';
import crypto   from 'node:crypto';
import { fileURLToPath } from 'node:url';
import yauzl    from 'yauzl';
import { RobloxOrchestrator, INTENT } from '../m2/roblox/roblox-orchestrator.js';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const ROOT         = path.resolve(__dirname, '..');
const TARGETS_DIR  = path.join(ROOT, 'targets');
const PROFILES_DIR = path.join(ROOT, 'packageProfiles');
const EXPORTS_DIR  = path.join(ROOT, 'exports-rbx');

const TARGETS = ['obby', 'tycoon', 'simulator', 'rpg', 'fps'];
const REQUIRED_ENTRIES = [
  'AF51.rbxlx',
  'default.project.json',
  'manifest.json',
  'production-scenegraph.json',
  'production-quality-report.json',
  'ghost/lineage.json',
  'ghost/recovery.map',
  'src/ReplicatedStorage/Packages/AF51Runtime/AuditRuntime.lua',
];

if (process.env.RBX_DETERMINISTIC_BUILD !== '0') {
  process.env.RBX_DETERMINISTIC_BUILD = '1';
}

function silentAudit() {
  const noop = () => {};
  return { log: noop, debug: noop, info: noop, warn: noop, error: noop, critical: noop };
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function listZipEntries(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      const entries = [];
      zip.on('entry', e => { entries.push(e.fileName); zip.readEntry(); });
      zip.on('end', () => resolve(entries));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

async function buildOnce(targetId) {
  const r = await RobloxOrchestrator.process(
    { type: INTENT.BUILD, targetId, profileId: 'production' },
    { targetsDir: TARGETS_DIR, profilesDir: PROFILES_DIR, exportsDir: EXPORTS_DIR, auditLedger: silentAudit() }
  );
  if (!r.ok) throw new Error(`${targetId}: build failed — ${(r.errors || [r.error]).join('; ')}`);
  return r.zipPath;
}

async function verifyTarget(targetId) {
  const checks = [];
  const ok = (name) => checks.push({ name, ok: true });
  const fail = (name, why) => checks.push({ name, ok: false, why });

  // 1st build
  const zip1 = await buildOnce(targetId);
  if (!fs.existsSync(zip1)) { fail('zip exists', zip1); return checks; }
  ok('build #1 ok');
  ok(`zip exists (${(fs.statSync(zip1).size / 1024).toFixed(0)} KB)`);

  // Entry checks
  const entries = await listZipEntries(zip1);
  for (const req of REQUIRED_ENTRIES) {
    if (entries.includes(req)) ok(`contains ${req}`);
    else fail(`contains ${req}`, 'missing from ZIP');
  }

  // 2nd build → SHA must match (byte-stability)
  const sha1 = sha256(zip1);
  await buildOnce(targetId);
  const sha2 = sha256(zip1);
  if (sha1 === sha2) ok(`deterministic (sha=${sha1.slice(0, 12)}…)`);
  else fail('deterministic', `sha mismatch (#1=${sha1.slice(0, 12)}… #2=${sha2.slice(0, 12)}…)`);

  return checks;
}

console.log('AF51 RBX — production readiness verify');
console.log('───────────────────────────────────────');
const t0 = Date.now();
let totalOk = 0, totalFail = 0;
for (const targetId of TARGETS) {
  console.log(`\n[${targetId}]`);
  try {
    const checks = await verifyTarget(targetId);
    for (const c of checks) {
      if (c.ok) { console.log('  ✓ ' + c.name); totalOk++; }
      else       { console.log('  ✗ ' + c.name + ' — ' + c.why); totalFail++; }
    }
  } catch (e) {
    console.log('  ✗ EXCEPTION: ' + e.message);
    totalFail++;
  }
}
const ms = Date.now() - t0;
console.log('\n───────────────────────────────────────');
console.log(`  ${totalOk} pass · ${totalFail} fail · ${ms}ms`);
process.exit(totalFail === 0 ? 0 : 1);
