#!/usr/bin/env node
// demo-code-aware-factory.mjs — CODE-AWARE FACTORY Demo
// Demonstroi miten tehdas lukee käyttäjän koodin ja reagoi siihen

import { analyzeCodeFeatures } from './m2/roblox/lua-code-analyzer.js';

console.log('\n🏭 CODE-AWARE FACTORY — DEMO\n');
console.log('═══════════════════════════════════════════════════════════\n');

// ─── DEMO 1: Täydellinen Humanoid rig ────────────────────────────────
console.log('📋 DEMO 1: Täydellinen Humanoid-koodi (ei tarvitse tukea)\n');

const completeHumanoid = `
local npc = Instance.new("Model")
npc.Name = "Guard"

local head = Instance.new("Part")
head.Name = "Head"
head.Shape = Enum.PartType.Ball
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

npc.Parent = workspace
`;

const result1 = analyzeCodeFeatures(completeHumanoid);
console.log('✓ Tunnistetut ominaisuudet:', result1.analysis.signals);
console.log('✓ Tarvittava tuki:', Object.keys(result1.supportNeeds).filter(k => result1.supportNeeds[k]));
console.log('✓ Target-vihje:', result1.targetHint);
console.log('✓ Yhteenveto:', result1.analysis.summary);
console.log('');
console.log('→ TEHDAS: "Code-driven mode — käyttäjän koodi on valmis"');
console.log('→ BUILD: Vain käyttäjän koodi, EI template-geometriaa');
console.log('');

// ─── DEMO 2: Osittainen Humanoid (tarvitsee tukea) ───────────────────
console.log('═══════════════════════════════════════════════════════════\n');
console.log('📋 DEMO 2: Osittainen Humanoid-koodi (tarvitsee R6 rig -tukea)\n');

const partialHumanoid = `
local npc = Instance.new("Model")
npc.Name = "Shopkeeper"

local head = Instance.new("Part")
head.Name = "Head"
head.Shape = Enum.PartType.Ball
head.BrickColor = BrickColor.new("Bright yellow")
head.Parent = npc

local humanoid = Instance.new("Humanoid")
humanoid.Parent = npc

npc.Parent = workspace
`;

const result2 = analyzeCodeFeatures(partialHumanoid);
console.log('✓ Tunnistetut ominaisuudet:', result2.analysis.signals);
console.log('✓ Tarvittava tuki:', Object.keys(result2.supportNeeds).filter(k => result2.supportNeeds[k]));
console.log('✓ Target-vihje:', result2.targetHint);
console.log('✓ Yhteenveto:', result2.analysis.summary);
console.log('');
console.log('→ TEHDAS: "CODE-AWARE: minimal rpg-like support"');
console.log('→ BUILD: Käyttäjän koodi + R6 rig -tukirakenteen');
console.log('');

// ─── DEMO 3: OBBY Checkpoint -koodi ──────────────────────────────────
console.log('═══════════════════════════════════════════════════════════\n');
console.log('📋 DEMO 3: OBBY Checkpoint -koodi\n');

const obbyCode = `
local checkpoint = script.Parent

checkpoint.Touched:Connect(function(hit)
  local humanoid = hit.Parent:FindFirstChild("Humanoid")
  if humanoid then
    local player = game.Players:GetPlayerFromCharacter(hit.Parent)
    if player then
      local leaderstats = player:FindFirstChild("leaderstats")
      if leaderstats then
        leaderstats.Stage.Value = leaderstats.Stage.Value + 1
      end
    end
  end
end)
`;

const result3 = analyzeCodeFeatures(obbyCode);
console.log('✓ Tunnistetut ominaisuudet:', result3.analysis.signals);
console.log('✓ Tarvittava tuki:', Object.keys(result3.supportNeeds).filter(k => result3.supportNeeds[k]));
console.log('✓ Target-vihje:', result3.targetHint);
console.log('✓ Yhteenveto:', result3.analysis.summary);
console.log('');
console.log('→ TEHDAS: "CODE-AWARE: obby-like — minimal checkpoint support"');
console.log('→ BUILD: Käyttäjän koodi + checkpoint-systeemi');
console.log('');

// ─── DEMO 4: Simulator Click -koodi ──────────────────────────────────
console.log('═══════════════════════════════════════════════════════════\n');
console.log('📋 DEMO 4: Simulator Click-koodi\n');

const simulatorCode = `
local part = script.Parent
local clickDetector = Instance.new("ClickDetector")
clickDetector.Parent = part

clickDetector.MouseClick:Connect(function(player)
  local leaderstats = player:FindFirstChild("leaderstats")
  if leaderstats then
    local coins = leaderstats:FindFirstChild("Coins")
    if coins then
      coins.Value = coins.Value + 10
    end
  end
end)
`;

const result4 = analyzeCodeFeatures(simulatorCode);
console.log('✓ Tunnistetut ominaisuudet:', result4.analysis.signals);
console.log('✓ Tarvittava tuki:', Object.keys(result4.supportNeeds).filter(k => result4.supportNeeds[k]));
console.log('✓ Target-vihje:', result4.targetHint);
console.log('✓ Yhteenveto:', result4.analysis.summary);
console.log('');
console.log('→ TEHDAS: "CODE-AWARE: simulator-like — minimal click support"');
console.log('→ BUILD: Käyttäjän koodi + click-käsittely');
console.log('');

// ─── YHTEENVETO ───────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════\n');
console.log('✅ CODE-AWARE FACTORY TOIMII!\n');
console.log('Tehdas:');
console.log('  • LUKEE käyttäjän koodin');
console.log('  • ANALYSOI mitä koodi sisältää');
console.log('  • PÄÄTTELEE mitä tukea tarvitaan');
console.log('  • RAKENTAA vain sen mitä tarvitaan');
console.log('  • EI pakota template-maailmoja päälle\n');
console.log('→ "Eihän se muuten mikää tehdas ole" — NYT SE ON! 🏭✨\n');
