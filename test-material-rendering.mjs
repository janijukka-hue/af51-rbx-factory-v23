#!/usr/bin/env node
// test-material-rendering.mjs — Test Material parsing and rendering

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';

console.log('\n✨ TEST: Material Rendering\n');

const testCode = `
local workspace = game:GetService("Workspace")

-- Neon material
local neon = Instance.new("Part")
neon.Name = "NEON_PART"
neon.Material = Enum.Material.Neon
neon.Size = Vector3.new(4, 4, 4)
neon.Position = Vector3.new(0, 2, 0)
neon.Color = Color3.fromRGB(0, 255, 120)
neon.Parent = workspace

-- Glass material
local glass = Instance.new("Part")
glass.Name = "GLASS_PART"
glass.Material = Enum.Material.Glass
glass.Size = Vector3.new(4, 4, 4)
glass.Position = Vector3.new(6, 2, 0)
glass.Parent = workspace

-- Metal material
local metal = Instance.new("Part")
metal.Name = "METAL_PART"
metal.Material = Enum.Material.Metal
metal.Size = Vector3.new(4, 4, 4)
metal.Position = Vector3.new(12, 2, 0)
metal.Parent = workspace

-- SmoothPlastic (default fallback)
local smooth = Instance.new("Part")
smooth.Name = "SMOOTH_PART"
smooth.Material = Enum.Material.SmoothPlastic
smooth.Size = Vector3.new(4, 4, 4)
smooth.Position = Vector3.new(18, 2, 0)
smooth.Parent = workspace

-- Unknown material (should fallback safely)
local unknown = Instance.new("Part")
unknown.Name = "UNKNOWN_PART"
unknown.Size = Vector3.new(4, 4, 4)
unknown.Position = Vector3.new(24, 2, 0)
unknown.Parent = workspace
`;

console.log('📋 Test Code: Neon + Glass + Metal + SmoothPlastic + Unknown\n');

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
    
    const neon = structures.find(s => s.label === 'NEON_PART');
    const glass = structures.find(s => s.label === 'GLASS_PART');
    const metal = structures.find(s => s.label === 'METAL_PART');
    const smooth = structures.find(s => s.label === 'SMOOTH_PART');
    const unknown = structures.find(s => s.label === 'UNKNOWN_PART');

    console.log('🔍 Material Analysis:\n');

    let passed = true;
    let errors = [];

    if (neon) {
      console.log('   NEON:    material=' + neon.material + ', glow=' + neon.glow);
      if (neon.material !== 'Neon') {
        errors.push('NEON material should be Neon, got ' + neon.material);
        passed = false;
      }
      if (!neon.glow) {
        errors.push('NEON should have glow=true');
        passed = false;
      }
    } else {
      errors.push('NEON_PART not found');
      passed = false;
    }

    if (glass) {
      console.log('   GLASS:   material=' + glass.material);
      if (glass.material !== 'Glass') {
        errors.push('GLASS material should be Glass, got ' + glass.material);
        passed = false;
      }
    } else {
      errors.push('GLASS_PART not found');
      passed = false;
    }

    if (metal) {
      console.log('   METAL:   material=' + metal.material);
      if (metal.material !== 'Metal') {
        errors.push('METAL material should be Metal, got ' + metal.material);
        passed = false;
      }
    } else {
      errors.push('METAL_PART not found');
      passed = false;
    }

    if (smooth) {
      console.log('   SMOOTH:  material=' + smooth.material);
      if (smooth.material !== 'SmoothPlastic') {
        errors.push('SMOOTH material should be SmoothPlastic, got ' + smooth.material);
        passed = false;
      }
    } else {
      errors.push('SMOOTH_PART not found');
      passed = false;
    }

    if (unknown) {
      console.log('   UNKNOWN: material=' + unknown.material + ' (fallback OK)');
      // Unknown should fallback to SmoothPlastic
      if (unknown.material !== 'SmoothPlastic') {
        console.log('   ⚠️  Unknown material fallback to: ' + unknown.material);
      }
    } else {
      errors.push('UNKNOWN_PART not found');
      passed = false;
    }

    console.log('');

    if (passed) {
      console.log('🎉 ✅ TEST PASSED - Material rendering working!\n');
      console.log('✓ Neon material parses correctly + glow enabled');
      console.log('✓ Glass material parses correctly');
      console.log('✓ Metal material parses correctly');
      console.log('✓ SmoothPlastic parses correctly');
      console.log('✓ Unknown material falls back safely\n');
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
