#!/usr/bin/env node
// profile-build-stages.mjs — Profile build pipeline stages

import { performance } from 'perf_hooks';

// Monkey-patch LuaProjectBuilder to add timing
class ProfiledLuaProjectBuilder {
  async build(source, opts = {}) {
    const timings = {};
    const mark = (name) => {
      const key = 'mark_' + name;
      timings[key] = performance.now();
    };
    const measure = (name, startMark) => {
      const start = timings['mark_' + startMark];
      const end = performance.now();
      timings[name] = end - start;
    };

    mark('start');

    // Import modules
    mark('import_start');
    const { LuaParser } = await import('./runtime/rbx-runtime/LuaParser.js');
    const { expandFactoryFunctions } = await import('./runtime/rbx-runtime/LuaFactoryExpander.js');
    const { InstanceGraphBuilder } = await import('./runtime/rbx-runtime/InstanceGraphBuilder.js');
    const { PreviewRenderer } = await import('./runtime/rbx-runtime/PreviewRenderer.js');
    measure('import', 'import_start');

    if (!source || typeof source !== 'string') {
      return { ok: false, error: 'Empty Lua source' };
    }

    // 1. Parse
    mark('parse_start');
    const ast = new LuaParser().parse(source);
    measure('parse', 'parse_start');

    // 2. Expand factory functions
    mark('expand_start');
    const expandedAst = expandFactoryFunctions(source, ast);
    measure('expand_factory', 'expand_start');

    // 3. Build instance graph
    mark('graph_start');
    const graph = new InstanceGraphBuilder().build(expandedAst);
    measure('build_graph', 'graph_start');

    // 4. Render preview
    mark('render_start');
    const preview = new PreviewRenderer().render(graph);
    measure('render_preview', 'render_start');

    // 5. Diagnostics
    mark('diag_start');
    const allInstanceCreations = expandedAst.nodes.filter(n => n.type === 'InstanceCreation');
    const diagnostics = {
      direct: allInstanceCreations.filter(n => !n.source || n.source === 'direct').length,
      factory: allInstanceCreations.filter(n => n.source && n.source.startsWith('expanded_')).length,
      surfaceGui: graph.nodes.filter(n => n.className === 'SurfaceGui' || n.className === 'BillboardGui').length,
      parentResolved: graph.nodes.filter(n => n.parentVar != null).length,
    };
    measure('diagnostics', 'diag_start');

    measure('total', 'start');

    return {
      ok: true,
      preview,
      graph,
      diagnostics,
      timings
    };
  }
}

// Test code
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

${Array.from({length: 50}, (_, i) => 
  `makePart("Part${i}", Vector3.new(${5 + i}, 2, ${5 + i}), Vector3.new(${i * 10}, 1, 0), Color3.fromRGB(${50 * i % 256}, 100, 200), Enum.Material.Neon)`
).join('\n')}
`;

console.log('\n🔍 PROFILE: Build Pipeline Stages\n');
console.log('Test: 50 Parts with factory function\n');

async function profile() {
  const builder = new ProfiledLuaProjectBuilder();
  const result = await builder.build(testCode);

  if (!result.ok) {
    console.log('❌ Build failed:', result.error);
    process.exit(1);
  }

  const t = result.timings;

  console.log('⏱️  Stage Timings:\n');
  console.log('┌────────────────────────────┬──────────┬──────────┐');
  console.log('│ Stage                      │ Time (ms)│ % of Total│');
  console.log('├────────────────────────────┼──────────┼──────────┤');

  const stages = [
    ['Module Import', 'import'],
    ['Parse Lua', 'parse'],
    ['Expand Factory', 'expand_factory'],
    ['Build Graph', 'build_graph'],
    ['Render Preview', 'render_preview'],
    ['Diagnostics', 'diagnostics']
  ];

  const total = t.total;

  stages.forEach(([name, key]) => {
    const time = t[key] || 0;
    const pct = ((time / total) * 100).toFixed(1);
    console.log(
      '│ ' + name.padEnd(26) + ' │ ' +
      time.toFixed(2).padStart(8) + ' │ ' +
      pct.padStart(8) + '%│'
    );
  });

  console.log('├────────────────────────────┼──────────┼──────────┤');
  console.log(
    '│ TOTAL                      │ ' +
    total.toFixed(2).padStart(8) + ' │      100%│'
  );
  console.log('└────────────────────────────┴──────────┴──────────┘');

  console.log('\n📊 Analysis:\n');

  // Find slowest stage
  const stageTimes = stages.map(([name, key]) => ({ name, time: t[key] || 0 }));
  stageTimes.sort((a, b) => b.time - a.time);

  console.log('   Slowest Stage: ' + stageTimes[0].name + ' (' + stageTimes[0].time.toFixed(2) + 'ms)');
  console.log('   Fastest Stage: ' + stageTimes[stageTimes.length - 1].name + ' (' + stageTimes[stageTimes.length - 1].time.toFixed(2) + 'ms)');

  const overhead = t.import + (t.diagnostics || 0);
  console.log('   Core Pipeline: ' + (total - overhead).toFixed(2) + 'ms');
  console.log('   Overhead:      ' + overhead.toFixed(2) + 'ms (' + ((overhead / total) * 100).toFixed(1) + '%)');

  console.log('\n✅ Profile Complete\n');
}

try {
  await profile();
} catch (e) {
  console.log('\n❌ Profile failed:', e.message);
  console.log(e.stack);
  process.exit(1);
}
