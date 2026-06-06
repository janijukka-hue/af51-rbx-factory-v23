#!/usr/bin/env node
// test-makepart-expansion.mjs — Test makePart factory function expansion

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';

console.log('\n🧪 TEST: makePart Factory Function Expansion\n');

const testCode = `
local workspace = game:GetService("Workspace")

local function makePart(name, size, position, color, material)
\tlocal part = Instance.new("Part")
\tpart.Name = name
\tpart.Size = size
\tpart.Position = position
\tpart.Anchored = true
\tpart.Color = color
\tpart.Material = material
\tpart.Parent = workspace
\treturn part
end

makePart("AF51_GREEN_BASEPLATE", Vector3.new(80, 2, 80), Vector3.new(0, 0, 0), Color3.fromRGB(20, 20, 20), Enum.Material.SmoothPlastic)
makePart("AF51_LEFT_GATE", Vector3.new(4, 24, 4), Vector3.new(-16, 13, 0), Color3.fromRGB(0, 255, 120), Enum.Material.Neon)
`;

console.log('📋 Test Code: 2x makePart(...) calls\n');

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
    console.log('🔍 Preview Structures:', structures.length);
    
    const parts = structures.filter(s => s.luaClass === 'Part' || s.className === 'Part');
    console.log('   Parts:', parts.length, '\n');

    if (parts.length > 0) {
      parts.forEach((part, i) => {
        const name = part.label || part.name || 'unnamed';
        console.log('   ' + (i + 1) + '. ' + name);
      });
      console.log('');
    }

    if (parts.length >= 2) {
      console.log('🎉 ✅ TEST PASSED - makePart expansion working!\n');
    } else {
      console.log('⚠️  Expected at least 2 parts, got ' + parts.length + '\n');
      process.exit(1);
    }
  } else {
    console.log('⚠️  No preview data\n');
    process.exit(1);
  }

} catch (e) {
  console.log('❌ EXCEPTION:', e.message);
  process.exit(1);
}
