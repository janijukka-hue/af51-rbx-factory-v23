// k1/alx/skills/memory/MemoryStatsSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class MemoryStatsSkill {
  constructor(options = {}) {
    this.name = "memory-stats";
    this.description = "Memory statistics";
    this.category = SKILL_CATEGORY.MEMORY;
    this.aliases = ["memstats"];
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
    const stats = memory.getStats();
    
    const utilizationBar = this._renderBar(stats.utilization, 20);
    
    let output = `Muistitilastot:

Käyttö: ${utilizationBar} ${Math.round(stats.utilization * 100)}%
Merkintöjä: ${stats.count} / ${stats.capacity}

Tyypit:
`;
    
    const sortedTypes = Object.entries(stats.types || {})
      .sort((a, b) => b[1] - a[1]);
    
    for (const [type, count] of sortedTypes) {
      const pct = Math.round((count / stats.count) * 100);
      output += `  ${type}: ${count} (${pct}%)\n`;
    }
    
    return createSkillResult(true, {
      output,
      metadata: { stats }
    });
  }

  _renderBar(ratio, width) {
    const filled = Math.round(ratio * width);
    const empty = width - filled;
    return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
  }

  help() {
    return "Näytä muistitilastot. Käyttö: memory-stats";
  }
}

export function createMemoryStatsSkill(options) {
  return new MemoryStatsSkill(options);
}

export default MemoryStatsSkill;