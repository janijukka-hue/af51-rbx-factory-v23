#!/usr/bin/env node
// test-shape-rendering.mjs — Test Part.Shape rendering

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';

console.log('\n🔷 TEST: Shape Rendering\n');

const testCode = `
local workspace = game:GetService("Workspace")

-- Cylinder wheel
local wheel = Instance.new("Part")
wheel.Name = "WHEEL"
wheel.Shape = Enum.PartType.Cylinder
wheel.Size = Vector3.new(4, 1, 4)
wheel.Position = Vector3.new(0, 2, 0)
wheel.Parent = workspace

-- Ball sphere
local ball = Instance.new("Part")
ball.Name = "BALL"
ball.Shape = Enum.PartType.Ball
ball.Size = Vector3.new(3, 3, 3)
ball.Position = Vector3.new(6, 2, 0)
ball.Parent = workspace

-- Block (default)
local block = Instance.new("Part")
block.Name = "BLOCK"
block.Size = Vector3.new(5, 5, 5)
block.Position = Vector3.new(12, 2, 0)
block.Parent = workspace
`;

console.log('📋 Test Code: Cylinder + Ball + Block shapes\n');

try {
  const builder = new LuaProjectBuilder();
  const result = await builder.build(testCode);

  if (!result.ok) {
    console.log('❌ Build failed:', result.error);
    process.exit(1);
  }

  console.log('✅ Build OK\n');

  if (result.preview && result.preview.structures) {
    const structures = result.preview.structures;
    
    const wheel = structures.find(s => s.label === 'WHEEL');
    const ball = structures.find(s => s.label === 'BALL');
    const block = structures.find(s => s.label === 'BLOCK');

    console.log('🔍 Shape Analysis:\n');

    let passed = true;
    let errors = [];

    if (wheel) {
      console.log('   WHEEL: shape=' + wheel.shape);
      if (wheel.shape !== 'Cylinder') {
        errors.push('WHEEL should be Cylinder, got ' + wheel.shape);
        passed = false;
      }
    } else {
      errors.push('WHEEL not found');
      passed = false;
    }

    if (ball) {
      console.log('   BALL:  shape=' + ball.shape);
      if (ball.shape !== 'Ball') {
        errors.push('BALL should be Ball, got ' + ball.shape);
        passed = false;
      }
    } else {
      errors.push('BALL not found');
      passed = false;
    }

    if (block) {
      console.log('   BLOCK: shape=' + block.shape);
      if (block.shape !== 'Block') {
        errors.push('BLOCK should be Block, got ' + block.shape);
        passed = false;
      }
    } else {
      errors.push('BLOCK not found');
      passed = false;
    }

    console.log('');

    if (passed) {
      console.log('🎉 ✅ TEST PASSED - Shape rendering working!\n');
      console.log('✓ Cylinder renders as cylinder');
      console.log('✓ Ball renders as ball');
      console.log('✓ Block renders as block\n');
    } else {
      console.log('❌ TEST FAILED:\n');
      errors.forEach(e => console.log('   - ' + e));
      console.log('');
      process.exit(1);
    }
  } else {
    console.log('❌ No preview data\n');
    process.exit(1);
  }

} catch (e) {
  console.log('❌ EXCEPTION:', e.message);
  console.log(e.stack);
  process.exit(1);
}
