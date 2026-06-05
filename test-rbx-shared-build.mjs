// test-rbx-shared-build.mjs — shared latestBuild state (Builder ⇄ Cockpit).
// Verifies the normalizer produces one canonical shape both views read, from a
// real /rbx/lua-build result. No React rendering needed — the contract is pure.

import { readFileSync } from "fs";
import { LuaProjectBuilder } from "./runtime/rbx-runtime/LuaProjectBuilder.js";
import { normalizeLuaBuild, failedBuild } from "./s4/state/latestBuild.js";

const C = { g:"\x1b[32m", r:"\x1b[31m", x:"\x1b[0m", b:"\x1b[1m" };
let P=0,F=0;
const ok=(n,c,d)=>c?(P++,console.log(`  ${C.g}✓${C.x} ${n}`)):(F++,console.log(`  ${C.r}✗ ${n}${C.x}${d?"  "+d:""}`));

console.log(`${C.b}Shared latestBuild state${C.x}\n`);

const src = readFileSync("/home/claude/af51-hero-character.lua","utf8");
const resp = await new LuaProjectBuilder().build(src,{projectName:"Shared",scriptName:"Main",exportsDir:"./exports-rbx"});
const lb = normalizeLuaBuild(src, resp);

// Canonical shape — every field the brief listed
const REQUIRED = ["source","status","errors","previewData","structures","enriched",
  "design","studio","shots","buildId","signature","artifactHash","zipName","downloadUrl","createdAt"];
ok("latestBuild has all required fields",
  REQUIRED.every(k => k in lb), REQUIRED.filter(k => !(k in lb)).join(",") || "all present");

ok("status ok on success", lb.status === "ok");
ok("source preserved", lb.source === src);
ok("previewData carried (center viewport)", !!lb.previewData);
ok("structures derived for hierarchy", Array.isArray(lb.structures) && lb.structures.length > 0);
ok("all four director outputs present",
  !!lb.enriched && !!lb.design && !!lb.studio && !!lb.shots);
ok("artifactHash is a string (not [object Object])",
  lb.artifactHash == null || typeof lb.artifactHash === "string", typeof lb.artifactHash);
ok("zipName present for export", !!lb.zipName, lb.zipName);
ok("createdAt timestamp set", typeof lb.createdAt === "number");

// Builder and Cockpit both call normalizeLuaBuild → identical shape (determinism)
const lb2 = normalizeLuaBuild(src, resp);
ok("same input → same shape (minus timestamp)",
  JSON.stringify({...lb, createdAt:0}) === JSON.stringify({...lb2, createdAt:0}));

// Failed build still yields a usable latestBuild (so UI shows the error)
const fb = failedBuild(src, "boom");
ok("failed build → status failed + error captured",
  fb.status === "failed" && fb.errors[0] === "boom" && fb.source === src);
ok("failed build has same keys (no undefined holes)",
  REQUIRED.every(k => k in fb));

// Export contract: a successful build exposes what export needs
ok("export uses downloadUrl or zipName", !!(lb.downloadUrl || lb.zipName));

// AppContext exposes the shared actions
const ctx = readFileSync("s4/state/AppContext.js","utf8");
ok("AppContext has SET_LATEST_BUILD action", /SET_LATEST_BUILD/.test(ctx));
ok("AppContext exposes setLatestBuild", /setLatestBuild/.test(ctx));
ok("latestBuild in initial state", /latestBuild:\s*null/.test(ctx));

// Both views import the shared pieces
const cockpit = readFileSync("s4/screens/Cockpit/RbxProductionCockpit.js","utf8");
const builder = readFileSync("ui/MasterRoomUI.js","utf8");
ok("Cockpit reads shared latestBuild", /appState\.latestBuild|useAppState/.test(cockpit));
ok("Cockpit writes latestBuild on RUN", /setLatestBuild/.test(cockpit));
ok("Builder publishes to latestBuild", /setLatestBuild/.test(builder));

console.log(`\n${C.b}SHARED BUILD: ${P+F} | Pass: ${C.g}${P}${C.x} | Fail: ${F>0?C.r:""}${F}${C.x}`);
process.exit(F===0?0:1);
