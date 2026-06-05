// test-rbx-3d-engine.mjs — RBX Real Preview Engine contract.
// Three.js runs in a browser iframe (not node), so we test the deterministic
// pieces: the structure→geometry mapping the engine doc encodes, the safety
// guardrails, and that the cockpit wires the 3D engine as default with the 2D
// canvas as fallback. Also proves the production line is untouched.

import { readFileSync } from "fs";
import { LuaProjectBuilder } from "./runtime/rbx-runtime/LuaProjectBuilder.js";

const C = { g:"\x1b[32m", r:"\x1b[31m", x:"\x1b[0m", b:"\x1b[1m" };
let P=0,F=0;
const ok=(n,c,d)=>c?(P++,console.log(`  ${C.g}✓${C.x} ${n}`)):(F++,console.log(`  ${C.r}✗ ${n}${C.x}${d?"  "+d:""}`));

// Mirror the engine's geometry decision (must match RbxRealPreviewEngine.geom).
function engineGeometry(s) {
  const kind = s.kind || "", shape = s.shape || "Block";
  if (kind === "head") return "Sphere";
  if (kind === "limb") return "Capsule";
  if (kind === "torso") return "Box";
  if (shape === "Ball" || shape === "Sphere") return "Sphere";
  if (shape === "Cylinder") return "Cylinder";
  if (shape === "Wedge") return "Wedge";
  return "Box";
}

console.log(`${C.b}RBX Real Preview Engine — contract${C.x}\n`);

const b = await new LuaProjectBuilder().build(readFileSync("/home/claude/af51-hero-character.lua","utf8"),{projectName:"H",scriptName:"Main",exportsDir:"./exports-rbx"});
const S = {}; (b.preview.structures||[]).forEach(s => S[s.label] = engineGeometry(s));

// Acceptance criteria from the brief
console.log("ACCEPTANCE — hero must not look like debug boxes:");
ok("Head → Sphere (pyöreä pää)", S.HEAD === "Sphere", S.HEAD);
ok("LeftArm → Capsule (rounded limb)", S.LEFTARM === "Capsule", S.LEFTARM);
ok("RightLeg → Capsule (rounded limb)", S.RIGHTLEG === "Capsule", S.RIGHTLEG);
ok("Torso → Box (readable torso)", S.TORSO === "Box", S.TORSO);
ok("CapCrown (cap) → Cylinder", S.CAPCROWN === "Cylinder", S.CAPCROWN);
ok("Eyes → Sphere", S.LEFTEYE === "Sphere" && S.RIGHTEYE === "Sphere");

// Engine source: required Three.js features present
const eng = readFileSync("ui/preview/RbxRealPreviewEngine.js","utf8");
console.log("\nENGINE FEATURES:");
ok("PerspectiveCamera", /PerspectiveCamera/.test(eng));
ok("orbit/fly/hero/character camera modes",
  /mode==="orbit"/.test(eng) && /mode==="fly"/.test(eng) && /mode==="hero"/.test(eng) && /mode==="character"/.test(eng));
ok("ambient + directional + point lights",
  /AmbientLight/.test(eng) && /DirectionalLight/.test(eng) && /PointLight/.test(eng));
ok("material mapping: Neon/Metal/Glass", /Neon/.test(eng) && /Metal/.test(eng) && /Glass/.test(eng));
ok("shape mapping: Sphere/Cylinder/Wedge/Box",
  /SphereGeometry/.test(eng) && /CylinderGeometry/.test(eng) && /Wedge/.test(eng) && /BoxGeometry/.test(eng));
ok("humanoid role: head/limb/torso geometry",
  /kind==="head"/.test(eng) && /kind==="limb"/.test(eng) && /kind==="torso"/.test(eng));
ok("shadows enabled (PCFSoftShadowMap)", /shadowMap\.enabled=true/.test(eng) && /PCFSoftShadowMap/.test(eng));
ok("selection highlight", /highlight/.test(eng) && /00ff8c/.test(eng));
ok("fit-to-bounds (Box3 / bounding sphere)", /Box3/.test(eng) && /getBoundingSphere/.test(eng));
ok("performance guardrail (MAX_PARTS)", /MAX_PARTS/.test(eng));
ok("capsule height guarded against negative", /Math\.max\(0\.1,h-2\*r\)/.test(eng));
ok("non-web falls back (not WebGL)", /Platform\.OS !== "web"/.test(eng));

// Cockpit wiring
const cockpit = readFileSync("s4/screens/Cockpit/RbxProductionCockpit.js","utf8");
console.log("\nCOCKPIT WIRING:");
ok("imports RbxRealPreviewEngine", /RbxRealPreviewEngine/.test(cockpit));
ok("3D engine is the default (view3d=true)", /useState\(true\)/.test(cockpit) && /view3d/.test(cockpit));
ok("2D canvas retained as fallback", /RbxPreviewCanvas/.test(cockpit));
ok("3D/2D toggle present", /setView3d/.test(cockpit));

// Production line untouched
console.log("\nPRODUCTION LINE UNTOUCHED:");
ok("build still ok", b.ok);
ok("instanceCount unchanged (14)", b.instanceCount === 14, String(b.instanceCount));
ok("ZIP still produced", !!b.zipName);

console.log(`\n${C.b}RBX 3D ENGINE: ${P+F} | Pass: ${C.g}${P}${C.x} | Fail: ${F>0?C.r:""}${F}${C.x}`);
process.exit(F===0?0:1);
