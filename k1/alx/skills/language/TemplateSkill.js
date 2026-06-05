// k1/alx/skills/language/TemplateSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { RESPONSES } from "../../config/language.config.js";

export class TemplateSkill {
  constructor() {
    this.name = "template";
    this.description = "Template-based responses";
    this.category = SKILL_CATEGORY.LANGUAGE;
    this.aliases = ["vastaus", "response"];
    this._templates = new Map();
  }

  addTemplate(name, template) {
    this._templates.set(name, template);
  }

  async execute(ctx) {
    const templateName = ctx.intent?.params?._remaining?.[0];
    const lang = ctx.intent?.params?.language || "fi";
    
    if (!templateName) {
      const builtIn = Object.keys(RESPONSES[lang] || RESPONSES.fi);
      const custom = Array.from(this._templates.keys());
      
      return createSkillResult(true, {
        output: `Templaatit:
Sisäänrakennetut: ${builtIn.join(", ")}
Omat: ${custom.length > 0 ? custom.join(", ") : "-"}

Käyttö: template [nimi]`
      });
    }
    
    const customTemplate = this._templates.get(templateName);
    if (customTemplate) {
      return createSkillResult(true, { output: customTemplate });
    }
    
    const builtInTemplate = RESPONSES[lang]?.[templateName] || RESPONSES.fi?.[templateName];
    if (builtInTemplate) {
      return createSkillResult(true, { output: builtInTemplate });
    }
    
    return createSkillResult(false, {
      output: `Templaattia "${templateName}" ei löytynyt.`
    });
  }

  help() {
    return "Näytä templaattivastaus. Käyttö: template [nimi]";
  }
}

export function createTemplateSkill() {
  return new TemplateSkill();
}

export default TemplateSkill;