// s4/oliot/ui/UIObjectAdapter.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// UIObjectAdapter — kerroksen tärkein osa. Muuntaa pipeline-/build-datan
// UI-olioiksi. UI ei koskaan lue raakaa pipeline-tulosta suoraan; se lukee
// näitä olioita. Tämä erottaa renderöinnin tuotannosta.
//
//   const factoryUI = adapter.createFromPipeline(buildResult, { sceneGraph, ringRuntime });
//
// Tukee myös elävää käyttöä: updateBuildState(...) kun build etenee.

import { FactoryUIOlio }    from "./FactoryUIOlio.js";
import { BuildStateUIOlio } from "./BuildStateUIOlio.js";
import { SceneUIOlio }      from "./SceneUIOlio.js";
import { ViewportUIOlio }   from "./ViewportUIOlio.js";
import { HierarchyUIOlio }  from "./HierarchyUIOlio.js";
import { ArtifactUIOlio }   from "./ArtifactUIOlio.js";
import { RingStatusUIOlio } from "./RingStatusUIOlio.js";

function UIObjectAdapter() {}

// Map build result.phases ([{name, ok|status}]) → UI phase rows + progress.
UIObjectAdapter.prototype._buildState = function (result) {
  result = result || {};
  var phases = (result.phases || []).map(function (p) {
    // pipeline phases may be {name, ok} or {name, status}; normalize.
    var status = p.status || (p.ok === false ? "FAIL" : "OK");
    return { name: p.name || p.phase || "?", status: status };
  });
  var total = phases.length || (result.summary && result.summary.phasesCompleted) || 0;
  var done  = phases.filter(function (p) { return p.status === "OK"; }).length;
  var state;
  if (result.ok === true)       state = "OK";
  else if (result.ok === false) state = "FAIL";
  else                          state = "IDLE";
  var last = phases.length ? phases[phases.length - 1].name : null;
  return new BuildStateUIOlio({
    state: state,
    currentPhase: last,
    progress: total ? (done / total) * 100 : (state === "OK" ? 100 : 0),
    durationMs: (result.summary && result.summary.durationMs) || 0,
    phases: phases,
  });
};

// Map a SceneGraph (or its toJSON nodes) → SceneUIOlio nodes.
UIObjectAdapter.prototype._scene = function (sceneGraph) {
  if (!sceneGraph) return new SceneUIOlio();
  var raw = typeof sceneGraph.toJSON === "function" ? sceneGraph.toJSON().nodes
          : (sceneGraph.nodes || []);
  var nodes = raw.map(function (n) {
    var props = n.properties || {};
    var pos = null;
    if (props.Position && typeof props.Position === "string") {
      // "Vector3.new(0, 5, 0)" → {x,y,z}. Read only inside the parentheses so
      // the "3" in "Vector3" can't leak into the numbers.
      var inside = props.Position.slice(props.Position.indexOf("(") + 1);
      var m = inside.match(/-?\d+(?:\.\d+)?/g);
      if (m && m.length >= 3) pos = { x: +m[0], y: +m[1], z: +m[2] };
    }
    return {
      id: (n.parent && n.name) ? (n.parent + "/" + n.name) : (n.name || n.className),
      type: n.className,
      name: n.name,
      material: props.Material ? String(props.Material).replace("Enum.Material.", "") : null,
      position: pos,
      parent: n.parent || null,
      tags: n.tags || [],
    };
  });
  return new SceneUIOlio({ nodes: nodes });
};

UIObjectAdapter.prototype._artifact = function (result) {
  result = result || {};
  if (!result.zipPath && !result.outputZip) return new ArtifactUIOlio();
  var sum = result.summary || {};
  return new ArtifactUIOlio({
    artifactId: result.artifactHash || sum.artifactHash || null,
    zipPath: result.zipPath || result.outputZip || null,
    sizeBytes: result.sizeBytes || sum.sizeBytes || 0,
    hash: result.artifactHash || sum.artifactHash || null,
    ghostId: result.ghostId || sum.ghostId || null,
    createdAt: result.createdAt || Date.now(),
    verified: result.ok === true && !!(result.ghostId || sum.ghostId),
  });
};

// Main entry: pipeline result → fully populated FactoryUIOlio.
//   opts.sceneGraph   (optional) the t3 SceneGraph for scene/hierarchy
//   opts.ringRuntime  (optional) live RingRuntime for ring status
UIObjectAdapter.prototype.createFromPipeline = function (result, opts) {
  opts = opts || {};
  var scene = this._scene(opts.sceneGraph);
  var hierarchy = HierarchyUIOlio.fromNodes(scene.nodes);
  var rings = opts.ringRuntime
    ? RingStatusUIOlio.fromRuntime(opts.ringRuntime)
    : new RingStatusUIOlio();

  return new FactoryUIOlio({
    buildState: this._buildState(result),
    scene: scene,
    hierarchy: hierarchy,
    viewport: new ViewportUIOlio(opts.viewport),
    artifact: this._artifact(result),
    rings: rings,
  });
};

// Live update: refresh just the build-state olio on an existing FactoryUIOlio
// (e.g. as phases stream in) without rebuilding scene/hierarchy.
UIObjectAdapter.prototype.updateBuildState = function (factoryUI, partialResult) {
  if (!factoryUI) return factoryUI;
  factoryUI.buildState = this._buildState(partialResult);
  return factoryUI;
};

// Refresh ring status from a live runtime snapshot.
UIObjectAdapter.prototype.updateRings = function (factoryUI, ringRuntime) {
  if (!factoryUI) return factoryUI;
  factoryUI.rings = RingStatusUIOlio.fromRuntime(ringRuntime);
  return factoryUI;
};

export { UIObjectAdapter };
export function createUIObjectAdapter() { return new UIObjectAdapter(); }
