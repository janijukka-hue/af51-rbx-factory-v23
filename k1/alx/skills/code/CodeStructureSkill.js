// k1/alx/skills/code/CodeStructureSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { extractCodeBlocks } from "../../utils/text.js";

export class CodeStructureSkill {
  constructor() {
    this.name = "code-structure";
    this.description = "Parse code structure";
    this.category = SKILL_CATEGORY.CODE;
    this.aliases = ["structure", "rakenne"];
  }

  async execute(ctx) {
    const codeBlocks = extractCodeBlocks(ctx.input);
    
    if (codeBlocks.length === 0) {
      return createSkillResult(false, {
        output: "Anna koodi ```koodilohkossa```."
      });
    }
    
    const code = codeBlocks[0].code;
    const structure = this._parseStructure(code);
    
    let output = "Koodin rakenne:\n\n";
    
    if (structure.imports.length > 0) {
      output += `IMPORTS (${structure.imports.length}):\n`;
      for (const imp of structure.imports) {
        output += `  • ${imp.what} from "${imp.from}"\n`;
      }
      output += "\n";
    }
    
    if (structure.exports.length > 0) {
      output += `EXPORTS (${structure.exports.length}):\n`;
      for (const exp of structure.exports) {
        output += `  • ${exp.name} (${exp.type})${exp.isDefault ? " [default]" : ""}\n`;
      }
      output += "\n";
    }
    
    if (structure.classes.length > 0) {
      output += `CLASSES (${structure.classes.length}):\n`;
      for (const cls of structure.classes) {
        output += `  • ${cls.name}${cls.extends ? ` extends ${cls.extends}` : ""}\n`;
        for (const method of cls.methods) {
          output += `    - ${method}()\n`;
        }
      }
      output += "\n";
    }
    
    if (structure.functions.length > 0) {
      output += `FUNCTIONS (${structure.functions.length}):\n`;
      for (const fn of structure.functions) {
        output += `  • ${fn.name}(${fn.params.join(", ")})\n`;
      }
    }
    
    return createSkillResult(true, {
      output,
      metadata: { structure }
    });
  }

  _parseStructure(code) {
    const imports = [];
    const importRegex = /import\s+(?:(\{[^}]+\})|(\*\s+as\s+\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      imports.push({
        what: (match[1] || match[2] || match[3]).trim(),
        from: match[4]
      });
    }
    
    const exports = [];
    const exportRegex = /export\s+(default\s+)?(class|function|const|let|var)\s+(\w+)/g;
    
    while ((match = exportRegex.exec(code)) !== null) {
      exports.push({
        name: match[3],
        type: match[2],
        isDefault: !!match[1]
      });
    }
    
    const classes = [];
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    
    while ((match = classRegex.exec(code)) !== null) {
      const methodMatches = match[3].match(/(\w+)\s*\([^)]*\)\s*\{/g) || [];
      const methods = methodMatches.map(m => m.match(/(\w+)\s*\(/)[1]);
      
      classes.push({
        name: match[1],
        extends: match[2] || null,
        methods
      });
    }
    
    const functions = [];
    const funcRegex = /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g;
    
    while ((match = funcRegex.exec(code)) !== null) {
      functions.push({
        name: match[1],
        params: match[2].split(",").map(p => p.trim()).filter(Boolean)
      });
    }
    
    while ((match = arrowRegex.exec(code)) !== null) {
      functions.push({
        name: match[1],
        params: match[2].split(",").map(p => p.trim()).filter(Boolean)
      });
    }
    
    return { imports, exports, classes, functions };
  }

  help() {
    return "Näytä koodin rakenne. Käyttö: structure + ```koodi```";
  }
}

export function createCodeStructureSkill() {
  return new CodeStructureSkill();
}

export default CodeStructureSkill;