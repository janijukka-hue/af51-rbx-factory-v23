// k1/alx/skills/memory/MemoryExportSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class MemoryExportSkill {
  constructor(options = {}) {
    this.name = "memory-export";
    this.description = "Export memory data";
    this.category = SKILL_CATEGORY.MEMORY;
    this.aliases = ["export", "vie"];
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
    const exported = memory.export();
    
    const size = JSON.stringify(exported).length;
    const sizeKB = Math.round(size / 1024 * 10) / 10;
    
    return createSkillResult(true, {
      output: `Muisti viety.

Merkintöjä: ${exported.entries.length}
Koko: ${sizeKB} KB
Viety: ${new Date(exported.exportedAt).toLocaleString("fi-FI")}
Hash: ${exported.hashChain || "-"}

Data on metadata.exported -kentässä.`,
      metadata: { exported }
    });
  }

  help() {
    return "Vie muistidata. Käyttö: memory-export";
  }
}

export function createMemoryExportSkill(options) {
  return new MemoryExportSkill(options);
}

export default MemoryExportSkill;