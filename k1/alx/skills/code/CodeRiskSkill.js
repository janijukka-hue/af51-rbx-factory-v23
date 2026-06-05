// k1/alx/skills/code/CodeRiskSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { extractCodeBlocks } from "../../utils/text.js";
import { calculateRisk } from "../../utils/scoring.js";

export class CodeRiskSkill {
  constructor() {
    this.name = "code-risk";
    this.description = "Assess code security risks";
    this.category = SKILL_CATEGORY.CODE;
    this.aliases = ["risk", "riski", "security"];
  }

  async execute(ctx) {
    const codeBlocks = extractCodeBlocks(ctx.input);
    
    if (codeBlocks.length === 0) {
      return createSkillResult(false, {
        output: "Anna koodi ```koodilohkossa```."
      });
    }
    
    const code = codeBlocks[0].code;
    const risk = calculateRisk(code);
    
    let output = `Riskianalyysi:

Taso: ${risk.level}
Pisteet: ${risk.score}

`;
    
    if (risk.findings.length === 0) {
      output += "✓ Ei löydöksiä - koodi vaikuttaa turvalliselta.";
    } else {
      output += `Löydökset (${risk.findings.length}):\n`;
      
      const sorted = [...risk.findings].sort((a, b) => b.severity - a.severity);
      
      for (const finding of sorted) {
        const icon = finding.severity >= 8 ? "🔴" : finding.severity >= 5 ? "🟡" : "🟢";
        output += `${icon} ${finding.name} (×${finding.count}) - vakavuus: ${finding.severity}/10\n`;
      }
    }
    
    return createSkillResult(true, {
      output,
      metadata: { risk }
    });
  }

  help() {
    return "Arvioi koodin turvallisuusriskit. Käyttö: risk + ```koodi```";
  }
}

export function createCodeRiskSkill() {
  return new CodeRiskSkill();
}

export default CodeRiskSkill;