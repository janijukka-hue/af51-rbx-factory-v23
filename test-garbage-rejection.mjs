#!/usr/bin/env node
// test-garbage-rejection.mjs — FULL BUILD REJECTION TEST
// INVARIANT: INVALID SOURCE MUST NEVER PRODUCE A ZIP.

import { RobloxOrchestrator, INTENT } from './m2/roblox/roblox-orchestrator.js';

console.log('\n🚨 GARBAGE INPUT REJECTION — FULL BUILD TEST\n');
console.log('═══════════════════════════════════════════════════════════\n');

const auditLedger = {
  log: (e, l) => console.log(`  [${l || 'INFO'}] ${e}`),
  debug: m => {}, // silent
  info: m => console.log(`  [INFO] ${m}`),
  warn: m => console.warn(`  [WARN] ${m}`),
  error: m => console.error(`  [ERROR] ${m}`),
  critical: m => console.error(`  [CRIT] ${m}`),
};

const tests = [
  {
    name: 'GARBAGE INPUT (keyboard mash)',
    userSource: 'yurejfijdkjfgjjrfijghijdhigjijgdidj',
    shouldReject: true,
  },
  {
    name: 'EMPTY STRING',
    userSource: '',
    shouldReject: true,
  },
  {
    name: 'VALID LUA CODE',
    userSource: `
      local npc = Instance.new("Model")
      npc.Name = "Guard"
      local head = Instance.new("Part")
      head.Name = "Head"
      head.Parent = npc
      local humanoid = Instance.new("Humanoid")
      humanoid.Parent = npc
      npc.Parent = workspace
    `,
    shouldReject: false,
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  console.log('📋 TEST: ' + test.name);
  const inputPreview = test.userSource.slice(0, 50) + (test.userSource.length > 50 ? '...' : '');
  console.log('   Input: "' + inputPreview + '"');
  console.log('   Expected: ' + (test.shouldReject ? 'REJECT' : 'BUILD') + '\n');

  try {
    const result = await RobloxOrchestrator.process(
      {
        type: INTENT.BUILD,
        targetId: 'rpg',
        profileId: 'development',
        userSource: test.userSource,
      },
      {
        targetsDir: process.cwd() + '/targets',
        profilesDir: process.cwd() + '/packageProfiles',
        exportsDir: process.cwd() + '/exports-rbx',
        auditLedger,
      }
    );

    const wasRejected = !result.ok && result.error === 'BUILD_REJECTED_INVALID_SOURCE';
    const wasBuilt = result.ok && result.zipPath;

    if (test.shouldReject) {
      // Should have been rejected
      if (wasRejected) {
        console.log(`  ✅ CORRECTLY REJECTED`);
        console.log(`     Error: ${result.error}`);
        console.log(`     Reason: ${result.reason || 'N/A'}`);
        console.log(`     ZIP: ${result.zipPath || 'none'}`);
        console.log(`     Phases: ${result.phases?.length || 0}`);
        passed++;
      } else if (wasBuilt) {
        console.log(`  ❌ FAILED: ZIP WAS GENERATED!`);
        console.log(`     ZIP: ${result.zipPath}`);
        console.log(`     Phases: ${result.phases?.length || 0}/16`);
        console.log(`     🚨 INVARIANT VIOLATED: INVALID SOURCE PRODUCED A ZIP!`);
        failed++;
      } else {
        console.log(`  ⚠️  REJECTED but not with expected error`);
        console.log(`     Error: ${result.error}`);
        failed++;
      }
    } else {
      // Should have been built
      if (wasBuilt) {
        console.log(`  ✅ CORRECTLY BUILT`);
        console.log(`     ZIP: ${result.zipPath}`);
        console.log(`     Phases: ${result.phases?.length || 0}/16`);
        passed++;
      } else {
        console.log(`  ❌ FAILED: Build was rejected but should have succeeded`);
        console.log(`     Error: ${result.error}`);
        failed++;
      }
    }
  } catch (e) {
    console.log(`  ❌ EXCEPTION: ${e.message}`);
    failed++;
  }

  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`\n📊 RESULTS: ${passed}/${tests.length} passed | ${failed} failed\n`);

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED!\n');
  console.log('✅ INVARIANT SATISFIED:');
  console.log('   GARBAGE INPUT → BUILD_REJECTED_INVALID_SOURCE');
  console.log('   NO ZIP GENERATED FROM INVALID INPUT');
  console.log('   VALID CODE → ZIP GENERATED\n');
} else {
  console.log('⚠️  SOME TESTS FAILED!\n');
  console.log('🚨 CRITICAL: INVALID INPUT MAY STILL PRODUCE ZIPS\n');
  process.exit(1);
}
