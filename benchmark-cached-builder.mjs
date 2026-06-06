#!/usr/bin/env node
// benchmark-cached-builder.mjs — Compare cached vs uncached builder

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';
import { CachedLuaProjectBuilder } from './runtime/rbx-runtime/CachedLuaProjectBuilder.js';
import { performance } from 'perf_hooks';

console.log('\n⚡ BENCHMARK: Cached vs Uncached Builder\n');

const testCode = `
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

${Array.from({length: 30}, (_, i) => 
  `makePart("Part${i}", Vector3.new(${5 + i}, 2, ${5 + i}), Vector3.new(${i * 10}, 1, 0), Color3.fromRGB(${50 * i % 256}, 100, 200), Enum.Material.Neon)`
).join('\n')}
`;

async function benchmarkUncached(iterations = 5) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const builder = new LuaProjectBuilder();
    const result = await builder.build(testCode);
    const end = performance.now();
    
    if (!result.ok) throw new Error('Build failed');
    times.push(end - start);
  }
  
  return times;
}

async function benchmarkCached(iterations = 5) {
  const times = [];
  const builder = CachedLuaProjectBuilder.getInstance();
  builder.disableCache(); // Disable cache for fair comparison
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await builder.build(testCode);
    const end = performance.now();
    
    if (!result.ok) throw new Error('Build failed');
    times.push(end - start);
  }
  
  return times;
}

async function benchmarkWithCache(iterations = 5) {
  const times = [];
  const builder = CachedLuaProjectBuilder.getInstance();
  builder.enableCache(10);
  builder.clearCache();
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await builder.build(testCode);
    const end = performance.now();
    
    if (!result.ok) throw new Error('Build failed');
    times.push(end - start);
  }
  
  const stats = builder.getCacheStats();
  return { times, stats };
}

function analyze(times) {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return { avg, min, max };
}

async function run() {
  console.log('Test: 30 Parts with factory function');
  console.log('Iterations: 5 per test\n');
  
  // Warmup
  console.log('Warming up...');
  await new LuaProjectBuilder().build(testCode);
  
  console.log('Running benchmarks...\n');
  
  // Test 1: Uncached (new builder each time)
  console.log('1. Uncached (new builder per build)...');
  const uncachedTimes = await benchmarkUncached(5);
  const uncached = analyze(uncachedTimes);
  
  // Test 2: Cached builder (no cache, reuse instance)
  console.log('2. Singleton (reused instance, no cache)...');
  const singletonTimes = await benchmarkCached(5);
  const singleton = analyze(singletonTimes);
  
  // Test 3: With cache enabled
  console.log('3. With cache (same source)...');
  const { times: cachedTimes, stats } = await benchmarkWithCache(5);
  const cached = analyze(cachedTimes);
  
  console.log('\n📊 Results:\n');
  console.log('┌────────────────────────────────┬─────────┬─────────┬─────────┐');
  console.log('│ Method                         │ Min     │ Avg     │ Max     │');
  console.log('├────────────────────────────────┼─────────┼─────────┼─────────┤');
  
  [
    ['Uncached (new builder)', uncached],
    ['Singleton (reused)', singleton],
    ['With cache', cached]
  ].forEach(([name, r]) => {
    console.log(
      '│ ' + name.padEnd(30) + ' │ ' +
      r.min.toFixed(2).padStart(6) + 'ms │ ' +
      r.avg.toFixed(2).padStart(6) + 'ms │ ' +
      r.max.toFixed(2).padStart(6) + 'ms │'
    );
  });
  
  console.log('└────────────────────────────────┴─────────┴─────────┴─────────┘');
  
  console.log('\n⚡ Performance Improvement:\n');
  
  const singletonImprovement = ((uncached.avg - singleton.avg) / uncached.avg * 100);
  const cacheImprovement = ((uncached.avg - cached.avg) / uncached.avg * 100);
  
  console.log('   Singleton vs Uncached:  ' + singletonImprovement.toFixed(1) + '% faster');
  console.log('   Cache vs Uncached:      ' + cacheImprovement.toFixed(1) + '% faster');
  
  if (singletonImprovement > 10) {
    console.log('   ✓ Significant improvement from singleton pattern');
  }
  
  console.log('\n📈 Cache Statistics:\n');
  console.log('   Hits:     ' + stats.hits);
  console.log('   Misses:   ' + stats.misses);
  console.log('   Hit Rate: ' + stats.hitRate);
  console.log('');
  
  if (stats.hits > 0) {
    const firstBuild = cachedTimes[0];
    const cachedBuilds = cachedTimes.slice(1);
    const avgCached = cachedBuilds.reduce((a, b) => a + b, 0) / cachedBuilds.length;
    const speedup = (firstBuild / avgCached).toFixed(1);
    
    console.log('   First build:  ' + firstBuild.toFixed(2) + 'ms');
    console.log('   Cached build: ' + avgCached.toFixed(2) + 'ms (avg)');
    console.log('   Speedup:      ' + speedup + 'x\n');
  }
  
  console.log('✅ Benchmark Complete\n');
}

try {
  await run();
} catch (e) {
  console.log('\n❌ Benchmark failed:', e.message);
  console.log(e.stack);
  process.exit(1);
}
