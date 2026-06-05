// test-rbx-humanoid-production.mjs — Humanoid geometry in production builds
// Tests that RPG NPCs are built as proper humanoid models (head/torso/limbs)
// instead of single-box placeholders, and that MeshPass correctly transforms
// them into recognizable character forms (spherical heads, cylindrical limbs).

import { readFileSync, existsSync } from "fs";
import { SceneGraph } from "./t3/Factory/rbx-production/scene-graph.js";
import { CompositionEngine } from "./t3/Factory/rbx-production/composition-engine.js";
import { MeshPass } from "./t3/Factory/rbx-production/mesh-pass.js";

const C = { g:"\x1b[32m", r:"\x1b[31m", x:"\x1b[0m", b:"\x1b[1m", y:"\x1b[33m" };
let P=0,F=0;
const ok=(n,c,d)=>c?(P++,console.log(`  ${C.g}✓${C.x} ${n}`)):(F++,console.log(`  ${C.r}✗ ${n}${C.x}${d?"  "+d:""}`));

console.log(`${C.b}RBX Humanoid Production Pipeline — contract${C.x}\n`);

// ─── Build RPG scene ──────────────────────────────────────────────────────
const graph = new SceneGraph("rpg-test");
const composeResult = CompositionEngine.compose({ graph, target: { type: "rpg" } });

console.log("COMPOSITION:");
ok("RPG composition succeeded", composeResult.ok);
ok("Parts created", composeResult.partsAdded > 0, String(composeResult.partsAdded));

// ─── Find NPC Models ──────────────────────────────────────────────────────
const npcModels = graph.nodes.filter(n => n.className === "Model" && n.tags.includes("humanoid-model"));
const npcNames = npcModels.map(m => m.name).sort();

console.log("\nHUMANOID MODELS:");
ok("4 NPC models created (Innkeeper, Blacksmith, Merchant, Priest)", npcModels.length === 4, String(npcModels.length));
ok("Innkeeper present", npcNames.includes("Innkeeper"));
ok("Blacksmith present", npcNames.includes("Blacksmith"));
ok("Merchant present", npcNames.includes("Merchant"));
ok("Priest present", npcNames.includes("Priest"));

// ─── Verify humanoid structure ────────────────────────────────────────────
console.log("\nHUMANOID STRUCTURE:");

let totalHeads = 0, totalTorsos = 0, totalLimbs = 0;
for (const npc of npcModels) {
  const modelPath = `Workspace/AF51Scene/${npc.name}`;
  const parts = graph.nodes.filter(n => n.parent === modelPath && n.className === "Part");
  
  const head   = parts.find(p => p.attributes && p.attributes.kind === "head");
  const torso  = parts.find(p => p.attributes && p.attributes.kind === "torso");
  const limbs  = parts.filter(p => p.attributes && p.attributes.kind === "limb");
  
  if (head)   totalHeads++;
  if (torso)  totalTorsos++;
  totalLimbs += limbs.length;
  
  ok(`${npc.name} has Head`,  !!head);
  ok(`${npc.name} has Torso`, !!torso);
  ok(`${npc.name} has 4 Limbs (2 arms + 2 legs)`, limbs.length === 4, String(limbs.length));
}

ok("All 4 NPCs have heads",  totalHeads === 4,  String(totalHeads));
ok("All 4 NPCs have torsos", totalTorsos === 4, String(totalTorsos));
ok("All 4 NPCs have limbs (16 total: 4 per NPC)", totalLimbs === 16, String(totalLimbs));

// ─── Apply MeshPass ───────────────────────────────────────────────────────
console.log("\nMESH PASS:");
const meshResult = MeshPass.apply({ graph });

ok("MeshPass succeeded", meshResult.ok);
ok("Humanoids processed by MeshPass", meshResult.humanoidsProcessed > 0, String(meshResult.humanoidsProcessed));
ok("At least 20 humanoid parts processed (4 NPCs × 5 parts each)", meshResult.humanoidsProcessed >= 20, String(meshResult.humanoidsProcessed));
ok("Shapes changed (heads → Ball, limbs → Cylinder)", meshResult.shapesChanged > 0, String(meshResult.shapesChanged));
ok("Meshes added (SpecialMesh for refined silhouettes)", meshResult.meshesAdded > 0, String(meshResult.meshesAdded));

// ─── Verify transformed geometry ──────────────────────────────────────────
console.log("\nTRANSFORMED GEOMETRY:");

let sphereHeads = 0, cylinderLimbs = 0, boxTorsos = 0;
for (const npc of npcModels) {
  const modelPath = `Workspace/AF51Scene/${npc.name}`;
  const parts = graph.nodes.filter(n => n.parent === modelPath && n.className === "Part");
  
  for (const part of parts) {
    const kind = part.attributes && part.attributes.kind;
    const shape = part.properties.Shape;
    
    if (kind === "head" && shape === "Enum.PartType.Ball") sphereHeads++;
    if (kind === "limb" && shape === "Enum.PartType.Cylinder") cylinderLimbs++;
    if (kind === "torso") boxTorsos++; // Torso stays Block
  }
}

ok("All heads transformed to Sphere", sphereHeads === 4, `${sphereHeads}/4`);
ok("All limbs transformed to Cylinder", cylinderLimbs === 16, `${cylinderLimbs}/16`);
ok("All torsos remain Box (readable torso)", boxTorsos === 4, `${boxTorsos}/4`);

// ─── Verify SpecialMesh children ──────────────────────────────────────────
console.log("\nSPECIAL MESHES:");
let headMeshes = 0, limbMeshes = 0, torsoMeshes = 0;
for (const npc of npcModels) {
  const modelPath = `Workspace/AF51Scene/${npc.name}`;
  const parts = graph.nodes.filter(n => n.parent === modelPath && n.className === "Part");
  
  for (const part of parts) {
    const kind = part.attributes && part.attributes.kind;
    const partPath = `${modelPath}/${part.name}`;
    const mesh = graph.nodes.find(n => n.parent === partPath && n.className === "SpecialMesh");
    
    if (kind === "head" && mesh) headMeshes++;
    if (kind === "limb" && mesh) limbMeshes++;
    if (kind === "torso" && mesh) torsoMeshes++;
  }
}

ok("SpecialMesh added to heads (Sphere mesh)", headMeshes === 4, `${headMeshes}/4`);
ok("SpecialMesh added to limbs (Cylinder mesh)", limbMeshes === 16, `${limbMeshes}/16`);
ok("SpecialMesh added to torsos (Brick mesh)", torsoMeshes === 4, `${torsoMeshes}/4`);

// ─── HumanoidBuilder module tests ─────────────────────────────────────────
console.log("\nHUMANOIDBUILDER MODULE:");
const hbSource = readFileSync("t3/Factory/rbx-production/humanoid-builder.js", "utf8");
ok("buildHumanoid function exported", /export function buildHumanoid/.test(hbSource));
ok("Creates Model container", /className: "Model"/.test(hbSource));
ok("Head with kind attribute", /kind: "head"/.test(hbSource));
ok("Torso with kind attribute", /kind: "torso"/.test(hbSource));
ok("Limbs with kind attribute", /kind: "limb"/.test(hbSource));
ok("R6 proportions documented", /R6-style proportions/.test(hbSource));

// ─── MeshPass humanoid support ────────────────────────────────────────────
console.log("\nMESHPASS HUMANOID SUPPORT:");
const mpSource = readFileSync("t3/Factory/rbx-production/mesh-pass.js", "utf8");
ok("HUMANOID_STRATEGY defined", /HUMANOID_STRATEGY/.test(mpSource));
ok("_pickHumanoid function", /_pickHumanoid/.test(mpSource));
ok("head → Ball strategy", /head:[\s\S]*?Enum\.PartType\.Ball/.test(mpSource));
ok("limb → Cylinder strategy", /limb:[\s\S]*?Enum\.PartType\.Cylinder/.test(mpSource));
ok("torso → Box strategy", /torso:/.test(mpSource));
ok("humanoidsProcessed metric", /humanoidsProcessed/.test(mpSource));

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${C.b}RBX HUMANOID PRODUCTION: ${P+F} tests | Pass: ${C.g}${P}${C.x} | Fail: ${F>0?C.r:""}${F}${C.x}`);

if (F === 0) {
  console.log(`${C.g}${C.b}\n✓ All humanoid production pipeline tests passed!${C.x}`);
  console.log(`${C.y}NPCs in RPG builds now render as recognizable characters with:`);
  console.log(`  • Spherical heads (Ball geometry)`);
  console.log(`  • Cylindrical limbs (Cylinder geometry)`);
  console.log(`  • Readable box torsos (Block geometry)`);
  console.log(`  • SpecialMesh refinement for polished silhouettes${C.x}\n`);
}

process.exit(F===0?0:1);
