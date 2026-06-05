// t3/Factory/pipeline/phases/incremental-check-phase.js
// Incremental Check Phase - Skip if already built

import { BasePhase } from "../base-phase.js";
import { PIPELINE_PHASE } from "../../core/factory-types.js";
import { fnv1a32 } from "../../core/factory-utils.js";

export class IncrementalCheckPhase extends BasePhase {
  constructor(options = {}) {
    super(PIPELINE_PHASE.INCREMENTAL_CHECK, options);
    this._artifactVault = options.artifactVault || null;
  }

  canSkip(context) {
    return !this._artifactVault;
  }

  async execute(context) {
    const command = context.getCommand();
    const files = command.files || [];
    
    const checksum = this._computeChecksum(files);
    context.setChecksum(checksum);
    
    if (!this._artifactVault) {
      return {
        hit: false,
        checksum,
        reason: "No artifact vault"
      };
    }
    
    const existing = this._artifactVault.getByChecksum(checksum);
    
    if (existing) {
      context.setIncrementalHit(true, existing.id);
      return {
        hit: true,
        checksum,
        existingArtifactId: existing.id,
        existingVersion: existing.version
      };
    }
    
    return {
      hit: false,
      checksum
    };
  }

  _computeChecksum(files) {
    const sorted = [...files].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
    const combined = sorted.map((f) => `${f.path}:${f.content || ""}`).join("|");
    return fnv1a32(combined).toString(16).padStart(8, "0");
  }
}

export function createIncrementalCheckPhase(options) {
  return new IncrementalCheckPhase(options);
}

export default IncrementalCheckPhase;