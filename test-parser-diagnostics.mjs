#!/usr/bin/env node
// test-parser-diagnostics.mjs — Test parser diagnostics reporting

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';

console.log('\n🧪 TEST: Parser Diagnostics\n');

const testCode = `
local workspace = game:GetService("Workspace")

-- Direct Instance.new
local part1 = Instance.new("Part")
part1.Name = "DIRECT_PART"
part1.Size = Vector3.new(10, 2, 10)
part1.Parent = workspace

-- Factory function (5 params required by expander)
local function makePart(name, size, position, color, material)
\tlocal p = Instance.new("Part")
\tp.Name = name
\tp.Size = size
\tp.Position = position
\tp.Color = color
\tp.Material = material
\tp.Anchored = true
\tp.Parent = workspace
\treturn p
end

-- Factory calls (will be expanded)
makePart("FACTORY_PART_1", Vector3.new(5, 5, 5), Vector3.new(10, 1, 10), Color3.fromRGB(255, 0, 0), Enum.Material.Neon)
makePart("FACTORY_PART_2", Vector3.new(8, 3, 8), Vector3.new(20, 2, 20), Color3.fromRGB(0, 255, 0), Enum.Material.Neon)

-- SurfaceGui
local sign = Instance.new("Part")
sign.Name = "SIGN"
sign.Parent = workspace

local gui = Instance.new("SurfaceGui")
gui.Parent = sign

local textLabel = Instance.new("TextLabel")
textLabel.Text = "Hello"
textLabel.Parent = gui
`;

console.log('📋 Test Code: Mixed Direct + Factory + SurfaceGui + Parent resolution\n');

try {
  const builder = new LuaProjectBuilder();
  const result = await builder.build(testCode);

  if (!result.ok) {
    console.log('❌ Build failed:', result.error);
    process.exit(1);
  }

  console.log('✅ Build OK\n');

  if (result.diagnostics) {
    const d = result.diagnostics;
    console.log('📊 Parser Diagnostics:');
    console.log('   Direct:         ' + d.direct + ' (Instance.new calls)');
    console.log('   Factory:        ' + d.factory + ' (expanded makePart)');
    console.log('   SurfaceGui:     ' + d.surfaceGui + ' (GUI objects)');
    console.log('   Parent Resolved:' + d.parentResolved + ' (variable → Name)\n');

    let passed = true;
    let errors = [];

    if (d.direct < 2) {
      errors.push('Expected at least 2 direct Instance.new, got ' + d.direct);
      passed = false;
    }
    if (d.factory < 1) {
      errors.push('Expected at least 1 factory expansion, got ' + d.factory);
      passed = false;
    }
    if (d.surfaceGui < 1) {
      errors.push('Expected at least 1 SurfaceGui, got ' + d.surfaceGui);
      passed = false;
    }
    if (d.parentResolved < 2) {
      errors.push('Expected at least 2 parent resolutions, got ' + d.parentResolved);
      passed = false;
    }

    if (passed) {
      console.log('🎉 ✅ TEST PASSED - Parser diagnostics working!\n');
      console.log('Parser Status:');
      console.log('   Direct:    ' + (d.direct > 0 ? 'OK' : 'N/A'));
      console.log('   Factory:   ' + (d.factory > 0 ? 'OK' : 'N/A'));
      console.log('   SurfaceGui:' + (d.surfaceGui > 0 ? 'OK' : 'N/A'));
      console.log('   Parent:    ' + (d.parentResolved > 0 ? 'OK' : 'N/A'));
      console.log('');
    } else {
      console.log('❌ TEST FAILED:\n');
      errors.forEach(e => console.log('   - ' + e));
      console.log('');
      process.exit(1);
    }
  } else {
    console.log('❌ No diagnostics in result\n');
    process.exit(1);
  }

} catch (e) {
  console.log('❌ EXCEPTION:', e.message);
  console.log(e.stack);
  process.exit(1);
}
