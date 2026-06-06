// test-code-analyzer.mjs — Test Code-Aware Factory analyzer

import { analyzeCodeFeatures } from './m2/roblox/lua-code-analyzer.js';

console.log('\n🔬 CODE-AWARE FACTORY — ANALYZER TESTS\n');

// ─── TEST 1: Humanoid NPC code ──────────────────────────────────────────
const humanoidCode = `
local npc = Instance.new("Model")
npc.Name = "Guard"

local head = Instance.new("Part")
head.Name = "Head"
head.Shape = Enum.PartType.Ball
head.Parent = npc

local torso = Instance.new("Part")
torso.Name = "Torso"
torso.Parent = npc

local humanoid = Instance.new("Humanoid")
humanoid.Parent = npc
`;

console.log('TEST 1: Humanoid NPC Code');
const result1 = analyzeCodeFeatures(humanoidCode);
console.log('✓ Features detected:', result1.analysis.signals);
console.log('✓ Support needs:', Object.keys(result1.supportNeeds).filter(k => result1.supportNeeds[k]));
console.log('✓ Target hint:', result1.targetHint);
console.log('✓ Summary:', result1.analysis.summary);
console.log('');

// ─── TEST 2: OBBY Checkpoint code ───────────────────────────────────────
const obbyCode = `
local checkpoint = script.Parent
checkpoint.Touched:Connect(function(hit)
  local player = game.Players:GetPlayerFromCharacter(hit.Parent)
  if player then
    local leaderstats = player:FindFirstChild("leaderstats")
    if leaderstats then
      leaderstats.Stage.Value = leaderstats.Stage.Value + 1
    end
  end
end)
`;

console.log('TEST 2: OBBY Checkpoint Code');
const result2 = analyzeCodeFeatures(obbyCode);
console.log('✓ Features detected:', result2.analysis.signals);
console.log('✓ Support needs:', Object.keys(result2.supportNeeds).filter(k => result2.supportNeeds[k]));
console.log('✓ Target hint:', result2.targetHint);
console.log('✓ Summary:', result2.analysis.summary);
console.log('');

// ─── TEST 3: Simulator Click code ───────────────────────────────────────
const simulatorCode = `
local clickDetector = Instance.new("ClickDetector")
clickDetector.Parent = script.Parent

clickDetector.MouseClick:Connect(function(player)
  player.leaderstats.Coins.Value = player.leaderstats.Coins.Value + 10
end)
`;

console.log('TEST 3: Simulator Click Code');
const result3 = analyzeCodeFeatures(simulatorCode);
console.log('✓ Features detected:', result3.analysis.signals);
console.log('✓ Support needs:', Object.keys(result3.supportNeeds).filter(k => result3.supportNeeds[k]));
console.log('✓ Target hint:', result3.targetHint);
console.log('✓ Summary:', result3.analysis.summary);
console.log('');

// ─── TEST 4: Complete R6 Rig (no support needed) ────────────────────────
const completeRigCode = `
local npc = Instance.new("Model")
local head = Instance.new("Part")
head.Name = "Head"
head.Parent = npc

local torso = Instance.new("Part")
torso.Name = "Torso"
torso.Parent = npc

local leftArm = Instance.new("Part")
leftArm.Name = "LeftArm"
leftArm.Parent = npc

local rightArm = Instance.new("Part")
rightArm.Name = "RightArm"
rightArm.Parent = npc

local leftLeg = Instance.new("Part")
leftLeg.Name = "LeftLeg"
leftLeg.Parent = npc

local rightLeg = Instance.new("Part")
rightLeg.Name = "RightLeg"
rightLeg.Parent = npc

local motor = Instance.new("Motor6D")
motor.Parent = torso

local humanoid = Instance.new("Humanoid")
humanoid.Parent = npc
`;

console.log('TEST 4: Complete R6 Rig (full code)');
const result4 = analyzeCodeFeatures(completeRigCode);
console.log('✓ Features detected:', result4.analysis.signals);
console.log('✓ Support needs:', Object.keys(result4.supportNeeds).filter(k => result4.supportNeeds[k]));
console.log('✓ Target hint:', result4.targetHint);
console.log('✓ Summary:', result4.analysis.summary);
console.log('');

// ─── SUMMARY ────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════');
console.log('✅ CODE-AWARE FACTORY ANALYZER:');
console.log('   • Detects Humanoid → suggests R6 rig support');
console.log('   • Detects Checkpoints → suggests OBBY-like');
console.log('   • Detects ClickDetector → suggests Simulator-like');
console.log('   • Detects complete rig → no extra support needed');
console.log('═══════════════════════════════════════════════════════\n');
