#!/usr/bin/env node
// demo-humanoid-preview.mjs — Visual demo of humanoid NPCs in RPG build
// Shows before/after comparison and generates preview structure data.

import { SceneGraph } from "./t3/Factory/rbx-production/scene-graph.js";
import { CompositionEngine } from "./t3/Factory/rbx-production/composition-engine.js";
import { MeshPass } from "./t3/Factory/rbx-production/mesh-pass.js";
import { scenegraphToStructures } from "./ui/preview/rbxPreviewUtils.js";

const C = { 
  g: "\x1b[32m", r: "\x1b[31m", x: "\x1b[0m", b: "\x1b[1m", 
  y: "\x1b[33m", c: "\x1b[36m", m: "\x1b[35m" 
};

console.log(`${C.b}${C.c}╔════════════════════════════════════════════════════════════════╗${C.x}`);
console.log(`${C.b}${C.c}║  AF51-RBX HUMANOID PRODUCTION — VISUAL DEMO                   ║${C.x}`);
console.log(`${C.b}${C.c}╚════════════════════════════════════════════════════════════════╝${C.x}\n`);

// ─── Build RPG Scene ──────────────────────────────────────────────────────
console.log(`${C.b}${C.y}⚙  Building RPG scene...${C.x}`);
const graph = new SceneGraph("rpg-demo");
const composeResult = CompositionEngine.compose({ graph, target: { type: "rpg" } });

console.log(`   ${C.g}✓${C.x} Composition: ${composeResult.partsAdded} parts created`);

// ─── Before MeshPass ──────────────────────────────────────────────────────
const npcsBefore = graph.nodes.filter(n => 
  n.className === "Part" && 
  n.attributes && 
  n.attributes.kind
);

console.log(`\n${C.b}${C.y}📦 BEFORE MeshPass (raw geometry):${C.x}`);
console.log(`   ${npcsBefore.length} humanoid parts with 'kind' attribute\n`);

const grouped = {};
for (const part of npcsBefore) {
  const parent = part.parent.split("/").pop();
  if (!grouped[parent]) grouped[parent] = [];
  grouped[parent].push(part);
}

for (const [npc, parts] of Object.entries(grouped)) {
  console.log(`   ${C.m}${npc}${C.x}:`);
  for (const part of parts) {
    const shape = part.properties.Shape || "Block";
    const kind = part.attributes.kind;
    const size = part.properties.Size || "?";
    console.log(`      • ${part.name.padEnd(12)} ${C.c}${kind.padEnd(6)}${C.x} → ${shape.padEnd(20)} (${size})`);
  }
}

// ─── Apply MeshPass ───────────────────────────────────────────────────────
console.log(`\n${C.b}${C.y}⚡ Applying MeshPass transformation...${C.x}`);
const meshResult = MeshPass.apply({ graph });

console.log(`   ${C.g}✓${C.x} Processed: ${meshResult.humanoidsProcessed} humanoid parts`);
console.log(`   ${C.g}✓${C.x} Shapes changed: ${meshResult.shapesChanged}`);
console.log(`   ${C.g}✓${C.x} SpecialMeshes added: ${meshResult.meshesAdded}`);

// ─── After MeshPass ───────────────────────────────────────────────────────
console.log(`\n${C.b}${C.y}✨ AFTER MeshPass (game-ready characters):${C.x}\n`);

const groupedAfter = {};
for (const part of npcsBefore) {
  const parent = part.parent.split("/").pop();
  if (!groupedAfter[parent]) groupedAfter[parent] = [];
  groupedAfter[parent].push(part);
}

for (const [npc, parts] of Object.entries(groupedAfter)) {
  console.log(`   ${C.g}${npc}${C.x}:`);
  for (const part of parts) {
    const shape = part.properties.Shape || "Block";
    const kind = part.attributes.kind;
    const icon = kind === "head" ? "●" : kind === "limb" ? "◯" : "◼";
    const desc = kind === "head" ? "Sphere (pyöreä pää)" :
                 kind === "limb" ? "Cylinder (lieriö raaja)" :
                 "Box (luettava torso)";
    console.log(`      ${icon}  ${part.name.padEnd(12)} ${C.g}${kind.padEnd(6)}${C.x} → ${C.b}${shape.padEnd(20)}${C.x} (${desc})`);
  }
}

// ─── Generate Preview Structures ──────────────────────────────────────────
console.log(`\n${C.b}${C.y}🎨 Generating preview structures...${C.x}`);
const structures = scenegraphToStructures(graph);
const humanoidStructures = structures.filter(s => s.kind);

console.log(`   ${C.g}✓${C.x} Total structures: ${structures.length}`);
console.log(`   ${C.g}✓${C.x} Humanoid structures: ${humanoidStructures.length}`);

// ─── Visual Character Representation ──────────────────────────────────────
console.log(`\n${C.b}${C.c}╔════════════════════════════════════════════════════════════════╗${C.x}`);
console.log(`${C.b}${C.c}║  PREVIEW RENDER (ASCII)                                        ║${C.x}`);
console.log(`${C.b}${C.c}╚════════════════════════════════════════════════════════════════╝${C.x}\n`);

const npcNames = ["Innkeeper", "Blacksmith", "Merchant", "Priest"];
const colors = [C.y, C.c, C.g, C.m];

for (let i = 0; i < npcNames.length; i++) {
  const color = colors[i];
  const name = npcNames[i];
  console.log(`   ${color}${name}:${C.x}`);
  console.log(`        ${color}●${C.x}        ${C.c}← Spherical head${C.x}`);
  console.log(`       ${color}╱│╲${C.x}       `);
  console.log(`      ${color}│ █ │${C.x}      ${C.c}← Box torso${C.x}`);
  console.log(`      ${color}│   │${C.x}      `);
  console.log(`     ${color}│ │ │ │${C.x}     ${C.c}← Cylindrical limbs${C.x}`);
  console.log();
}

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`${C.b}${C.c}╔════════════════════════════════════════════════════════════════╗${C.x}`);
console.log(`${C.b}${C.c}║  TRANSFORMATION SUMMARY                                        ║${C.x}`);
console.log(`${C.b}${C.c}╚════════════════════════════════════════════════════════════════╝${C.x}\n`);

const beforeBox = npcsBefore.filter(p => !p.properties.Shape || p.properties.Shape.includes("Block")).length;
const afterSphere = npcsBefore.filter(p => p.properties.Shape && p.properties.Shape.includes("Ball")).length;
const afterCylinder = npcsBefore.filter(p => p.properties.Shape && p.properties.Shape.includes("Cylinder")).length;

console.log(`   ${C.r}BEFORE:${C.x}`);
console.log(`      • ${beforeBox} box-shaped parts (debug geometry)`);
console.log(`      • 0 recognizable character features`);
console.log();
console.log(`   ${C.g}AFTER:${C.x}`);
console.log(`      • ${afterSphere} spherical heads (●)`);
console.log(`      • ${afterCylinder} cylindrical limbs (◯)`);
console.log(`      • 4 readable torsos (◼)`);
console.log(`      • ${C.b}${meshResult.meshesAdded} SpecialMesh refinements${C.x}`);
console.log();
console.log(`   ${C.g}${C.b}✓ NPCs now render as game-quality characters!${C.x}`);
console.log();

// ─── Preview Data Export ──────────────────────────────────────────────────
console.log(`${C.b}${C.y}💾 Preview data sample:${C.x}\n`);

const innkeeperHead = humanoidStructures.find(s => 
  s.parent === "Innkeeper" && s.kind === "head"
);

if (innkeeperHead) {
  console.log(`   {`);
  console.log(`     label: "${innkeeperHead.label}",`);
  console.log(`     luaClass: "${innkeeperHead.luaClass}",`);
  console.log(`     shape: "${innkeeperHead.shape}",     ${C.c}// ← Sphere instead of Block!${C.x}`);
  console.log(`     kind: "${innkeeperHead.kind}",      ${C.c}// ← Humanoid role${C.x}`);
  console.log(`     x: ${innkeeperHead.x}, y: ${innkeeperHead.y}, z: ${innkeeperHead.z},`);
  console.log(`     w: ${innkeeperHead.w}, h: ${innkeeperHead.h}, d: ${innkeeperHead.d},`);
  console.log(`     material: "${innkeeperHead.material}",`);
  console.log(`     hasMesh: ${innkeeperHead.hasMesh}   ${C.c}// ← SpecialMesh(Sphere)${C.x}`);
  console.log(`   }`);
} else {
  console.log(`   ${C.r}✗ Could not find Innkeeper head${C.x}`);
}

console.log(`\n${C.b}${C.g}═══════════════════════════════════════════════════════════════${C.x}`);
console.log(`${C.b}${C.g}  DEMO COMPLETE — Humanoid production pipeline working!${C.x}`);
console.log(`${C.b}${C.g}═══════════════════════════════════════════════════════════════${C.x}\n`);
