// runtime/rbx-runtime/LuaPasses.js
// AF51-RBX — Pass pipeline for the user-Lua factory.
//
// MODEL (adapted from rbx-production passes): process the parsed graph in
// ordered, named stages. CRITICAL DIFFERENCE from the procedural generator:
// these passes are READ-ONLY ANALYSIS. They annotate and measure — they do
// NOT add, remove, or invent objects. The user's Lua is the only source of
// truth. A pass may attach derived metadata (e.g. group classification,
// quality report) but never fabricates geometry.
//
// This keeps the "multi-pass" architecture benefit (clear stages, inspectable
// intermediate results) without any fake generation.

import { reportLuaQuality } from "./LuaQualityGate.js";

// Each pass: (ctx) => ctx.  ctx = { graph, annotations, report }
// Passes only WRITE to ctx.annotations / ctx.report — never to graph.nodes.

function classifyPass(ctx) {
  // Annotate each node with a hierarchy group (read-only — does not touch graph)
  var GUI = ["ScreenGui","Frame","TextLabel","TextButton","TextBox","ImageLabel","ImageButton","ScrollingFrame","SurfaceGui","BillboardGui"];
  ctx.annotations.groups = (ctx.graph.nodes || []).map(function (n) {
    var cls = n.className || "";
    var parent = String(n.parent || "").toLowerCase();
    if (GUI.indexOf(cls) !== -1) return "ui";
    if (parent.indexOf("player") !== -1 || parent.indexOf("gui") !== -1) return "ui";
    if (cls === "Script" || cls === "ModuleScript") return "server";
    if (!parent) return "unresolved";
    return "workspace";
  });
  return ctx;
}

function measurePass(ctx) {
  // Attach the quality report (measurement only)
  ctx.report = reportLuaQuality(ctx.graph);
  return ctx;
}

function runtimeFeaturePass(ctx) {
  // Detect runtime features in node properties / source (informational badges)
  // Note: we read className + property keys, not invent behavior.
  var features = {};
  (ctx.graph.nodes || []).forEach(function (n) {
    if (n.className === "PointLight" || n.className === "SpotLight") features.lighting = true;
    if (n.className === "ParticleEmitter" || n.className === "Fire" || n.className === "Smoke") features.effects = true;
    if (n.className === "SpawnLocation") features.spawn = true;
  });
  ctx.annotations.runtimeFeatures = Object.keys(features);
  return ctx;
}

var DEFAULT_PASSES = [
  { name: "classify", fn: classifyPass },
  { name: "measure", fn: measurePass },
  { name: "runtimeFeatures", fn: runtimeFeaturePass },
];

// Run all passes over a parsed graph. Returns enriched context.
// graph is NOT mutated; all output lands in ctx.annotations / ctx.report.
export function runLuaPasses(graph, passes) {
  var list = passes || DEFAULT_PASSES;
  var ctx = { graph: graph, annotations: {}, report: null, passLog: [] };
  for (var i = 0; i < list.length; i++) {
    try {
      ctx = list[i].fn(ctx) || ctx;
      ctx.passLog.push({ pass: list[i].name, ok: true });
    } catch (e) {
      ctx.passLog.push({ pass: list[i].name, ok: false, error: e.message });
    }
  }
  return ctx;
}

export { classifyPass, measurePass, runtimeFeaturePass, DEFAULT_PASSES };
export default { runLuaPasses };
