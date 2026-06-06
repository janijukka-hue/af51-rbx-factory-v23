#!/usr/bin/env node
// test-parser-comprehensive.mjs — Comprehensive parser test

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';

console.log('\n🔍 TEST: Comprehensive Parser Test\n');

const testCode = `
local workspace = game:GetService("Workspace")

-- Direct Instance.new with all properties
local part = Instance.new("Part")
part.Name = "TEST_PART"
part.Size = Vector3.new(10, 2, 10)
part.Position = Vector3.new(0, 1, 0)
part.Color = Color3.fromRGB(100, 150, 200)
part.Material = Enum.Material.SmoothPlastic
part.Shape = Enum.PartType.Block
part.Parent = workspace

-- SpawnLocation
local spawn = Instance.new("SpawnLocation")
spawn.Name = "SPAWN"
spawn.Size = Vector3.new(6, 1, 6)
spawn.Position = Vector3.new(10, 0, 0)
spawn.Parent = workspace

-- Helper function makePart
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

makePart("HELPER_PART", Vector3.new(5, 5, 5), Vector3.new(20, 2, 0), Color3.fromRGB(255, 0, 0), Enum.Material.Neon)

-- Parent variable resolution
local sign = Instance.new("Part")
sign.Name = "BIG_SIGN"
sign.Size = Vector3.new(12, 8, 1)
sign.Position = Vector3.new(0, 5, 10)
sign.Parent = workspace

local gui = Instance.new("SurfaceGui")
gui.Parent = sign

local label = Instance.new("TextLabel")
label.Text = "PARSER TEST"
label.Parent = gui
`;

console.log('📋 Testing: Direct + SpawnLocation + Helper + Parent resolution\n');

try {
  const builder = new LuaProjectBuilder();
  const result = await builder.build(testCode);

  if (!result.ok) {
    console.log('❌ Build failed:', result.error);
    process.exit(1);
  }

  console.log('✅ Build OK\n');

  const structures = result.preview.structures;
  const diag = result.diagnostics;

  console.log('📊 Results:\n');

  const tests = [
    {
      name: 'Direct Instance.new',
      check: () => structures.some(s => s.label === 'TEST_PART'),
      details: () => {
        const p = structures.find(s => s.label === 'TEST_PART');
        return p ? 'Size=' + JSON.stringify(p.w + 'x' + p.h + 'x' + p.d) : 'NOT FOUND';
      }
    },
    {
      name: 'SpawnLocation',
      check: () => structures.some(s => s.label === 'SPAWN' && s.luaClass === 'SpawnLocation'),
      details: () => structures.find(s => s.label === 'SPAWN') ? 'OK' : 'NOT FOUND'
    },
    {
      name: 'Helper makePart',
      check: () => structures.some(s => s.label === 'HELPER_PART'),
      details: () => {
        const p = structures.find(s => s.label === 'HELPER_PART');
        return p ? 'Material=' + p.material + ', Glow=' + p.glow : 'NOT FOUND';
      }
    },
    {
      name: 'Parent resolution',
      check: () => structures.some(s => s.luaClass === 'SurfaceGui' && s.parent === 'BIG_SIGN'),
      details: () => {
        const g = structures.find(s => s.luaClass === 'SurfaceGui');
        return g ? 'Parent=' + g.parent : 'NOT FOUND';
      }
    },
    {
      name: 'Properties parsed',
      check: () => {
        const p = structures.find(s => s.label === 'TEST_PART');
        return p && p.color && p.material && p.shape;
      },
      details: () => {
        const p = structures.find(s => s.label === 'TEST_PART');
        return p ? 'Color=' + p.color + ', Material=' + p.material + ', Shape=' + p.shape : 'N/A';
      }
    },
    {
      name: 'Diagnostics present',
      check: () => diag && diag.direct > 0 && diag.factory > 0,
      details: () => diag ? 'Direct=' + diag.direct + ', Factory=' + diag.factory + ', SurfaceGui=' + diag.surfaceGui + ', Parent=' + diag.parentResolved : 'N/A'
    }
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(t => {
    const ok = t.check();
    const status = ok ? '✓' : '✗';
    const detail = t.details();
    console.log('   ' + status + ' ' + t.name + ': ' + detail);
    if (ok) passed++; else failed++;
  });

  console.log('\n📊 Summary: ' + passed + '/' + tests.length + ' tests passed\n');

  if (failed === 0) {
    console.log('🎉 ✅ ALL PARSER TESTS PASSED!\n');
  } else {
    console.log('❌ ' + failed + ' test(s) failed\n');
    process.exit(1);
  }

} catch (e) {
  console.log('❌ EXCEPTION:', e.message);
  console.log(e.stack);
  process.exit(1);
}
