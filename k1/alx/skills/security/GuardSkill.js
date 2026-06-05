// k1/alx/skills/security/GuardSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { validateInput, BLOCKED_PATTERNS } from "../../config/security.config.js";

export class GuardSkill {
  constructor() {
    this.name = "guard";
    this.description = "Input validation and security check";
    this.category = SKILL_CATEGORY.SECURITY;
    this.aliases = ["vartija", "validate"];
  }

  async execute(ctx) {
    const textToCheck = ctx.intent?.params?._remaining?.join(" ") || ctx.input;
    const validation = validateInput(textToCheck);
    
    let output;
    
    if (validation.valid) {
      output = `✓ Syöte on turvallinen.

Tarkistettu:
- Pituus: ${textToCheck.length} merkkiä
- Blocked patterns: ${BLOCKED_PATTERNS.length} sääntöä`;
    } else {
      output = `⚠️ Syötteessä ongelmia:

`;
      for (const issue of validation.issues) {
        output += `• ${issue.code}`;
        if (issue.pattern) output += `: ${issue.pattern}`;
        if (issue.limit) output += ` (max ${issue.limit})`;
        output += "\n";
      }
    }
    
    return createSkillResult(true, {
      output,
      metadata: { validation }
    });
  }

  help() {
    return "Tarkista syötteen turvallisuus. Käyttö: guard [teksti]";
  }
}

export function createGuardSkill() {
  return new GuardSkill();
}

export default GuardSkill;