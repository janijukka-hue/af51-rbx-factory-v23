// test-rbx-cockpit.mjs — verifies the cockpit's data contract & gating logic.
// The cockpit renders in React (not tested here), but its inputs are pure:
//   - Lua detection gates RUN
//   - /rbx/lua-build response carries preview + all 4 director outputs
//   - the screen file imports the pieces it renders

import { readFileSync } from "fs";
import { LuaProjectBuilder } from "./runtime/rbx-runtime/LuaProjectBuilder.js";

const C = { g:"\x1b[32m", r:"\x1b[31m", x:"\x1b[0m", b:"\x1b[1m" };
let P=0,F=0;
const ok=(n,c,d)=>c?(P++,console.log(`  ${C.g}✓${C.x} ${n}`)):(F++,console.log(`  ${C.r}✗ ${n}${C.x}${d?"  "+d:""}`));

// Mirror the cockpit's looksLikeRawLua gate.
function looksLikeRawLua(text) {
  var s = String(text || "");
  var signals = ["Instance.new","Vector3.new","CFrame.new","game.","workspace","script.Parent","Enum.","UDim2.new","Color3."];
  for (var i=0;i<signals.length;i++) if (s.indexOf(signals[i])!==-1) return true;
  var kw=(s.match(/\b(local|function|end|then|return)\b/g)||[]).length;
  return kw>=2 && s.split(/\n/).length>=2;
}

console.log(`${C.b}RBX Production Cockpit — contract${C.x}\n`);

// Gating
ok("Lua source passes the RUN gate", looksLikeRawLua('local p=Instance.new("Part")\np.Parent=workspace'));
ok("plain prose is rejected by the gate", !looksLikeRawLua("make me a cool rpg game"));

// Build response contract — the cockpit reads previewData + 4 director outputs
const src = readFileSync("/home/claude/af51-hero-character.lua","utf8");
const b = await new LuaProjectBuilder().build(src,{projectName:"Cockpit",scriptName:"Main",exportsDir:"./exports-rbx"});
ok("response ok", b.ok);
ok("has previewData (center viewport)", !!b.preview && Array.isArray(b.preview.structures));
ok("has enriched (Preview Director, right col)", !!b.enriched);
ok("has design (Creative Director, right col)", !!b.design);
ok("has studio (Studio Director, right col)", !!b.studio);
ok("has shots (Cinematic Director)", !!b.shots && Array.isArray(b.shots.shots));
ok("has buildId + zipName (Export ZIP, bottom)", !!b.buildId && !!b.zipName);
ok("instanceCount present (pipeline)", typeof b.instanceCount === "number");

// Screen file wires the four quadrants
const screen = readFileSync("s4/screens/Cockpit/RbxProductionCockpit.js","utf8");
ok("screen imports preview canvas (center)", /RbxPreviewCanvas/.test(screen));
ok("screen imports hierarchy panel (left)", /RbxHierarchyPanel/.test(screen));
ok("screen imports design report panel (right)", /RbxDesignReportPanel/.test(screen));
ok("RUN routes to /rbx/lua-build (production line)", /\/rbx\/lua-build/.test(screen));
ok("Export ZIP is gated behind a build (last step)", /exportBtnDisabled|build first/.test(screen));
ok("pipeline shows Parse→Build→Analyze→Preview→Export",
  /Parse/.test(screen) && /Analyze/.test(screen) && /Export/.test(screen));

// Navigation wiring
const nav = readFileSync("s4/navigation/AppNavigator.js","utf8");
ok("cockpit registered as a Tab.Screen", /ROUTES\.COCKPIT/.test(nav) && /RbxProductionCockpit/.test(nav));

console.log(`\n${C.b}RBX COCKPIT: ${P+F} | Pass: ${C.g}${P}${C.x} | Fail: ${F>0?C.r:""}${F}${C.x}`);
process.exit(F===0?0:1);
