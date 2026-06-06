#!/usr/bin/env node
// benchmark-parser-performance.mjs — Parser performance baseline

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';
import { performance } from 'perf_hooks';

console.log('\n⚡ BENCHMARK: Parser Performance\n');

// Test cases of varying complexity
const testCases = [
  {
    name: 'Minimal (1 Part)',
    code: `
local workspace = game:GetService("Workspace")
local part = Instance.new("Part")
part.Name = "TestPart"
part.Size = Vector3.new(10, 2, 10)
part.Parent = workspace
    `
  },
  {
    name: 'Small (5 Parts)',
    code: `
local workspace = game:GetService("Workspace")
${Array.from({length: 5}, (_, i) => `
local part${i} = Instance.new("Part")
part${i}.Name = "Part${i}"
part${i}.Size = Vector3.new(${5 + i}, 2, ${5 + i})
part${i}.Position = Vector3.new(${i * 10}, 1, 0)
part${i}.Color = Color3.fromRGB(${50 * i}, 100, 200)
part${i}.Material = Enum.Material.SmoothPlastic
part${i}.Parent = workspace
`).join('\n')}
    `
  },
  {
    name: 'Medium (20 Parts + Factory)',
    code: `
local workspace = game:GetService("Workspace")

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

${Array.from({length: 20}, (_, i) => 
  `makePart("FactoryPart${i}", Vector3.new(${5 + i}, ${2 + i}, ${5 + i}), Vector3.new(${i * 15}, ${i * 2}, ${i * 10}), Color3.fromRGB(${10 * i}, ${5 * i}, 255), Enum.Material.Neon)`
).join('\n')}
    `
  },
  {
    name: 'Large (50 Parts)',
    code: `
local workspace = game:GetService("Workspace")
${Array.from({length: 50}, (_, i) => `
local part${i} = Instance.new("Part")
part${i}.Name = "Part${i}"
part${i}.Size = Vector3.new(${3 + i % 10}, ${1 + i % 5}, ${3 + i % 10})
part${i}.Position = Vector3.new(${(i % 10) * 8}, ${Math.floor(i / 10) * 4}, ${(i % 5) * 12})
part${i}.Color = Color3.fromRGB(${(i * 5) % 256}, ${(i * 7) % 256}, ${(i * 11) % 256})
part${i}.Material = Enum.Material.${['SmoothPlastic', 'Neon', 'Metal', 'Glass', 'Wood'][i % 5]}
part${i}.Shape = Enum.PartType.${['Block', 'Cylinder', 'Ball'][i % 3]}
part${i}.Anchored = true
part${i}.Parent = workspace
`).join('\n')}
    `
  },
  {
    name: 'Complex (100 Parts + Hierarchy)',
    code: `
local workspace = game:GetService("Workspace")

local model = Instance.new("Model")
model.Name = "ComplexModel"
model.Parent = workspace

${Array.from({length: 100}, (_, i) => `
local part${i} = Instance.new("Part")
part${i}.Name = "Part${i}"
part${i}.Size = Vector3.new(${2 + i % 8}, ${1 + i % 4}, ${2 + i % 8})
part${i}.Position = Vector3.new(${(i % 20) * 6}, ${Math.floor(i / 20) * 3}, ${(i % 10) * 8})
part${i}.Color = Color3.fromRGB(${(i * 3) % 256}, ${(i * 5) % 256}, ${(i * 7) % 256})
part${i}.Material = Enum.Material.${['SmoothPlastic', 'Neon', 'Metal'][i % 3]}
part${i}.Parent = ${i % 10 === 0 ? 'model' : `part${i - 1}`}
`).join('\n')}
    `
  }
];

async function benchmark(testCase, iterations = 3) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await new LuaProjectBuilder().build(testCase.code);
    const end = performance.now();
    
    if (!result.ok) {
      throw new Error('Build failed: ' + result.error);
    }
    
    times.push(end - start);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  return { avg, min, max, times };
}

async function runBenchmarks() {
  console.log('Running benchmarks (3 iterations each)...\n');
  
  const results = [];
  
  for (const testCase of testCases) {
    process.stdout.write('Testing: ' + testCase.name.padEnd(35) + ' ... ');
    
    const result = await benchmark(testCase);
    results.push({ name: testCase.name, ...result });
    
    console.log(result.avg.toFixed(2) + 'ms (avg)');
  }
  
  console.log('\n📊 Results Summary:\n');
  console.log('┌─────────────────────────────────────┬─────────┬─────────┬─────────┐');
  console.log('│ Test Case                           │ Min     │ Avg     │ Max     │');
  console.log('├─────────────────────────────────────┼─────────┼─────────┼─────────┤');
  
  results.forEach(r => {
    console.log(
      '│ ' + r.name.padEnd(35) + ' │ ' + 
      r.min.toFixed(2).padStart(6) + 'ms │ ' +
      r.avg.toFixed(2).padStart(6) + 'ms │ ' +
      r.max.toFixed(2).padStart(6) + 'ms │'
    );
  });
  
  console.log('└─────────────────────────────────────┴─────────┴─────────┴─────────┘');
  
  // Performance metrics
  const minimalAvg = results[0].avg;
  const complexAvg = results[results.length - 1].avg;
  const scaleFactor = complexAvg / minimalAvg;
  
  console.log('\n⚡ Performance Metrics:\n');
  console.log('   Baseline (1 Part):    ' + minimalAvg.toFixed(2) + 'ms');
  console.log('   Complex (100 Parts):  ' + complexAvg.toFixed(2) + 'ms');
  console.log('   Scale Factor:         ' + scaleFactor.toFixed(2) + 'x');
  console.log('   Per-Part Overhead:    ' + ((complexAvg - minimalAvg) / 100).toFixed(2) + 'ms');
  console.log('');
  
  if (scaleFactor < 3) {
    console.log('✅ EXCELLENT: Sub-linear scaling (< 3x for 100x parts)');
  } else if (scaleFactor < 5) {
    console.log('✓ GOOD: Reasonable scaling (< 5x for 100x parts)');
  } else {
    console.log('⚠️  SLOW: High scaling factor - optimization recommended');
  }
  
  console.log('');
}

try {
  await runBenchmarks();
} catch (e) {
  console.log('\n❌ Benchmark failed:', e.message);
  console.log(e.stack);
  process.exit(1);
}
