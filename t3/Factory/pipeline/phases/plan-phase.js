// t3/Factory/pipeline/phases/plan-phase.js
// Plan Phase - Create build manifest

import { BasePhase } from "../base-phase.js";
import { PIPELINE_PHASE } from "../../core/factory-types.js";

export class PlanPhase extends BasePhase {
  constructor(options = {}) {
    super(PIPELINE_PHASE.PLAN, options);
  }

  canSkip(context) {
    return context.isIncrementalHit();
  }

  async execute(context) {
    const command = context.getCommand();
    const files = command.files || [];
    const metadata = command.metadata || {};
    
    const manifest = {
      projectName: metadata.projectName || "unnamed",
      projectKind: context.getPhaseResult(PIPELINE_PHASE.INTAKE)?.projectKind || "UNKNOWN",
      version: metadata.version || "0.0.1",
      target: metadata.target || "web",
      language: this._detectLanguage(files),
      entryPoint: this._detectEntryPoint(files),
      dependencies: [],
      targets: metadata.targets || ["web"],
      folderPlan: this._createFolderPlan(files),
      riskFlags: this._detectRiskFlags(files)
    };
    
    context.setManifest(manifest);
    
    return {
      manifest
    };
  }

  _detectLanguage(files) {
    const extensions = files.map((f) => (f.path || "").split(".").pop().toLowerCase());
    if (extensions.includes("ts") || extensions.includes("tsx")) return "typescript";
    if (extensions.includes("js") || extensions.includes("jsx")) return "javascript";
    return "unknown";
  }

  _detectEntryPoint(files) {
    const candidates = ["index.js", "main.js", "app.js", "App.js", "index.ts", "main.ts"];
    for (const candidate of candidates) {
      if (files.some((f) => f.path?.endsWith(candidate))) {
        return candidate;
      }
    }
    return files[0]?.path || "index.js";
  }

  _createFolderPlan(files) {
    return files.map((f) => ({
      file: f.path,
      reason: "source"
    }));
  }

  _detectRiskFlags(files) {
    const flags = [];
    for (const file of files) {
      const content = file.content || "";
      if (content.includes("eval(")) flags.push("EVAL_USAGE");
      if (content.includes("dangerouslySetInnerHTML")) flags.push("XSS_RISK");
      if (content.includes("process.env")) flags.push("ENV_ACCESS");
    }
    return [...new Set(flags)];
  }
}

export function createPlanPhase(options) {
  return new PlanPhase(options);
}

export default PlanPhase;