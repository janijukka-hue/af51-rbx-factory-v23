// test-rbx-directors.mjs — Dual Preview Intelligence over REAL parsed graphs.
import { readFileSync } from "fs";
import { LuaParser } from "./runtime/rbx-runtime/LuaParser.js";
import { InstanceGraphBuilder } from "./runtime/rbx-runtime/InstanceGraphBuilder.js";
import { analyzeScene } from "./s4/oliot/rbx-directors/index.js";

const C = { g:"\x1b[32m", r:"\x1b[31m", x:"\x1b[0m", b:"\x1b[1m" };
let P=0,F=0;
const ok=(n,c,d)=>c?(P++,console.log(`  ${C.g}✓${C.x} ${n}`)):(F++,console.log(`  ${C.r}✗ ${n}${C.x}${d?"  "+d:""}`));

function graphFromLua(src) {
  const parsed = new LuaParser().parse(src);
  return new InstanceGraphBuilder().build(parsed);
}

console.log(`${C.b}RBX Dual Preview Intelligence${C.x}\n`);

// ── 1) Hero character (round head + cap) ─────────────────────────────────
const hero = readFileSync("/home/claude/af51-hero-character.lua","utf8");
const a1 = analyzeScene(graphFromLua(hero));
console.log("HERO CHARACTER:");
ok("Preview Director finds a character rig", a1.enriched.characters.rigs.length >= 1,
  JSON.stringify(a1.enriched.characters.rigs.map(r=>r.name)));
ok("character has head + limbs recognized",
  a1.enriched.characters.rigs.some(r => r.parts.head) ||
  a1.enriched.characters.looseHumanoidParts.length > 0);
ok("materials counted from real code", Object.keys(a1.enriched.materials.counts).length >= 1,
  JSON.stringify(a1.enriched.materials.counts));
ok("Neon → glow hint", a1.enriched.materials.hints.glow === true);
ok("performance gives mobile estimate", !!a1.enriched.performance.mobile,
  a1.enriched.performance.mobile + " / draws=" + a1.enriched.performance.drawCallEstimate);
ok("Creative: characterArt is evidence-based (not undetermined)",
  a1.report.characterArt.value !== "undetermined" && a1.report.characterArt.evidence.length > 0,
  JSON.stringify(a1.report.characterArt));
ok("Creative: cinematic hero object identified",
  a1.report.cinematic.value !== "undetermined", a1.report.cinematic.value);

// ── 2) A small RPG-ish scene (gameplay signals present) ──────────────────
const rpg = `local npc = Instance.new("Part")
npc.Name = "MerchantNPC"
npc.Parent = workspace
local quest = Instance.new("Part")
quest.Name = "QuestBoard"
quest.Parent = workspace
local dungeon = Instance.new("Part")
dungeon.Name = "DungeonGate"
dungeon.Parent = workspace
local spawn = Instance.new("SpawnLocation")
spawn.Name = "Spawn"
spawn.Parent = workspace`;
const a2 = analyzeScene(graphFromLua(rpg));
console.log("\nRPG SCENE:");
ok("Creative Director infers gameplay = rpg", a2.report.gameplayType.value === "rpg",
  a2.report.gameplayType.value + " (conf " + a2.report.gameplayType.confidence + ")");
ok("gameplay inference carries evidence", a2.report.gameplayType.evidence.length > 0,
  JSON.stringify(a2.report.gameplayType.evidence));
ok("Preview Director groups NPCs/shops/spawns",
  (a2.enriched.semantic.npcs||[]).length > 0 && (a2.enriched.semantic.spawns||[]).length > 0);

// ── 3) HONESTY: a bare scene must NOT get invented verdicts ───────────────
const bare = `local p = Instance.new("Part")
p.Name = "Block1"
p.Parent = workspace`;
const a3 = analyzeScene(graphFromLua(bare));
console.log("\nBARE SCENE (honesty checks):");
ok("no gameplay signal → gameplayType undetermined", a3.report.gameplayType.value === "undetermined",
  a3.report.gameplayType.value);
ok("no style signal → artDirection undetermined", a3.report.artDirection.value === "undetermined",
  a3.report.artDirection.value);
ok("no character → characterArt undetermined", a3.report.characterArt.value === "undetermined");
ok("no UI → uiux undetermined", a3.report.uiux.value === "undetermined");
ok("empty semantic buckets are omitted, not faked",
  Object.keys(a3.enriched.semantic).length === 0 ||
  !a3.enriched.semantic.npcs);

// ── 4) Directors never mutate the product (no node generation) ───────────
const before = graphFromLua(bare);
const beforeCount = before.nodes.length;
analyzeScene(before);
ok("analyzeScene does not add/remove nodes (read-only)", before.nodes.length === beforeCount,
  beforeCount + " nodes before/after");

// ── 5) Studio Director — production readiness ────────────────────────────
console.log("\nSTUDIO DIRECTOR:");
const sa = analyzeScene(graphFromLua(hero));
ok("studio report present", !!sa.studio && sa.studio.kind === "STUDIO_REPORT");
ok("readiness is evidence-based finding", sa.studio.readiness && Array.isArray(sa.studio.readiness.evidence) && sa.studio.readiness.evidence.length > 0);
ok("mobile readiness derived from perf", typeof sa.studio.mobile === "string");
ok("runtime boundary stated honestly", /Roblox Studio/.test(sa.studio.runtimeNote));
// bare scene with no spawn → risk flagged
const noSpawn = analyzeScene(graphFromLua(`local p=Instance.new("Part")\np.Name="X"\np.Parent=workspace`));
ok("no-spawn scene flags publish risk", noSpawn.studio.risks.some(r => /SpawnLocation/.test(r)));

// ── 6) Cinematic Director — shot selection (no generation) ───────────────
console.log("\nCINEMATIC DIRECTOR:");
ok("shot list present", !!sa.shots && Array.isArray(sa.shots.shots) && sa.shots.shots.length > 0);
ok("character rig → character shot", sa.shots.shots.some(s => s.id === "character"));
ok("always has an overview shot", sa.shots.shots.some(s => s.id === "overview"));
ok("every shot carries evidence + mode", sa.shots.shots.every(s => s.mode && s.evidence));
ok("opening shot chosen", typeof sa.shots.opening === "string");
// UI scene → UI shot
const uiScene = analyzeScene(graphFromLua(`local g=Instance.new("ScreenGui")\ng.Name="HUD"\ng.Parent=game\nlocal f=Instance.new("Frame")\nf.Name="Panel"\nf.Parent=g`));
ok("UI present → UI shot offered", uiScene.shots.shots.some(s => s.id === "ui"));

console.log(`\n${C.b}RBX DIRECTORS: ${P+F} | Pass: ${C.g}${P}${C.x} | Fail: ${F>0?C.r:""}${F}${C.x}`);
process.exit(F===0?0:1);
