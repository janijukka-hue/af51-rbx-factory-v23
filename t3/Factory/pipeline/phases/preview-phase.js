// t3/Factory/pipeline/phases/preview-phase.js
// KERROS: T3 – Tuotanto
// Pipeline-vaihe: preview-marker. Web-era pipeline ei enää generoi previewtä —
// RBX preview tuotetaan runtime/rbx-runtime -ketjussa. Tämä vaihe on
// deterministinen pass-through joka merkitsee preview-valmiuden contextiin.

import { BasePhase }       from "../base-phase.js";
import { PIPELINE_PHASE }  from "../../core/factory-types.js";

var PREVIEW_PHASE_VERSION = "2.0.0";

export class PreviewPhase extends BasePhase {
  constructor(options) {
    var opts = options || {};
    super(PIPELINE_PHASE.PREVIEW, opts);
    this._previewWorker = opts.previewWorker || null;
  }

  canSkip(context) {
    return context.isIncrementalHit();
  }

  async execute(context) {
    // No-op preview marker for the web pipeline. Returns a stable result so the
    // pipeline can proceed to PACKAGE/PUBLISH. RBX preview is handled elsewhere.
    return {
      ok: true,
      phase: PIPELINE_PHASE.PREVIEW,
      version: PREVIEW_PHASE_VERSION,
      preview: { generated: false, reason: "rbx-preview-handled-by-runtime" },
    };
  }
}

export function createPreviewPhase(options) {
  return new PreviewPhase(options);
}

export default PreviewPhase;
