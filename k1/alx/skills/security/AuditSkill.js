// k1/alx/skills/security/AuditSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class AuditSkill {
  constructor(options = {}) {
    this.name = "audit";
    this.description = "View audit log";
    this.category = SKILL_CATEGORY.SECURITY;
    this.aliases = ["loki", "log"];
    this._alx = options.alx || null;
  }

  setALX(alx) {
    this._alx = alx;
  }

  async execute(ctx) {
    if (!this._alx) {
      return createSkillResult(false, {
        output: "ALX ei ole yhdistetty."
      });
    }
    
    const memory = this._alx.getMemory();
    const verification = memory.verify();
    const stats = memory.getStats();
    
    let output = `Audit Log:

Eheys: ${verification.valid ? "✓ OK" : "⚠️ RIKOTTU"}
${verification.errors.length > 0 ? `Virheitä: ${verification.errors.length}` : ""}

Statistiikka:
- Merkintöjä: ${stats.count}
- Kapasiteetti: ${stats.capacity}
- Hash chain: ${stats.hashChain || "-"}

Tyypit:
`;
    
    for (const [type, count] of Object.entries(stats.types || {})) {
      output += `  • ${type}: ${count}\n`;
    }
    
    return createSkillResult(true, {
      output,
      metadata: { verification, stats }
    });
  }

  help() {
    return "Näytä audit-loki ja tarkista eheys. Käyttö: audit";
  }
}

export function createAuditSkill(options) {
  return new AuditSkill(options);
}

export default AuditSkill;