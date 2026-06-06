#!/usr/bin/env node
// test-input-validator.mjs — INPUT VALIDATION GATE TEST
// INVARIANT: INVALID SOURCE MUST NEVER PRODUCE A ZIP.

import { validateBuildInput, createRejectionResponse } from './m2/roblox/rbx-input-validator.js';
import { detectLuaInput } from './m2/roblox/lua-input-detector.js';

console.log('\n🚨 INPUT VALIDATION GATE — GARBAGE BUG FIX TEST\n');
console.log('═══════════════════════════════════════════════════════════\n');

const tests = [
  {
    name: 'GARBAGE INPUT (keyboard mash)',
    input: 'yurejfijdkjfgjjrfijghijdhigjijgdidj',
    expectedValid: false,
    expectedIntent: 'invalid',
  },
  {
    name: 'EMPTY INPUT',
    input: '',
    expectedValid: false,
    expectedIntent: 'invalid',
  },
  {
    name: 'TOO SHORT',
    input: 'abc',
    expectedValid: false,
    expectedIntent: 'invalid',
  },
  {
    name: 'VALID LUA CODE (Humanoid)',
    input: `
      local npc = Instance.new("Model")
      local head = Instance.new("Part")
      head.Name = "Head"
      local humanoid = Instance.new("Humanoid")
      humanoid.Parent = npc
    `,
    expectedValid: true,
    expectedIntent: 'code',
  },
  {
    name: 'VALID PROMPT (English)',
    input: 'Create a Roblox RPG game with NPCs and a village',
    expectedValid: true,
    expectedIntent: 'prompt',
  },
  {
    name: 'VALID PROMPT (Finnish)',
    input: 'Tee Roblox-peli jossa on hahmoja ja checkpoint-systeemi',
    expectedValid: true,
    expectedIntent: 'prompt',
  },
  {
    name: 'VALID SPECIFIC PROMPT',
    input: 'Create one Roblox NPC named AF51_Guard using Humanoid and R15 rig.',
    expectedValid: true,
    expectedIntent: 'prompt',
  },
  {
    name: 'NO ROBLOX INTENT (generic text)',
    input: 'This is just some random text that has nothing to do with games',
    expectedValid: false,
    expectedIntent: 'invalid',
  },
  {
    name: 'REPEATED CHARACTERS (aaaaaaa)',
    input: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    expectedValid: false,
    expectedIntent: 'invalid',
  },
  {
    name: 'NO VOWELS (consonants only)',
    input: 'bcdfghjklmnpqrstvwxyz',
    expectedValid: false,
    expectedIntent: 'invalid',
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const detection = detectLuaInput(test.input);
  const validation = validateBuildInput(test.input, detection);
  
  const validMatch = validation.valid === test.expectedValid;
  const intentMatch = validation.intent === test.expectedIntent;
  const testPassed = validMatch && intentMatch;
  
  if (testPassed) {
    console.log(`✅ ${test.name}`);
    console.log(`   Valid: ${validation.valid} | Intent: ${validation.intent} | Confidence: ${validation.confidence.toFixed(2)}`);
    if (!validation.valid) {
      console.log(`   Reason: ${validation.reason}`);
    }
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   Expected: valid=${test.expectedValid}, intent=${test.expectedIntent}`);
    console.log(`   Got:      valid=${validation.valid}, intent=${validation.intent}`);
    console.log(`   Reason:   ${validation.reason}`);
    failed++;
  }
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`\n📊 RESULTS: ${passed}/${tests.length} passed | ${failed} failed\n`);

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED!\n');
  console.log('✅ INVARIANT SATISFIED:');
  console.log('   INVALID SOURCE WILL BE REJECTED');
  console.log('   NO ZIP WILL BE GENERATED FROM GARBAGE INPUT\n');
} else {
  console.log('⚠️  SOME TESTS FAILED!\n');
  process.exit(1);
}
