// s4/oliot/rbx-directors/index.js
// KERROS: S4 – Olio · RBX Director Layer · Version 1.0.0
//
// Dual Preview Intelligence entry point. Given a parsed scene graph, runs the
// skill layer once, then both Directors over the result:
//
//   Scene Graph → skills → { enriched (technical), report (creative) }
//
// Neither Director generates, replaces, or adds content — they interpret and
// assess the parsed code only. See _directorBase.js for the evidence rule.

import { interpretGraph } from "../rbx-skills/index.js";
import { RbxPreviewDirector } from "./RbxPreviewDirector.js";
import { RbxCreativeDirector } from "./RbxCreativeDirector.js";
import { RbxStudioDirector } from "./RbxStudioDirector.js";
import { RbxCinematicDirector } from "./RbxCinematicDirector.js";

/**
 * Analyze a scene graph with full Director intelligence.
 * @param {object} graph - Scene graph { nodes: [...] }
 * @param {object} buildMeta - Build metadata { fileCount?, instanceCount? }
 */
export function analyzeScene(graph, buildMeta = {}) {
  const interpreted = interpretGraph(graph);
  const enriched = new RbxPreviewDirector().enrich(graph, interpreted);
  const report = new RbxCreativeDirector().assess(graph, interpreted);
  const studio = new RbxStudioDirector().assess(enriched, graph, buildMeta);
  const shots = new RbxCinematicDirector().plan(enriched, report, graph);
  return { interpreted, enriched, report, studio, shots };
}

export {
  RbxPreviewDirector, RbxCreativeDirector, RbxStudioDirector, RbxCinematicDirector,
};
export default {
  analyzeScene,
  RbxPreviewDirector, RbxCreativeDirector, RbxStudioDirector, RbxCinematicDirector,
};
