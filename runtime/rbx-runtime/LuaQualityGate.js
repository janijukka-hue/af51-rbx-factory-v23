// runtime/rbx-runtime/LuaQualityGate.js
// AF51-RBX — Quality measurement for a parsed user-Lua object graph.
//
// MODEL (adapted from rbx-production QualityGate): score the world the USER
// wrote. This is measurement + honest reporting ONLY. It NEVER adds geometry,
// never invents objects, never mutates the graph. It reads and reports.
//
// Pure function. Same graph in → same report out.

// Roblox class buckets for measurement
var GEOMETRY = ["Part","WedgePart","TrussPart","CornerWedgePart","MeshPart","UnionOperation","Model"];
var LIGHTS = ["PointLight","SpotLight","SurfaceLight"];
var GUI = ["ScreenGui","Frame","TextLabel","TextButton","TextBox","ImageLabel","ImageButton","ScrollingFrame","SurfaceGui","BillboardGui"];

export function measureLuaGraph(graph) {
  var nodes = (graph && graph.nodes) || [];

  var geometryCount = 0, lightCount = 0, guiCount = 0, spawnCount = 0;
  var materials = {}, shapes = {}, colors = {};

  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    var cls = n.className || "";
    var p = n.properties || {};

    if (GEOMETRY.indexOf(cls) !== -1) geometryCount++;
    if (LIGHTS.indexOf(cls) !== -1) lightCount++;
    if (GUI.indexOf(cls) !== -1) guiCount++;
    if (cls === "SpawnLocation") spawnCount++;

    if (p.Material) materials[p.Material] = (materials[p.Material] || 0) + 1;
    if (p.Shape) shapes[p.Shape] = (shapes[p.Shape] || 0) + 1;
    if (p.Color || p.BrickColor) {
      var col = p.Color || p.BrickColor;
      colors[col] = (colors[col] || 0) + 1;
    }
  }

  return {
    totalInstances: nodes.length,
    geometryCount: geometryCount,
    lightCount: lightCount,
    guiCount: guiCount,
    spawnCount: spawnCount,
    materialDiversity: Object.keys(materials).length,
    shapeDiversity: Object.keys(shapes).length,
    colorDiversity: Object.keys(colors).length,
    materials: materials,
    shapes: shapes,
  };
}

// Produce an honest report: what the user's Lua contains, plus non-blocking
// observations. NOTHING here changes the build — a low score still ships,
// because it's the USER's code. We inform, we don't gatekeep their world.
export function reportLuaQuality(graph) {
  var m = measureLuaGraph(graph);
  var notes = [];

  if (m.totalInstances === 0) notes.push("No Instance.new() objects found — nothing to preview or build.");
  if (m.geometryCount === 0 && m.totalInstances > 0) notes.push("No geometry (Part/Model) — world may appear empty in Workspace.");
  if (m.spawnCount === 0 && m.geometryCount > 0) notes.push("No SpawnLocation — players may spawn at origin.");
  if (m.lightCount === 0 && m.geometryCount > 3) notes.push("No lights — consider PointLight for visibility.");

  // Score is descriptive, not a gate. Reflects richness of the user's world.
  var score = 0;
  if (m.totalInstances > 0) score += 30;
  if (m.geometryCount > 0) score += 20;
  if (m.spawnCount > 0) score += 15;
  if (m.lightCount > 0) score += 10;
  if (m.materialDiversity >= 2) score += 10;
  if (m.shapeDiversity >= 2) score += 8;
  if (m.colorDiversity >= 2) score += 7;
  score = Math.min(100, score);

  return {
    score: score,
    metrics: m,
    notes: notes,
    blocking: false, // user's code always ships — this is informational
  };
}

export default { measureLuaGraph, reportLuaQuality };
