// t3/Factory/pipeline/phases/template-phase.js
// KERROS: T3 – Tuotanto
// Pipeline-vaihe 2: kopioi valittu template workspaceen.
// Ei suorita komentoja. Ei Node-buildineja.

import { BasePhase } from "../base-phase.js";

var TEMPLATE_PHASE_NAME = "TEMPLATE";

export class TemplatePhase extends BasePhase {

  constructor(options) {
    var opts = options || {};
    super(TEMPLATE_PHASE_NAME, opts);
    this._workspace  = opts.workspace  || null;
    this._templates  = opts.templates  || {};
  }

  canSkip(context) {
    return context.isIncrementalHit() && context.getPhaseResult(TEMPLATE_PHASE_NAME) != null;
  }

  async execute(context) {
    var command  = context.getCommand();
    var target   = command.target      || "expo-app";
    var name     = command.projectName || command.name || "MyProject";
    var features = command.features    || [];

    if (!this._workspace) throw new Error("TemplatePhase: workspace ei ole asetettu");

    var template = this._templates[target];
    if (!template) {
      throw new Error(
        "TemplatePhase: Tuntematon target '" + target + "'. " +
        "Saatavilla: " + (Object.keys(this._templates).join(", ") || "ei yhtään")
      );
    }

    var files = template.getFiles({ name: name, features: features, command: command });
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error("TemplatePhase: Template '" + target + "' ei palauttanut tiedostoja");
    }

    var writeResult = this._workspace.writeFiles(files);
    if (!writeResult.ok && writeResult.failed > 0) {
      var failedPaths = writeResult.errors.map(function(e) { return e.path; }).join(", ");
      throw new Error("TemplatePhase: Tiedostojen kirjoitus epäonnistui: " + failedPaths);
    }

    context.setNormalizedFiles(files);
    context.setPhaseResult(TEMPLATE_PHASE_NAME, {
      target:       target,
      fileCount:    files.length,
      writtenCount: writeResult.written,
      failedCount:  writeResult.failed
    });

    return {
      target:           target,
      templateVersion:  template.meta ? template.meta.version : "unknown",
      fileCount:        writeResult.written,
      failedCount:      writeResult.failed,
      files:            files.map(function(f) { return f.path; })
    };
  }
}

export function createTemplatePhase(options) {
  return new TemplatePhase(options || {});
}

export default TemplatePhase;