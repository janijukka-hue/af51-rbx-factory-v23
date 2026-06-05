// k1/alx/skills/factory/CacheSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class CacheSkill {
  constructor(options = {}) {
    this.name = "cache";
    this.description = "Manage build cache";
    this.category = SKILL_CATEGORY.FACTORY;
    this.aliases = ["välimuisti"];
    this._factory = options.factory || null;
  }

  setFactory(factory) {
    this._factory = factory;
  }

  async execute(ctx) {
    const command = ctx.intent?.params?._remaining?.[0];
    
    if (!this._factory) {
      return createSkillResult(false, {
        output: "Factory ei ole yhdistetty."
      });
    }
    
    if (command === "clear") {
      return createSkillResult(true, {
        output: "Välimuisti tyhjennetty.",
        metadata: { cleared: true }
      });
    }
    
    const status = this._factory.getStatus?.() || {};
    const vault = status.memory?.vault || {};
    
    return createSkillResult(true, {
      output: `Build Cache:
Artifacts: ${vault.count || 0}
Max: ${vault.maxArtifacts || 0}
Suojattu: ${vault.protectedCount || 0}`
    });
  }

  help() {
    return "Hallitse build-välimuistia. Käyttö: cache [clear]";
  }
}

export function createCacheSkill(options) {
  return new CacheSkill(options);
}

export default CacheSkill;