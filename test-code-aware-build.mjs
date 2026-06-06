// test-code-aware-build.mjs — Test Code-Aware Factory build pipeline

import { RobloxOrchestrator, INTENT } from './m2/roblox/roblox-orchestrator.js';
import { execSync } from 'child_process';
import path from 'path';

console.log('\n🏭 CODE-AWARE FACTORY — BUILD TEST\n');

const userHumanoidCode = `
-- User's NPC creation code
local npc = Instance.new("Model")
npc.Name = "MyGuard"

local head = Instance.new("Part")
head.Name = "Head"
head.Shape = Enum.PartType.Ball
head.Size = Vector3.new(2, 1, 1)
head.BrickColor = BrickColor.new("Bright yellow")
head.Parent = npc

local torso = Instance.new("Part")
torso.Name = "Torso"
torso.Size = Vector3.new(2, 2, 1)
torso.BrickColor = BrickColor.new("Bright blue")
torso.Parent = npc

local humanoid = Instance.new("Humanoid")
humanoid.Parent = npc

npc.Parent = workspace
`;

// Test build with user source
async function testCodeAwareBuild() {
  console.log('TEST: Building RPG with user Humanoid code');
  console.log('Expected: Code analyzer detects Humanoid, builds minimal support\n');

  const result = await RobloxOrchestrator.process(
    {
      type: INTENT.BUILD,
      targetId: 'rpg',
      gameName: 'CodeAwareTest',
      version: '1.0.0',
      userSource: userHumanoidCode,  // ← USER CODE PROVIDED
    },
    {
      targetsDir: path.resolve('./targets'),
      profilesDir: path.resolve('./packageProfiles'),
      exportsDir: path.resolve('./exports-rbx'),
      auditLedger: {
        log: (msg, meta) => {}, // silent
        info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
        error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
      },
    }
  );

  console.log('\n═══════════════════════════════════════════');
  console.log('BUILD RESULT:');
  console.log('  OK:', result.ok);
  console.log('  Build ID:', result.buildId || 'N/A');
  console.log('  ZIP:', result.zipPath || 'N/A');

  if (result.ok && result.zipPath) {
    // Inspect the build
    console.log('\n📦 INSPECTING BUILD CONTENTS:');
    
    try {
      const scenegraph = execSync(
        `unzip -p "${result.zipPath}" production-scenegraph.json`,
        { encoding: 'utf8' }
      );
      const sg = JSON.parse(scenegraph);
      
      console.log('  Total nodes:', sg.nodes.length);
      
      // Check for humanoid parts
      const humanoidParts = sg.nodes.filter(n => 
        n.attributes && n.attributes.kind && ['head', 'torso', 'limb'].includes(n.attributes.kind)
      );
      
      console.log('  Humanoid parts:', humanoidParts.length);
      
      // Check for user seed script
      const hasUserSeed = sg.nodes.some(n => n.name === 'AF51UserSeed');
      console.log('  User seed script:', hasUserSeed ? 'YES' : 'NO');
      
      // Check composition mode
      console.log('\n✓ Code-aware build completed!');
      console.log('  If this shows humanoid parts BUT less than 415 total nodes,');
      console.log('  then code-aware mode is working (minimal composition).');
      
    } catch (e) {
      console.error('Failed to inspect ZIP:', e.message);
    }
  } else {
    console.error('\n❌ Build failed:', result.error);
  }
  
  console.log('═══════════════════════════════════════════\n');
}

testCodeAwareBuild().catch(console.error);
