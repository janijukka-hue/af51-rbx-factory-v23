#!/usr/bin/env node
// test-factory-extensions.mjs — Test makeNPC and makeTool expansion

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';

console.log('\n🧪 TEST: Factory Extensions (makeNPC, makeTool)\n');

const testCode = `
local workspace = game:GetService("Workspace")

-- makePart helper (existing)
local function makePart(name, size, position, color, material)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Position = position
	p.Color = color
	p.Material = material
	p.Anchored = true
	p.Parent = workspace
	return p
end

-- makeNPC helper (NEW)
local function makeNPC(name, position, appearance)
	local model = Instance.new("Model")
	model.Name = name
	local humanoid = Instance.new("Humanoid")
	humanoid.Parent = model
	local head = Instance.new("Part")
	head.Name = "Head"
	head.Size = Vector3.new(2, 1, 1)
	head.Position = position
	head.Color = Color3.fromRGB(255, 204, 153)
	head.Parent = model
	model.Parent = workspace
	return model
end

-- makeTool helper (NEW)
local function makeTool(name, toolType)
	local tool = Instance.new("Tool")
	tool.Name = name
	local handle = Instance.new("Part")
	handle.Name = "Handle"
	handle.Size = Vector3.new(1, 4, 1)
	handle.Color = Color3.fromRGB(163, 162, 165)
	handle.Parent = tool
	tool.Parent = workspace
	return tool
end

-- Create objects using factory functions
makePart("Floor", Vector3.new(50, 1, 50), Vector3.new(0, 0, 0), Color3.fromRGB(100, 100, 100), Enum.Material.SmoothPlastic)

makeNPC("Guard", Vector3.new(10, 3, 0), "Soldier")
makeNPC("Merchant", Vector3.new(-10, 3, 0), "Villager")

makeTool("Sword", "Melee")
makeTool("Pickaxe", "Mining")

-- Direct Instance.new() calls (should also be counted)
local sign = Instance.new("Part")
sign.Name = "DirectSign"
sign.Size = Vector3.new(8, 4, 1)
sign.Position = Vector3.new(0, 5, 0)
sign.Color = Color3.fromRGB(255, 255, 0)
sign.Anchored = true
sign.Parent = workspace
`;

async function test() {
  try {
    const builder = new LuaProjectBuilder();
    const result = await builder.build(testCode);

    if (!result.ok) {
      console.log('❌ Build failed:', result.error);
      process.exit(1);
    }

    console.log('✅ Build successful\n');

    // Debug: show what we got
    console.log('DEBUG: result keys:', Object.keys(result).join(', '));
    console.log('DEBUG: preview type:', typeof result.preview);
    if (result.preview) {
      console.log('DEBUG: preview keys:', Object.keys(result.preview).join(', '));
    }

    console.log('📊 Diagnostics:\n');

    const d = result.diagnostics;
    console.log('   Direct instances:   ' + (d.direct || 0) + ' (Instance.new)');
    console.log('   Factory expansion:  ' + (d.factory || 0) + ' (makePart/makeNPC/makeTool)');
    console.log('   UI Overlays:        ' + (d.surfaceGui || 0) + ' (SurfaceGui/BillboardGui)');
    console.log('   Parent resolution:  ' + (d.parentResolved || 0) + ' (var → name)');
    console.log('');

    // Analyze preview structures (contains source metadata)
    const structures = result.preview && result.preview.structures ? result.preview.structures : [];

    console.log('DEBUG: structures count:', structures.length);
    if (structures.length > 0) {
      console.log('DEBUG: first structure keys:', Object.keys(structures[0]).join(', '));
      console.log('DEBUG: first structure source:', structures[0].source);
    }
    
    console.log('📦 Instance Breakdown:\n');

    const makePartCount = structures.filter(n => n.source === 'expanded_makePart').length;
    const makeNPCCount = structures.filter(n => n.source === 'expanded_makeNPC').length;
    const makeToolCount = structures.filter(n => n.source === 'expanded_makeTool').length;
    const directCount = structures.filter(n => !n.source || n.source === 'direct').length;
    
    console.log('   makePart():   ' + makePartCount);
    console.log('   makeNPC():    ' + makeNPCCount);
    console.log('   makeTool():   ' + makeToolCount);
    console.log('   Direct:       ' + directCount);
    console.log('   Total:        ' + structures.length);
    console.log('');

    // Assertions
    const tests = [
      { name: 'Factory expansion detected', pass: d.factory > 0 },
      { name: 'makeNPC instances created', pass: makeNPCCount > 0 },
      { name: 'makeTool instances created', pass: makeToolCount > 0 },
      { name: 'makePart instances created', pass: makePartCount > 0 },
      { name: 'Direct instances counted', pass: d.direct > 0 },
      { name: 'Total factory count correct', pass: d.factory === (makePartCount + makeNPCCount + makeToolCount) },
    ];

    console.log('🧪 Test Results:\n');
    
    let passed = 0;
    tests.forEach(t => {
      const status = t.pass ? '✅ PASS' : '❌ FAIL';
      console.log('   ' + status + ' — ' + t.name);
      if (t.pass) passed++;
    });

    console.log('');
    console.log('Summary: ' + passed + '/' + tests.length + ' tests passed\n');

    if (passed < tests.length) {
      console.log('❌ Some tests failed');
      process.exit(1);
    }

    console.log('✅ All tests passed!\n');
  } catch (e) {
    console.log('❌ Test failed:', e.message);
    console.log(e.stack);
    process.exit(1);
  }
}

test();
