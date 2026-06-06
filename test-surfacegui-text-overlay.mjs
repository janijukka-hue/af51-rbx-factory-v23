#!/usr/bin/env node
// test-surfacegui-text-overlay.mjs — Test SurfaceGui text overlay rendering

import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';

console.log('\n🧪 TEST: SurfaceGui/BillboardGui Text Overlay\n');

const testCode = `
local workspace = game:GetService("Workspace")

local sign = Instance.new("Part")
sign.Name = "BIG_SIGN"
sign.Size = Vector3.new(40, 12, 1)
sign.Position = Vector3.new(0, 10, 0)
sign.Anchored = true
sign.Color = Color3.fromRGB(30, 30, 30)
sign.Material = Enum.Material.SmoothPlastic
sign.Parent = workspace

local surfaceGui = Instance.new("SurfaceGui")
surfaceGui.Parent = sign

local textLabel = Instance.new("TextLabel")
textLabel.Text = "SEGERMAN ON RBX KUNINGAS"
textLabel.Parent = surfaceGui
`;

console.log('📋 Test Code: SurfaceGui with TextLabel on Part\n');

try {
  const builder = new LuaProjectBuilder();
  const result = await builder.build(testCode);

  if (!result.ok) {
    console.log('❌ Build failed:', result.error);
    process.exit(1);
  }

  console.log('✅ Build OK\n');

  if (result.preview && result.preview.structures) {
    const structures = result.preview.structures;
    console.log('🔍 Preview Structures:', structures.length, '\n');

    const part = structures.find(s => s.label === 'BIG_SIGN');
    const textLabel = structures.find(s => s.luaClass === 'TextLabel');

    if (!part) {
      console.log('❌ Part "BIG_SIGN" not found');
      process.exit(1);
    }

    if (!textLabel) {
      console.log('❌ TextLabel not found');
      process.exit(1);
    }

    console.log('✅ Found BIG_SIGN Part');
    console.log('✅ Found TextLabel\n');

    if (textLabel.textOverlay) {
      console.log('📝 TextLabel has overlay:');
      console.log('   Text: "' + textLabel.textOverlay + '"');
      console.log('   Target: ' + textLabel.textOverlayTarget + '\n');

      if (textLabel.textOverlay === 'SEGERMAN ON RBX KUNINGAS') {
        console.log('🎉 ✅ TEST PASSED - Text overlay working!\n');
      } else {
        console.log('❌ Wrong text overlay:', textLabel.textOverlay);
        process.exit(1);
      }
    } else {
      console.log('❌ TextLabel missing textOverlay metadata\n');
      console.log('TextLabel structure:', JSON.stringify(textLabel, null, 2));
      process.exit(1);
    }
  } else {
    console.log('⚠️  No preview data\n');
    process.exit(1);
  }

} catch (e) {
  console.log('❌ EXCEPTION:', e.message);
  console.log(e.stack);
  process.exit(1);
}
