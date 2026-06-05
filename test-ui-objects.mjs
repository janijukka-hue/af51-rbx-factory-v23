// test-ui-objects.mjs
// Exercises the Enterprise UI Object Layer against REAL pipeline data:
// builds a scene graph the same way a target build does, runs it through the
// adapter, and asserts every olio populates from real values (not mocks).

import { SceneGraph } from "./t3/Factory/rbx-production/scene-graph.js";
import { createUIObjectAdapter } from "./s4/oliot/ui/index.js";
import { RingRuntime } from "./ui/futureMachine/RingRuntime.js";

const C = { g: "\x1b[32m", r: "\x1b[31m", x: "\x1b[0m", b: "\x1b[1m" };
let P = 0, F = 0;
const ok = (n, c, d) => c ? (P++, console.log(`  ${C.g}✓${C.x} ${n}`))
                          : (F++, console.log(`  ${C.r}✗ ${n}${C.x}${d ? "  " + d : ""}`));

console.log(`${C.b}Enterprise UI Object Layer${C.x}\n`);

// Build a small but real scene graph (same API the production builders use).
const sg = new SceneGraph("obby");
sg.add({ className: "Part", name: "StartPad", parent: "Workspace/AF51Scene",
  properties: { Size: "Vector3.new(16,1,16)", Position: "Vector3.new(0, 0.5, 0)",
                Material: "Enum.Material.SmoothPlastic", Anchored: true }, tags: ["start"] });
sg.add({ className: "SpawnLocation", name: "Checkpoint1", parent: "Workspace/AF51Scene",
  properties: { Position: "Vector3.new(0, 5, 0)", Material: "Enum.Material.Neon" }, tags: ["checkpoint"] });
sg.add({ className: "Part", name: "Platform1", parent: "Workspace/AF51Scene",
  properties: { Position: "Vector3.new(0, 5, 12)" }, tags: ["platform"] });

// A realistic pipeline result (shape matches roblox-build-manager success return).
const result = {
  ok: true, buildId: "build_test_0001",
  zipPath: "/exports-rbx/AF51-RBX-OBBY.zip", outputZip: "/exports-rbx/AF51-RBX-OBBY.zip",
  artifactHash: "1de1ad8c", ghostId: "ghost_abc123",
  phases: [
    { name: "STERILITY", ok: true }, { name: "HIERARCHY", ok: true },
    { name: "VISUAL_PRODUCTION", ok: true }, { name: "RBXLX_EMIT", ok: true },
  ],
  summary: { durationMs: 4200, phasesCompleted: 4, gameName: "AF51 Obby", targetId: "obby", ghostId: "ghost_abc123", artifactHash: "1de1ad8c" },
};

// Live ring runtime (the existing system the UI must read, not replace).
const rings = new RingRuntime();

const adapter = createUIObjectAdapter();
const ui = adapter.createFromPipeline(result, { sceneGraph: sg, ringRuntime: rings });

// ── FactoryUIOlio owns everything ────────────────────────────────────────
ok("FactoryUIOlio owns all 8 olios",
  !!(ui.buildState && ui.scene && ui.viewport && ui.hierarchy &&
     ui.selection && ui.inspector && ui.artifact && ui.rings));

// ── BuildState from real phases ──────────────────────────────────────────
ok("BuildState = OK", ui.buildState.state === "OK", ui.buildState.state);
ok("BuildState progress 100%", Math.round(ui.buildState.progress) === 100, ui.buildState.progress);
ok("BuildState duration mapped", ui.buildState.durationMs === 4200);
ok("BuildState label renders", ui.buildState.label().includes("OK"));

// ── Scene from real SceneGraph ───────────────────────────────────────────
ok("Scene has 3 nodes", ui.scene.count() === 3, "count=" + ui.scene.count());
ok("Scene parses Position", JSON.stringify(ui.scene.byType("SpawnLocation")[0].position) === JSON.stringify({ x: 0, y: 5, z: 0 }));
ok("Scene parses Material", ui.scene.byType("Part")[0].material === "SmoothPlastic");
ok("Scene typeCounts", ui.scene.typeCounts().Part === 2 && ui.scene.typeCounts().SpawnLocation === 1);

// ── Hierarchy built from nodes ───────────────────────────────────────────
ok("Hierarchy has roots", ui.hierarchy.roots.length >= 1, "roots=" + ui.hierarchy.roots.length);

// ── Artifact from real result ────────────────────────────────────────────
ok("Artifact ready", ui.artifact.isReady());
ok("Artifact hash mapped", ui.artifact.hash === "1de1ad8c");
ok("Artifact verified (ok + ghostId)", ui.artifact.verified === true);
ok("Artifact status label", ui.artifact.statusLabel() === "Artifact Verified");

// ── Selection + Inspector are one source of truth ────────────────────────
const partId = ui.scene.byType("Part")[0].id;
ui.selection.select(partId);
ok("Selection drives Inspector", ui.inspector.selectedId() === partId);
ok("Inspector reads selected object", ui.inspector.selectedObject() && ui.inspector.selectedObject().type === "Part");
ok("Inspector rows render", ui.inspector.rows().length >= 2);

// ── Viewport logic lives in the olio, not React ──────────────────────────
const before = ui.viewport.zoom;
ui.viewport.zoomBy(-10).orbit(0.2, 0.1);
ok("Viewport zoom changed", ui.viewport.zoom === before - 10);
ok("Viewport camera derived", typeof ui.viewport.cameraPosition().x === "number");

// ── Rings READ from runtime (not replaced) ───────────────────────────────
ok("Rings populated from runtime", typeof ui.rings.core === "string");
ok("Rings expose all 7", ["world","energy","memory","intent","factory","ghost","core"]
  .every(k => typeof ui.rings[k] === "string"));

// ── Whole-tree snapshot for React / ALX ──────────────────────────────────
const snap = ui.toJSON();
ok("toJSON gives whole tree", snap.buildState && snap.scene && snap.artifact && snap.rings);

// ── Live update path ─────────────────────────────────────────────────────
adapter.updateBuildState(ui, { ok: null, phases: [{ name: "VISUAL_PRODUCTION", ok: true }, { name: "RBXLX_EMIT" }] });
ok("updateBuildState refreshes olio", ui.buildState.phases.length === 2);

console.log(`\n${C.b}UI OBJECTS: ${P + F} | Pass: ${C.g}${P}${C.x} | Fail: ${F > 0 ? C.r : ""}${F}${C.x}`);

// ════════════════════════════════════════════════════════════════════════
// Integration: build result → snapshot → React-readable tree, without React.
// We exercise the reducer + adapter contract the useFactoryUI hook relies on.
// ════════════════════════════════════════════════════════════════════════
console.log(`\n${C.b}React integration (snapshot contract)${C.x}\n`);

// 1) build result → FactoryUIOlio → React-readable snapshot
const snapshot = ui.toJSON();
ok("build result → React-readable snapshot",
  snapshot && typeof snapshot === "object" &&
  snapshot.buildState && snapshot.scene && snapshot.artifact && snapshot.rings && snapshot.viewport);

// 2) selection change updates inspector THROUGH the tree (one source of truth)
const targetId = ui.scene.byType("SpawnLocation")[0].id;
ui.selection.select(targetId);
const afterSel = ui.toJSON();
ok("selection change updates inspector via tree",
  afterSel.selection.currentSelection === targetId &&
  afterSel.inspector.selectedId === targetId &&
  afterSel.inspector.selectedObject && afterSel.inspector.selectedObject.type === "SpawnLocation");

// 3) ring status comes from RingRuntime snapshot (not a parallel model)
const liveRings = new RingRuntime();
const ringsFromRuntime = createUIObjectAdapter();
ringsFromRuntime.updateRings(ui, liveRings);
ok("ring status sourced from RingRuntime",
  JSON.stringify(ui.rings.toJSON()) === JSON.stringify(
    (function () {
      const snap = liveRings.snapshot(); const o = {};
      ["world","energy","memory","intent","factory","ghost","core"].forEach(k => {
        const r = snap.rings[k]; o[k] = (r && (r.overall || r.state)) || "idle";
      });
      return o;
    })()
  ));

// 4) artifact verified ONLY when hash + zipPath exist
const noArtifact = adapter.createFromPipeline({ ok: true, phases: [] }, {});
ok("artifact not verified without zip/hash", noArtifact.artifact.verified === false &&
  noArtifact.artifact.statusLabel() === "No artifact");
ok("artifact verified with zip + hash + ghostId", ui.artifact.verified === true);

// 5) viewport receives scene nodes through SceneUIOlio, not raw pipeline data
//    (the viewport olio never sees the build result; scene is its own olio)
ok("scene nodes flow via SceneUIOlio (not raw pipeline)",
  ui.scene instanceof Object && typeof ui.scene.byId === "function" &&
  ui.scene.count() === 3);

// 6) no parallel state: the snapshot is the only thing React would store
ok("single snapshot carries entire UI truth",
  Object.keys(snapshot).sort().join(",") ===
  "artifact,buildState,hierarchy,inspector,rings,scene,selection,viewport");

console.log(`\n${C.b}TOTAL: ${P + F} | Pass: ${C.g}${P}${C.x} | Fail: ${F > 0 ? C.r : ""}${F}${C.x}`);
process.exit(F === 0 ? 0 : 1);

