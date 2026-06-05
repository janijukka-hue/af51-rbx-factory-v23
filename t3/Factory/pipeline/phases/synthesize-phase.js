// t3/Factory/pipeline/phases/synthesize-phase.js
// KERROS: T3 – Tuotanto
// Pipeline-vaihe 3: soveltaa patch-setin workspaceen TemplatePhase:n jälkeen.
// Ei suorita komentoja. Ei Node-buildineja.

import { BasePhase }   from "../base-phase.js";
import { PatchEngine } from "../../../patch/PatchEngine.js";

var SYNTHESIZE_PHASE_NAME = "SYNTHESIZE";

export class SynthesizePhase extends BasePhase {

  constructor(options) {
    var opts = options || {};
    super(SYNTHESIZE_PHASE_NAME, opts);
    this._workspace = opts.workspace || null;
  }

  canSkip(context) {
    var patches = context.getCommand().patches || [];
    return patches.length === 0;
  }

  async execute(context) {
    var command = context.getCommand();
    var patches = command.patches || [];

    if (!this._workspace) throw new Error("SynthesizePhase: workspace ei ole asetettu");

    if (patches.length === 0) {
      return { applied: 0, failed: 0, skipped: true, message: "Ei patcheja — ohitetaan" };
    }

    // Snapshot ennen patchausta (rollback mahdollista)
    this._workspace.snapshot("before-synthesize");

    var engine = new PatchEngine({
      workspace: this._workspace,
      eventBus:  this._eventBus,
      debug:     this._config ? this._config.debug : false
    });

    var result = engine.applyAll(patches);

    if (!result.ok) {
      var failed = result.results
        .filter(function(r) { return !r.ok && !r.skipped; })
        .map(function(r)    { return r.type + ":" + r.path + " — " + r.error; })
        .join("; ");
      throw new Error("SynthesizePhase: Patcheja epäonnistui: " + failed);
    }

    context.setPhaseResult(SYNTHESIZE_PHASE_NAME, {
      applied:    result.applied,
      failed:     result.failed,
      patchCount: patches.length
    });

    return {
      applied:     result.applied,
      failed:      result.failed,
      patchCount:  patches.length,
      engineStats: engine.getStats()
    };
  }
}

export function createSynthesizePhase(options) {
  return new SynthesizePhase(options || {});
}

export default SynthesizePhase;