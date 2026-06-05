// k1/alx/skills/code/DependencySkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { extractCodeBlocks } from "../../utils/text.js";

export class DependencySkill {
  constructor() {
    this.name = "dependency";
    this.description = "Analyze code dependencies";
    this.category = SKILL_CATEGORY.CODE;
    this.aliases = ["deps", "riippuvuudet"];
  }

  async execute(ctx) {
    const codeBlocks = extractCodeBlocks(ctx.input);
    
    if (codeBlocks.length === 0) {
      return createSkillResult(false, {
        output: "Anna koodi ```koodilohkossa```."
      });
    }
    
    const code = codeBlocks[0].code;
    const deps = this._analyzeDependencies(code);
    
    let output = `Riippuvuusanalyysi:

`;
    
    if (deps.external.length > 0) {
      output += `EXTERNAL (${deps.external.length}):\n`;
      for (const dep of deps.external) {
        output += `  • ${dep}\n`;
      }
      output += "\n";
    }
    
    if (deps.internal.length > 0) {
      output += `INTERNAL (${deps.internal.length}):\n`;
      for (const dep of deps.internal) {
        output += `  • ${dep}\n`;
      }
      output += "\n";
    }
    
    if (deps.nodeBuiltin.length > 0) {
      output += `NODE BUILT-IN (${deps.nodeBuiltin.length}):\n`;
      for (const dep of deps.nodeBuiltin) {
        output += `  • ${dep}\n`;
      }
      output += "\n";
    }
    
    if (deps.circular.length > 0) {
      output += `⚠️ MAHDOLLISET CIRCULAR (${deps.circular.length}):\n`;
      for (const dep of deps.circular) {
        output += `  • ${dep}\n`;
      }
    }
    
    output += `\nYhteensä: ${deps.total} riippuvuutta`;
    
    return createSkillResult(true, {
      output,
      metadata: { deps }
    });
  }

  _analyzeDependencies(code) {
    const external = [];
    const internal = [];
    const nodeBuiltin = [];
    const circular = [];
    
    const nodeModules = new Set([
      "fs", "path", "http", "https", "crypto", "os", "util",
      "stream", "events", "buffer", "url", "querystring", "child_process"
    ]);
    
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    let match;
    const allDeps = new Set();
    
    while ((match = importRegex.exec(code)) !== null) {
      allDeps.add(match[1]);
    }
    
    while ((match = requireRegex.exec(code)) !== null) {
      allDeps.add(match[1]);
    }
    
    for (const dep of allDeps) {
      if (dep.startsWith("./") || dep.startsWith("../")) {
        internal.push(dep);
        
        if (dep.includes("..") && dep.split("/").filter(p => p === "..").length > 2) {
          circular.push(dep);
        }
      } else if (nodeModules.has(dep) || dep.startsWith("node:")) {
        nodeBuiltin.push(dep);
      } else {
        external.push(dep);
      }
    }
    
    return {
      external: external.sort(),
      internal: internal.sort(),
      nodeBuiltin: nodeBuiltin.sort(),
      circular,
      total: allDeps.size
    };
  }

  help() {
    return "Analysoi koodin riippuvuudet. Käyttö: dependency + ```koodi```";
  }
}

export function createDependencySkill() {
  return new DependencySkill();
}

export default DependencySkill;