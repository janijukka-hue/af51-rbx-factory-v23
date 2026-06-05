// s4/oliot/ui/FactoryUIOlio.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// FactoryUIOlio — UI:n juuriolio. Omistaa kaikki UI-oliot ja toimii yhtenä
// tilana, jonka React-näkymät (ja myöhemmin ALX/AI Operator) lukevat.
// Rakennetaan UIObjectAdapterin kautta pipeline-tuloksesta.

import { BuildStateUIOlio } from "./BuildStateUIOlio.js";
import { SceneUIOlio }      from "./SceneUIOlio.js";
import { ViewportUIOlio }   from "./ViewportUIOlio.js";
import { HierarchyUIOlio }  from "./HierarchyUIOlio.js";
import { InspectorUIOlio }  from "./InspectorUIOlio.js";
import { ArtifactUIOlio }   from "./ArtifactUIOlio.js";
import { SelectionUIOlio }  from "./SelectionUIOlio.js";
import { RingStatusUIOlio } from "./RingStatusUIOlio.js";

function FactoryUIOlio(opts) {
  opts = opts || {};
  this.buildState = opts.buildState || new BuildStateUIOlio();
  this.scene      = opts.scene      || new SceneUIOlio();
  this.viewport   = opts.viewport   || new ViewportUIOlio();
  this.hierarchy  = opts.hierarchy  || new HierarchyUIOlio();
  this.selection  = opts.selection  || new SelectionUIOlio();
  this.artifact   = opts.artifact   || new ArtifactUIOlio();
  this.rings      = opts.rings      || new RingStatusUIOlio();
  // Inspector reads from scene + selection — bind them so it's one source.
  this.inspector  = opts.inspector  || new InspectorUIOlio();
  this.inspector.bind(this.scene, this.selection);
}

// Whole-tree snapshot — what a React view (or ALX) reads in one call.
FactoryUIOlio.prototype.toJSON = function () {
  return {
    buildState: this.buildState.toJSON(),
    scene:      this.scene.toJSON(),
    viewport:   this.viewport.toJSON(),
    hierarchy:  this.hierarchy.toJSON(),
    selection:  this.selection.toJSON(),
    inspector:  this.inspector.toJSON(),
    artifact:   this.artifact.toJSON(),
    rings:      this.rings.toJSON(),
  };
};

export { FactoryUIOlio };
export function createFactoryUIOlio(opts) { return new FactoryUIOlio(opts); }
