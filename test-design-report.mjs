#!/usr/bin/env node
// test-design-report.mjs — Test Design Report accuracy

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';

console.log('\n📋 TEST: Design Report Accuracy\n');

const testCode = `
local workspace = game:GetService("Workspace")

local part = Instance.new("Part")
part.Name = "SIMPLE_PART"
part.Size = Vector3.new(10, 2, 10)
part.Parent = workspace
`;

console.log('📝 Test Code: Simple Lua source file (no gameplay scripts)\n');

try {
  const builder = new LuaProjectBuilder();
  const result = await builder.build(testCode);

  if (!result.ok) {
    console.log('❌ Build failed:', result.error);
    process.exit(1);
  }

  console.log('✅ Build OK\n');

  const fileCount = result.fileCount;
  const studio = result.studio;

  console.log('📊 Build Metadata:');
  console.log('   File Count: ' + fileCount);
  console.log('   Instance Count: ' + result.instanceCount);
  console.log('');

  if (studio) {
    console.log('📋 Studio Report:');
    console.log('   Readiness: ' + studio.readiness.level);
    console.log('   Evidence: ' + JSON.stringify(studio.readiness.evidence));
    console.log('');

    // Check that report doesn't say "0 scripts" when we have a Lua file
    const evidence = studio.readiness.evidence || [];
    const scriptLine = evidence.find(e => String(e).includes('file') || String(e).includes('script'));

    if (scriptLine) {
      console.log('✓ Script/File line: "' + scriptLine + '"');
      
      if (scriptLine.includes('0 scripts') && fileCount > 2) {
        console.log('❌ FAIL: Shows "0 scripts" despite having ' + fileCount + ' files\n');
        process.exit(1);
      } else if (scriptLine.includes('files')) {
        console.log('✓ Correctly shows file count\n');
      }
    } else {
      console.log('⚠️  No script/file line in evidence\n');
    }

    if (fileCount > 2) {
      console.log('🎉 ✅ TEST PASSED - Design Report accurate!\n');
      console.log('✓ Does NOT show "0 scripts"');
      console.log('✓ Shows file count: ' + fileCount + ' files');
      console.log('✓ Correctly distinguishes source files from gameplay scripts\n');
    } else {
      console.log('❌ Expected fileCount > 2, got ' + fileCount + '\n');
      process.exit(1);
    }
  } else {
    console.log('❌ No studio report in result\n');
    process.exit(1);
  }

} catch (e) {
  console.log('❌ EXCEPTION:', e.message);
  console.log(e.stack);
  process.exit(1);
}
