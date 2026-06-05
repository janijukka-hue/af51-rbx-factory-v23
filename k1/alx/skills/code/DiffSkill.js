// k1/alx/skills/code/DiffSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { extractCodeBlocks } from "../../utils/text.js";

export class DiffSkill {
  constructor() {
    this.name = "diff";
    this.description = "Compare two code blocks";
    this.category = SKILL_CATEGORY.CODE;
    this.aliases = ["vertaa", "compare"];
  }

  async execute(ctx) {
    const codeBlocks = extractCodeBlocks(ctx.input);
    
    if (codeBlocks.length < 2) {
      return createSkillResult(false, {
        output: "Anna kaksi koodilohkoa vertailtavaksi:\n```\nensimmäinen\n```\n```\ntoinen\n```"
      });
    }
    
    const lines1 = codeBlocks[0].code.split("\n");
    const lines2 = codeBlocks[1].code.split("\n");
    
    const diff = this._simpleDiff(lines1, lines2);
    
    let output = `Vertailu:

Lohko 1: ${lines1.length} riviä
Lohko 2: ${lines2.length} riviä

Muutokset:
`;
    
    if (diff.added === 0 && diff.removed === 0 && diff.modified === 0) {
      output += "✓ Identtiset";
    } else {
      output += `+ Lisätty: ${diff.added} riviä\n`;
      output += `- Poistettu: ${diff.removed} riviä\n`;
      output += `~ Muutettu: ${diff.modified} riviä\n`;
      output += `= Sama: ${diff.same} riviä\n`;
      
      if (diff.changes.length > 0) {
        output += "\nErot:\n";
        for (const change of diff.changes.slice(0, 20)) {
          output += `${change}\n`;
        }
        if (diff.changes.length > 20) {
          output += `... ja ${diff.changes.length - 20} muuta muutosta`;
        }
      }
    }
    
    return createSkillResult(true, {
      output,
      metadata: { diff }
    });
  }

  _simpleDiff(lines1, lines2) {
    const changes = [];
    let added = 0;
    let removed = 0;
    let modified = 0;
    let same = 0;
    
    const maxLen = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLen; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];
      
      if (line1 === undefined) {
        added++;
        changes.push(`+${i + 1}: ${line2}`);
      } else if (line2 === undefined) {
        removed++;
        changes.push(`-${i + 1}: ${line1}`);
      } else if (line1 !== line2) {
        modified++;
        changes.push(`~${i + 1}: "${line1.slice(0, 30)}" → "${line2.slice(0, 30)}"`);
      } else {
        same++;
      }
    }
    
    return { added, removed, modified, same, changes };
  }

  help() {
    return "Vertaa kahta koodilohkoa. Käyttö: diff + ```koodi1``` + ```koodi2```";
  }
}

export function createDiffSkill() {
  return new DiffSkill();
}

export default DiffSkill;