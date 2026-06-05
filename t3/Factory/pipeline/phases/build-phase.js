// t3/Factory/pipeline/phases/build-phase.js
// Build Phase - Compile/transform code

import { BasePhase } from "../base-phase.js";
import { PIPELINE_PHASE } from "../../core/factory-types.js";

export class BuildPhase extends BasePhase {
  constructor(options = {}) {
    super(PIPELINE_PHASE.BUILD, options);
    this._builderWorker = options.builderWorker || null;
  }

  canSkip(context) {
    return context.isIncrementalHit();
  }

  async execute(context) {
    const command = context.getCommand();
    const files = command.files || [];
    const manifest = context.getManifest();
    
    if (this._builderWorker) {
      const result = await this._builderWorker.build(files, manifest);
      context.setBuildOutput(result.output || files);
      return {
        built: true,
        outputCount: result.output?.length || files.length,
        workerUsed: true
      };
    }
    
    context.setBuildOutput(files);
    return {
      built: true,
      outputCount: files.length,
      workerUsed: false
    };
  }
}

export function createBuildPhase(options) {
  return new BuildPhase(options);
}

export default BuildPhase;