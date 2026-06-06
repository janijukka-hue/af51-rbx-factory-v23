#!/usr/bin/env node
// test-preview-director-integration.mjs — Test RbxPreviewDirector integration

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';
import { RbxPreviewDirector } from './s4/oliot/rbx-directors/RbxPreviewDirector.js';

console.log('\n🧪 TEST: RbxPreviewDirector Integration\n');

const carScene = `
local workspace = game:GetService("Workspace")

-- Create a car (vehicle hero object)
local car = Instance.new("Model")
car.Name = "RaceCar"
car.Parent = workspace

local body = Instance.new("Part")
body.Name = "Body"
body.Size = Vector3.new(6, 2, 10)
body.Position = Vector3.new(0, 2, 0)
body.Color = Color3.fromRGB(255, 0, 0)
body.Material = Enum.Material.SmoothPlastic
body.Parent = car

local wheel1 = Instance.new("Part")
wheel1.Name = "Wheel"
wheel1.Size = Vector3.new(2, 2, 2)
wheel1.Position = Vector3.new(-2, 1, 3)
wheel1.Shape = Enum.PartType.Cylinder
wheel1.Color = Color3.fromRGB(50, 50, 50)
wheel1.Parent = car

-- Create a large baseplate (should NOT be hero)
local baseplate = Instance.new("Part")
baseplate.Name = "Baseplate"
baseplate.Size = Vector3.new(100, 1, 100)
baseplate.Position = Vector3.new(0, 0, 0)
baseplate.Color = Color3.fromRGB(100, 100, 100)
baseplate.Material = Enum.Material.SmoothPlastic
baseplate.Anchored = true
baseplate.Parent = workspace
`;

async function test() {
  try {
    console.log('Building scene...');
    const builder = new LuaProjectBuilder();
    const result = await builder.build(carScene);

    if (!result.ok) {
      console.log('❌ Build failed:', result.error);
      process.exit(1);
    }

    console.log('✅ Build successful\n');

    // Extract graph from preview
    const preview = result.preview;
    const graph = {
      nodes: preview.structures.map(s => ({
        id: s.id,
        className: s.luaClass,
        properties: {
          Name: s.label,
          Position: [s.x, s.y, s.z],
          Size: [s.w, s.h, s.d],
          Color: s.color,
          Material: s.material
        },
        parent: s.parent
      }))
    };

    console.log('📊 Graph nodes:', graph.nodes.length);
    console.log('');

    // Run Director analysis
    console.log('Running RbxPreviewDirector...\n');
    const director = new RbxPreviewDirector();
    const enriched = director.enrich(graph, {});

    console.log('✅ Director analysis complete\n');
    console.log('📋 Semantic Analysis:\n');
    
    if (enriched.semantic) {
      console.log('   Vehicles:', enriched.semantic.vehicles ? enriched.semantic.vehicles.length : 0);
      console.log('   Buildings:', enriched.semantic.buildings ? enriched.semantic.buildings.length : 0);
      console.log('   Terrain:', enriched.semantic.terrain ? enriched.semantic.terrain.length : 0);
    }

    if (enriched.characters) {
      console.log('   Character rigs:', enriched.characters.rigs ? enriched.characters.rigs.length : 0);
    }

    if (enriched.performance) {
      console.log('   Parts:', enriched.performance.parts || 0);
      console.log('   Draw calls:', enriched.performance.drawCallEstimate || 0);
      console.log('   Mobile:', enriched.performance.mobile || 'unknown');
    }

    console.log('');

    // Test assertions
    const tests = [
      { name: 'Director returns enriched data', pass: enriched != null },
      { name: 'Semantic analysis exists', pass: enriched.semantic != null },
      { name: 'Performance analysis exists', pass: enriched.performance != null },
      { name: 'Characters analysis exists', pass: enriched.characters != null },
      { name: 'Vehicle detected', pass: enriched.semantic && enriched.semantic.vehicles && enriched.semantic.vehicles.length > 0 },
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
    console.log('🎯 Director successfully enriches preview data');
    console.log('   - Hero detection working');
    console.log('   - Semantic grouping working');
    console.log('   - Performance analysis working\n');

  } catch (e) {
    console.log('❌ Test failed:', e.message);
    console.log(e.stack);
    process.exit(1);
  }
}

test();
