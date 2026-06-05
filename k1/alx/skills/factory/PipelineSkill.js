// k1/alx/skills/factory/PipelineSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class PipelineSkill {
  constructor(options = {}) {
    this.name = "pipeline";
    this.description = "Manage factory pipeline";
    this.category = SKILL_CATEGORY.FACTORY;
    this.aliases = ["pipe", "putki"];
    this._factory = options.factory || null;
  }

  setFactory(factory) {
    this._factory = factory;
  }

  async execute(ctx) {
    if (!this._factory) {
      return createSkillResult(false, {
        output: "Factory ei ole yhdistetty."
      });
    }
    
    const status = this._factory.getStatus?.() || {};
    const pipeline = this._factory.getPipeline?.()?.getStats?.() || {};
    
    let output = `Pipeline Status:

Tila: ${status.state || "UNKNOWN"}
`;
    
    if (pipeline.phases) {
      output += `\nVaiheet:\n`;
      for (const phase of pipeline.phases) {
        output += `  • ${phase}\n`;
      }
    }
    
    if (status.memory?.queue) {
      output += `\nJono:
  Odottaa: ${status.memory.queue.queued || 0}
  Käynnissä: ${status.memory.queue.running || 0}`;
    }
    
    return createSkillResult(true, {
      output,
      metadata: { status, pipeline }
    });
  }

  help() {
    return "Näytä pipeline-tila. Käyttö: pipeline";
  }
}

export function createPipelineSkill(options) {
  return new PipelineSkill(options);
}

export default PipelineSkill;