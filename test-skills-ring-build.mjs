#!/usr/bin/env node
// test-skills-ring-build.mjs — Test Skills Ring integration with build pipeline

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';

console.log('\n🧪 TEST: Skills Ring → Build Pipeline Integration\n');

const vehicleScene = `
local workspace = game:GetService("Workspace")

local car = Instance.new("Model")
car.Name = "RaceCar"
car.Parent = workspace

local body = Instance.new("Part")
body.Name = "Body"
body.Size = Vector3.new(6, 2, 10)
body.Position = Vector3.new(0, 2, 0)
body.Color = Color3.fromRGB(255, 50, 50)
body.Parent = car

local wheel1 = Instance.new("Part")
wheel1.Name = "WheelFL"
wheel1.Size = Vector3.new(2, 2, 2)
wheel1.Shape = Enum.PartType.Cylinder
wheel1.Parent = car

local wheel2 = Instance.new("Part")
wheel2.Name = "WheelFR"
wheel2.Size = Vector3.new(2, 2, 2)
wheel2.Shape = Enum.PartType.Cylinder
wheel2.Parent = car

local baseplate = Instance.new("Part")
baseplate.Name = "Baseplate"
baseplate.Size = Vector3.new(200, 1, 200)
baseplate.Anchored = true
baseplate.Parent = workspace
`;

async function test() {
  try {
    console.log('1. Building scene from Lua...\n');
    const builder = new LuaProjectBuilder();
    const result = await builder.build(vehicleScene, {
      projectName: 'SkillsRingTest',
      scriptName: 'TestScene'
    });

    if (!result.ok) {
      console.log('❌ Build failed:', result.error);
      process.exit(1);
    }

    console.log('✅ Build successful\n');
    console.log('   ZIP:', result.zipPath);
    console.log('   Build ID:', result.buildId);
    console.log('');

    // Check Skills Ring data
    console.log('2. Checking Skills Ring data...\n');

    const tests = [
      { name: 'Build returns skillsRing', pass: result.skillsRing != null },
      { name: 'skillsRing has results', pass: result.skillsRing && result.skillsRing.results != null },
      { name: 'skillsRing has pipeline', pass: result.skillsRing && Array.isArray(result.skillsRing.pipeline) },
      { name: 'Pipeline executed (4+ skills)', pass: result.skillsRing && result.skillsRing.pipeline.length >= 4 },
      { name: 'Semantic analysis present', pass: result.skillsRing && result.skillsRing.results['semantic-analysis'] != null },
      { name: 'Quality gate present', pass: result.skillsRing && result.skillsRing.results['quality-gate'] != null },
      { name: 'Vehicle analysis present', pass: result.skillsRing && result.skillsRing.results['vehicle-analysis'] != null },
      { name: 'Governor selected relevant skills', pass: result.skillsRing && result.skillsRing.pipeline.length > 0 },
    ];

    let passed = 0;
    tests.forEach(t => {
      const status = t.pass ? '✅ PASS' : '❌ FAIL';
      console.log('   ' + status + ' — ' + t.name);
      if (t.pass) passed++;
    });

    console.log('');
    console.log('Summary: ' + passed + '/' + tests.length + ' tests passed\n');

    if (result.skillsRing) {
      console.log('3. Skills Ring Results:\n');
      console.log('   Pipeline:', result.skillsRing.pipeline.join(' → '));
      console.log('   Energy used:', result.skillsRing.energyUsed);
      console.log('   Skills executed:', Object.keys(result.skillsRing.results).length);
      console.log('');

      if (result.skillsRing.results['semantic-analysis']) {
        const semantic = result.skillsRing.results['semantic-analysis'];
        console.log('   🎯 Semantic:');
        console.log('      Intent:', semantic.intent);
        console.log('      Confidence:', semantic.confidence);
        console.log('');
      }

      if (result.skillsRing.results['quality-gate']) {
        const quality = result.skillsRing.results['quality-gate'];
        console.log('   ✅ Quality Gate:');
        console.log('      Overall:', quality.scores.overall + '/100');
        console.log('      Verdict:', quality.verdict);
        console.log('      Tier:', quality.tier);
        console.log('      Ready:', quality.ready ? 'YES' : 'NO');
        console.log('');
      }

      if (result.skillsRing.results['performance-analysis']) {
        const perf = result.skillsRing.results['performance-analysis'];
        console.log('   ⚡ Performance:');
        console.log('      Draw Calls:', perf.drawCalls.estimated, '(' + perf.drawCalls.level + ')');
        console.log('      Memory:', perf.memory.estimatedMB + 'MB', '(' + perf.memory.level + ')');
        console.log('      Mobile Ready:', perf.mobileReadiness.score + '/100', '(' + perf.mobileReadiness.level + ')');
        console.log('');
      }
    }

    if (passed < tests.length) {
      console.log('❌ Some tests failed');
      process.exit(1);
    }

    console.log('✅ All tests passed!');
    console.log('🎯 Skills Ring successfully integrated into build pipeline!\n');

  } catch (e) {
    console.log('❌ Test failed:', e.message);
    console.log(e.stack);
    process.exit(1);
  }
}

test();
