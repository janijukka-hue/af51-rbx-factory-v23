// test-ui-bindings.mjs
// Verifies the view-binding layer obeys the rules:
//   - components read ONLY via useFactoryUI selectors (no raw pipeline/build result)
//   - each panel imports the selector it is supposed to use
//   - the data-flow contracts the panels rely on hold against a real snapshot

import { readFileSync } from "fs";
import { SceneGraph } from "./t3/Factory/rbx-production/scene-graph.js";
import { createUIObjectAdapter } from "./s4/oliot/ui/index.js";
import { RingRuntime } from "./ui/futureMachine/RingRuntime.js";

const C = { g: "\x1b[32m", r: "\x1b[31m", x: "\x1b[0m", b: "\x1b[1m" };
let P = 0, F = 0;
const ok = (n, c, d) => c ? (P++, console.log(`  ${C.g}✓${C.x} ${n}`))
                          : (F++, console.log(`  ${C.r}✗ ${n}${C.x}${d ? "  " + d : ""}`));

const DIR = "s4/components/factoryui/";
const read = (f) => readFileSync(DIR + f, "utf8");

console.log(`${C.b}UI bindings — static guards${C.x}\n`);

// Forbidden: reaching into raw production data inside a view component.
const FORBIDDEN = [
  /roblox-build-manager/, /createFromPipeline/, /new SceneGraph/,
  /scene-graph\.js/, /luau-generator/, /\.buildResult/, /rawResult/,
  /require\(.*pipeline/, /emitRbxlx/,
];

const panels = {
  "BuildConsolePanel.js": "selectBuildState",
  "ArtifactStatusPanel.js": "selectArtifact",
  "RingStatusPanel.js": "selectRings",
  "HierarchyPanel.js": "selectHierarchy",
  "InspectorPanel.js": "selectInspector",
  "ViewportPanel.js": "selectScene",
};

Object.keys(panels).forEach(function (file) {
  const src = read(file);
  const code = src.replace(/\/\/[^\n]*/g, ""); // ignore comments for code checks
  const noRaw = FORBIDDEN.every((re) => !re.test(code));
  ok(file + " has no raw pipeline access", noRaw);
  ok(file + " imports its selector (" + panels[file] + ")", src.includes(panels[file]));
  ok(file + " goes through useFactoryUI/AppContext",
    src.includes("useFactoryUI") || src.includes("useAppState"));
});

// Viewport must use the scene olio, not raw nodes from elsewhere. Strip
// comments first so a doc-comment mentioning "SceneGraph" doesn't false-fail.
const vpCode = read("ViewportPanel.js").replace(/\/\/[^\n]*/g, "");
ok("ViewportPanel renders SceneUIOlio nodes only",
  vpCode.includes("selectScene") && !/sceneGraph|SceneGraph/.test(vpCode));

// Hierarchy click must call select(id) from the hook.
ok("HierarchyPanel click calls select(id)",
  /factoryUI\.select|onSelect=\{factoryUI\.select\}/.test(read("HierarchyPanel.js")));

// Inspector must not own selected state (no useState for selection).
ok("InspectorPanel owns no selected state",
  !/useState/.test(read("InspectorPanel.js")));

// ── Contract: a real snapshot exposes every slice the panels read ─────────
console.log(`\n${C.b}UI bindings — snapshot contract${C.x}\n`);

const sg = new SceneGraph("obby");
sg.add({ className: "Part", name: "StartPad", parent: "Workspace/AF51Scene",
  properties: { Position: "Vector3.new(0,0.5,0)", Material: "Enum.Material.SmoothPlastic" }, tags: ["start"] });
sg.add({ className: "SpawnLocation", name: "Checkpoint1", parent: "Workspace/AF51Scene",
  properties: { Position: "Vector3.new(0,5,0)" }, tags: ["checkpoint"] });

const result = {
  ok: true, buildId: "b1", zipPath: "/x/AF51.zip", artifactHash: "1de1ad8c", ghostId: "g1",
  phases: [{ name: "STERILITY", ok: true }, { name: "RBXLX_EMIT", ok: true }],
  summary: { durationMs: 3300, phasesCompleted: 2, ghostId: "g1", artifactHash: "1de1ad8c" },
};
const ui = createUIObjectAdapter().createFromPipeline(result, { sceneGraph: sg, ringRuntime: new RingRuntime() });
const snap = ui.toJSON();

ok("BuildConsole reads buildState.{state,phases,progress}",
  snap.buildState.state === "OK" && Array.isArray(snap.buildState.phases) && typeof snap.buildState.progress === "number");
ok("ArtifactStatus reads artifact.{hash,zipPath,verified}",
  snap.artifact.hash === "1de1ad8c" && snap.artifact.zipPath === "/x/AF51.zip" && snap.artifact.verified === true);
ok("RingStatus reads all 7 rings",
  ["world","energy","memory","intent","factory","ghost","core"].every((k) => k in snap.rings));
ok("Hierarchy reads roots tree", Array.isArray(snap.hierarchy.roots) && snap.hierarchy.roots.length >= 1);
ok("Viewport reads scene.nodes + viewport.camera",
  Array.isArray(snap.scene.nodes) && snap.viewport && typeof snap.viewport.zoom === "number");

// selection → inspector through the tree
ui.selection.select(ui.scene.byType("SpawnLocation")[0].id);
const snap2 = ui.toJSON();
ok("Inspector reflects selection from the tree",
  snap2.inspector.selectedObject && snap2.inspector.selectedObject.type === "SpawnLocation");

console.log(`\n${C.b}UI BINDINGS: ${P + F} | Pass: ${C.g}${P}${C.x} | Fail: ${F > 0 ? C.r : ""}${F}${C.x}`);

// ════════════════════════════════════════════════════════════════════════
// Screen integration: JobDetailsScreen surfaces the panels to the user.
// ════════════════════════════════════════════════════════════════════════
console.log(`\n${C.b}Screen integration (JobDetailsScreen)${C.x}\n`);

const SCREEN = readFileSync("s4/screens/JobDetails/JobDetailsScreen.js", "utf8");
const screenCode = SCREEN.replace(/\/\/[^\n]*/g, ""); // ignore comments

ok("screen imports the six panels",
  ["BuildConsolePanel","ArtifactStatusPanel","RingStatusPanel","HierarchyPanel","InspectorPanel","ViewportPanel"]
    .every((p) => SCREEN.includes(p)));

ok("screen renders a Factory UI tab",
  /activeTab === "factoryui"/.test(screenCode) && /FactoryUITab/.test(screenCode));

ok("FactoryUITab composes all six panels",
  /<BuildConsolePanel/.test(screenCode) && /<ArtifactStatusPanel/.test(screenCode) &&
  /<RingStatusPanel/.test(screenCode) && /<HierarchyPanel/.test(screenCode) &&
  /<InspectorPanel/.test(screenCode) && /<ViewportPanel/.test(screenCode));

// The panels self-read the snapshot; the screen must NOT thread a raw build
// result into them. (The screen may still use job/artifact for the legacy tabs.)
ok("panels are not fed a raw build result as data prop",
  !/<BuildConsolePanel[^>]*\b(job|artifact|result|buildResult)=/.test(screenCode) &&
  !/<RingStatusPanel[^>]*\b(job|artifact|result)=/.test(screenCode) &&
  !/<HierarchyPanel[^>]*\b(job|artifact|result)=/.test(screenCode) &&
  !/<InspectorPanel[^>]*\b(job|artifact|result)=/.test(screenCode) &&
  !/<ViewportPanel[^>]*\b(job|artifact|result)=/.test(screenCode));

// The existing download/save/publish path must be preserved — ArtifactStatusPanel
// receives an onDownload callback rather than reimplementing download.
ok("artifact download reuses existing callback (onDownload)",
  /<ArtifactStatusPanel[^>]*onDownload=/.test(screenCode));

// Legacy tabs must still exist (we don't blindly remove working UI).
ok("legacy Overview/Logs/Output tabs preserved",
  /OverviewTab/.test(screenCode) && /LogsTab/.test(screenCode) && /OutputTab/.test(screenCode));

// ── v11: Factory UI is the default tab ───────────────────────────────────
ok("default active tab is Factory UI",
  /useState\(\s*["']factoryui["']\s*\)/.test(screenCode));
ok("not defaulting to overview anymore",
  !/useState\(\s*["']overview["']\s*\)/.test(screenCode));
ok("legacy tab ids still selectable",
  /setActiveTab\("overview"\)/.test(screenCode) &&
  /setActiveTab\("logs"\)/.test(screenCode) &&
  /setActiveTab\("output"\)/.test(screenCode));

console.log(`\n${C.b}UI BINDINGS TOTAL: ${P + F} | Pass: ${C.g}${P}${C.x} | Fail: ${F > 0 ? C.r : ""}${F}${C.x}`);
process.exit(F === 0 ? 0 : 1);
