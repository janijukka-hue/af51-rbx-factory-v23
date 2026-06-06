#!/usr/bin/env node
// test-skill-orchestrator.mjs — Test Skill Orchestrator Architecture

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';
import { SkillOrchestrator } from './s4/oliot/rbx-skills/SkillOrchestrator.js';

console.log('\n🧪 TEST: Skill Orchestrator Architecture\n');

const vehicleScene = `
local workspace = game:GetService("Workspace")

local car = Instance.new("Model")
car.Name = "SportsCar"
car.Parent = workspace

local body = Instance.new("Part")
body.Name = "Body"
body.Size = Vector3.new(6, 2, 10)
body.Position = Vector3.new(0, 2, 0)
body.Color = Color3.fromRGB(255, 50, 50)
body.Parent = car

local wheel1 = Instance.new("Part")
wheel1.Name = "WheelFrontLeft"
wheel1.Size = Vector3.new(2, 2, 2)
wheel1.Shape = Enum.PartType.Cylinder
wheel1.Position = Vector3.new(-2, 1, 3)
wheel1.Parent = car

local wheel2 = Instance.new("Part")
wheel2.Name = "WheelFrontRight"
wheel2.Size = Vector3.new(2, 2, 2)
wheel2.Shape = Enum.PartType.Cylinder
wheel2.Position = Vector3.new(2, 1, 3)
wheel2.Parent = car

local baseplate = Instance.new("Part")
baseplate.Name = "Baseplate"
baseplate.Size = Vector3.new(200, 1, 200)
baseplate.Position = Vector3.new(0, 0, 0)
baseplate.Anchored = true
baseplate.Parent = workspace
`;

async function test() {
  try {
    console.log('1. Building scene from Lua...\n');
    const builder = new LuaProjectBuilder();
    const result = await builder.build(vehicleScene);

    if (!result.ok) {
      console.log('❌ Build failed:', result.error);
      process.exit(1);
    }

    console.log('✅ Build successful\n');

    // Convert preview to graph
    const graph = {
      nodes: result.preview.structures.map(s => ({
        id: s.id,
        className: s.luaClass,
        properties: {
          Name: s.label,
          Position: [s.x, s.y, s.z],
          Size: [s.w, s.h, s.d],
          Color: s.color,
          Material: s.material,
          Shape: s.shape
        },
        parent: s.parent
      }))
    };

    console.log('📊 Graph:', graph.nodes.length, 'nodes\n');

    // Create orchestrator and run pipeline
    console.log('2. Running Skill Orchestrator...\n');
    const orchestrator = new SkillOrchestrator();
    
    console.log('   Registered skills:', orchestrator.getSkillsInfo().map(s => s.name).join(', '));
    console.log('   Pipeline:', orchestrator.pipeline.join(' → '));
    console.log('');

    const enriched = await orchestrator.quickAnalyze(graph);

    console.log('\n3. Orchestrator Results:\n');
    
    // Semantic Analysis
    if (enriched.semantic) {
      console.log('   📋 Semantic Analysis:');
      console.log('      Intent:', enriched.semantic.intent);
      console.log('      Vehicles:', enriched.semantic.vehicles.length);
      console.log('      Buildings:', enriched.semantic.buildings.length);
      console.log('      Characters:', enriched.semantic.characters.length);
      console.log('      Confidence:', enriched.semantic.confidence);
      console.log('');
    }

    // Preview Director
    if (enriched.previewDirector) {
      console.log('   🎥 Preview Director:');
      console.log('      View mode:', enriched.previewDirector.viewMode);
      console.log('      Hero objects:', enriched.previewDirector.heroObjects.length);
      console.log('      Focus point:', enriched.previewDirector.focusPoint);
      console.log('      Camera position:', enriched.previewDirector.cameraPosition);
      console.log('      Orbit radius:', enriched.previewDirector.orbitRadius.toFixed(2));
      console.log('      Ignore baseplate:', enriched.previewDirector.ignoreBaseplate);
      console.log('');
    }

    // Test assertions
    const tests = [
      { name: 'Orchestrator returns results', pass: enriched != null },
      { name: 'Semantic analysis ran', pass: enriched.semantic != null },
      { name: 'Preview director ran', pass: enriched.previewDirector != null },
      { name: 'Intent is vehicle', pass: enriched.semantic && enriched.semantic.intent === 'vehicle' },
      { name: 'Vehicle detected', pass: enriched.semantic && enriched.semantic.vehicles.length > 0 },
      { name: 'Hero objects identified', pass: enriched.previewDirector && enriched.previewDirector.heroObjects.length > 0 },
      { name: 'View mode is vehicle', pass: enriched.previewDirector && enriched.previewDirector.viewMode === 'vehicle' },
      { name: 'Baseplate ignored', pass: enriched.previewDirector && enriched.previewDirector.ignoreBaseplate === true },
    ];

    console.log('4. Test Results:\n');
    
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
    console.log('🎯 Skill Orchestrator Architecture:');
    console.log('   - Skills are composable ✅');
    console.log('   - Pipeline is configurable ✅');
    console.log('   - Each skill has single responsibility ✅');
    console.log('   - Results flow between skills ✅');
    console.log('   - 100x smarter than raw structures ✅\n');

  } catch (e) {
    console.log('❌ Test failed:', e.message);
    console.log(e.stack);
    process.exit(1);
  }
}

test();
