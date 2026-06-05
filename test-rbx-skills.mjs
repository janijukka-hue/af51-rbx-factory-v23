// test-rbx-skills.mjs — RBX Skill layer in isolation (no preview, no ZIP).
import { interpretNode, makeCtx } from "./s4/oliot/rbx-skills/index.js";

const C = { g:"\x1b[32m", r:"\x1b[31m", x:"\x1b[0m", b:"\x1b[1m" };
let P=0,F=0;
const ok=(n,c,d)=>c?(P++,console.log(`  ${C.g}✓${C.x} ${n}`)):(F++,console.log(`  ${C.r}✗ ${n}${C.x}${d?"  "+d:""}`));

function ctxOf(nodes){ return makeCtx(nodes); }
function node(o){ return Object.assign({ id:o.varName, properties:{} }, o); }

console.log(`${C.b}RBX Skill Layer — isolation${C.x}\n`);

// PartSkill
ok("Part.Shape=Ball → Ball", interpretNode(node({varName:"a",className:"Part",properties:{Shape:"Enum.PartType.Ball"}}),ctxOf([])).shape==="Ball");
ok("Part no shape → Block", interpretNode(node({varName:"b",className:"Part"}),ctxOf([])).shape==="Block");
ok("WedgePart → Wedge", interpretNode(node({varName:"w",className:"WedgePart"}),ctxOf([])).shape==="Wedge");

// MeshSkill — MeshPart + SpecialMesh child inheritance
const headPart = node({varName:"head",className:"Part",properties:{Name:"thing"}});
const sm = node({varName:"sm",className:"SpecialMesh",parentVar:"head",properties:{MeshType:"Enum.MeshType.Head"}});
let ctx = ctxOf([headPart, sm]);
ok("Part + SpecialMesh.Head → Ball", interpretNode(headPart,ctx).shape==="Ball");
ok("SpecialMesh node itself not drawable", interpretNode(sm,ctx).drawable===false);
ok("MeshPart → not Block (rounded)", interpretNode(node({varName:"m",className:"MeshPart"}),ctxOf([])).shape!=="Block");
const cylPart = node({varName:"cp",className:"Part"});
const cm = node({varName:"cm",className:"SpecialMesh",parentVar:"cp",properties:{MeshType:"Enum.MeshType.Cylinder"}});
ok("Part + SpecialMesh.Cylinder → Cylinder", interpretNode(cylPart,ctxOf([cylPart,cm])).shape==="Cylinder");

// HumanoidSkill
ok("part named Head → head/Ball", (()=>{ const r=interpretNode(node({varName:"h",className:"Part",properties:{Name:"Head"}}),ctxOf([])); return r.kind==="head"&&r.shape==="Ball"; })());
ok("part named LeftArm → limb/Cylinder", (()=>{ const r=interpretNode(node({varName:"la",className:"Part",properties:{Name:"LeftArm"}}),ctxOf([])); return r.kind==="limb"&&r.shape==="Cylinder"; })());
ok("Torso → Block", interpretNode(node({varName:"t",className:"Part",properties:{Name:"Torso"}}),ctxOf([])).shape==="Block");

// UISkill / ScriptSkill / HierarchySkill
ok("ScreenGui → ui, drawable", (()=>{ const r=interpretNode(node({varName:"g",className:"ScreenGui"}),ctxOf([])); return r.ui===true&&r.drawable===true; })());
ok("Script → not drawable, isScript", (()=>{ const r=interpretNode(node({varName:"s",className:"Script"}),ctxOf([])); return r.isScript===true&&r.drawable===false; })());
ok("Workspace → container, not drawable", interpretNode(node({varName:"ws",className:"Workspace"}),ctxOf([])).drawable===false);

// MaterialSkill / LightingSkill / EffectSkill
ok("Neon → glow", interpretNode(node({varName:"n",className:"Part",properties:{Material:"Enum.Material.Neon"}}),ctxOf([])).glow===true);
ok("Glass → transparency", interpretNode(node({varName:"gl",className:"Part",properties:{Material:"Glass"}}),ctxOf([])).transparency===0.5);
ok("PointLight → isLight, not box", (()=>{ const r=interpretNode(node({varName:"pl",className:"PointLight"}),ctxOf([])); return r.isLight===true&&r.shape==="Light"; })());
ok("ParticleEmitter → effect, not drawable", (()=>{ const r=interpretNode(node({varName:"pe",className:"ParticleEmitter"}),ctxOf([])); return r.isEffect===true&&r.drawable===false; })());

// TransformSkill
ok("Transform clamps absurd size", (()=>{ const r=interpretNode(node({varName:"tr",className:"Part",properties:{Size:[99999,1,1]}}),ctxOf([])); return r.sizeHint&&r.sizeHint[0]<=2048; })());

// SAFETY: a broken skill must not break interpretNode
ok("unknown class → safe empty-ish result (no throw)", (()=>{ try { const r=interpretNode(node({varName:"u",className:"TotallyUnknownClass"}),ctxOf([])); return typeof r==="object"; } catch(e){ return false; } })());
ok("null node → safe", (()=>{ try { return typeof interpretNode(null,ctxOf([]))==="object"; } catch(e){ return false; } })());

// Provenance present
ok("result carries _skills provenance", Array.isArray(interpretNode(node({varName:"p",className:"Part"}),ctxOf([]))._skills));

// ── Preview Director 2.0: role proportions + role colors ─────────────────
ok("Head emits role proportion + skin tint", (()=>{ const r=interpretNode(node({varName:"h",className:"Part",properties:{Name:"Head"}}),ctxOf([])); return r.roleProportion && r.roleProportion.w===1.4 && r.roleColor==="#FFD7AF"; })());
ok("Torso emits torso proportion + shirt tint", (()=>{ const r=interpretNode(node({varName:"t",className:"Part",properties:{Name:"Torso"}}),ctxOf([])); return r.roleProportion && r.roleProportion.h===2.0 && r.roleColor==="#4A90D9"; })());
ok("Leg gets darker (trouser) tint than Arm", (()=>{ const leg=interpretNode(node({varName:"l",className:"Part",properties:{Name:"LeftLeg"}}),ctxOf([])); const arm=interpretNode(node({varName:"a",className:"Part",properties:{Name:"LeftArm"}}),ctxOf([])); return leg.roleColor!==arm.roleColor; })());

console.log(`\n${C.b}RBX SKILLS: ${P+F} | Pass: ${C.g}${P}${C.x} | Fail: ${F>0?C.r:""}${F}${C.x}`);
process.exit(F===0?0:1);
