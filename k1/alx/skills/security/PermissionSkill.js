// k1/alx/skills/security/PermissionSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { SKILL_PERMISSIONS } from "../../config/skills.config.js";

export class PermissionSkill {
  constructor() {
    this.name = "permission";
    this.description = "Check skill permissions";
    this.category = SKILL_CATEGORY.SECURITY;
    this.aliases = ["oikeudet", "perm"];
  }

  async execute(ctx) {
    const skillName = ctx.intent?.params?._remaining?.[0];
    
    if (!skillName) {
      let output = "Oikeustasot:\n\n";
      
      for (const [level, skills] of Object.entries(SKILL_PERMISSIONS)) {
        output += `${level}:\n`;
        for (const skill of skills) {
          output += `  • ${skill}\n`;
        }
        output += "\n";
      }
      
      return createSkillResult(true, { output });
    }
    
    let foundLevel = null;
    for (const [level, skills] of Object.entries(SKILL_PERMISSIONS)) {
      if (skills.includes(skillName)) {
        foundLevel = level;
        break;
      }
    }
    
    if (foundLevel) {
      return createSkillResult(true, {
        output: `Skill "${skillName}" vaatii tason: ${foundLevel}`
      });
    }
    
    return createSkillResult(true, {
      output: `Skill "${skillName}" ei löytynyt oikeuslistasta.`
    });
  }

  help() {
    return "Tarkista skill-oikeudet. Käyttö: permission [skill]";
  }
}

export function createPermissionSkill() {
  return new PermissionSkill();
}

export default PermissionSkill;