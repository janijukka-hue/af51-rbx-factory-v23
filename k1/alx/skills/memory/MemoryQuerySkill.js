// k1/alx/skills/memory/MemoryQuerySkill.js
// Memory Query Skill - Query ALX memory (CoreMemory)

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class MemoryQuerySkill {
  constructor(options) {
    if (!options) {
      options = {};
    }
    this.name = "memory-query";
    this.description = "Query ALX memory";
    this.category = SKILL_CATEGORY.MEMORY;
    this.aliases = ["memory", "muisti", "historia", "history"];
    this._alx = options.alx || null;
  }

  setALX(alx) {
    this._alx = alx;
  }

  async execute(ctx) {
    if (!this._alx) {
      return createSkillResult(false, { output: "ALX ei ole yhdistetty." });
    }
    
    var coreMemory = this._alx.getCoreMemory();
    
    if (!coreMemory) {
      return createSkillResult(false, { output: "CoreMemory ei ole yhdistetty." });
    }
    
    var query = ctx.intent && ctx.intent.params && ctx.intent.params._remaining 
      ? ctx.intent.params._remaining.join(" ") 
      : null;
    
    var entries;
    
    if (query) {
      entries = await coreMemory.query({ 
        store: "episodic",
        text: query, 
        limit: 20 
      });
    } else {
      entries = coreMemory.getRecent("episodic", 20);
    }
    
    var stats = coreMemory.getStats();
    var lang = ctx.intent && ctx.intent.params && ctx.intent.params.language 
      ? ctx.intent.params.language 
      : "fi";
    
    var output;
    
    if (lang === "fi") {
      output = "🧠 COREMEMORY\n";
      output += "═══════════════════════════════════\n\n";
      
      output += "📊 TILASTOT:\n";
      output += "   Episodic: " + stats.stores.episodic.count + "/" + stats.stores.episodic.limit + "\n";
      output += "   Semantic: " + stats.stores.semantic.count + "/" + stats.stores.semantic.limit + "\n";
      output += "   Procedural: " + stats.stores.procedural.count + "/" + stats.stores.procedural.limit + "\n";
      output += "   Kirjoituksia: " + stats.writeCount + "\n";
      output += "   Lukuja: " + stats.readCount + "\n\n";
      
      if (entries.length === 0) {
        output += "📝 Ei merkintöjä.\n";
      } else {
        output += "📝 VIIMEISIMMÄT (" + entries.length + "):\n";
        var recentEntries = entries.slice(-10);
        for (var i = 0; i < recentEntries.length; i++) {
          var e = recentEntries[i];
          var time = new Date(e.timestamp).toLocaleTimeString("fi-FI");
          var contentPreview = JSON.stringify(e.content).substring(0, 40);
          output += "   [" + time + "] " + (e.content.event || e.store) + "\n";
        }
      }
      
      output += "\n═══════════════════════════════════";
      
    } else {
      output = "🧠 COREMEMORY\n";
      output += "═══════════════════════════════════\n\n";
      
      output += "📊 STATISTICS:\n";
      output += "   Episodic: " + stats.stores.episodic.count + "/" + stats.stores.episodic.limit + "\n";
      output += "   Semantic: " + stats.stores.semantic.count + "/" + stats.stores.semantic.limit + "\n";
      output += "   Procedural: " + stats.stores.procedural.count + "/" + stats.stores.procedural.limit + "\n";
      output += "   Writes: " + stats.writeCount + "\n";
      output += "   Reads: " + stats.readCount + "\n\n";
      
      if (entries.length === 0) {
        output += "📝 No entries.\n";
      } else {
        output += "📝 RECENT (" + entries.length + "):\n";
        var recentEntriesEn = entries.slice(-10);
        for (var j = 0; j < recentEntriesEn.length; j++) {
          var entry = recentEntriesEn[j];
          var timeEn = new Date(entry.timestamp).toLocaleTimeString("en-US");
          output += "   [" + timeEn + "] " + (entry.content.event || entry.store) + "\n";
        }
      }
      
      output += "\n═══════════════════════════════════";
    }
    
    return createSkillResult(true, {
      output: output,
      metadata: { stats: stats, entryCount: entries.length }
    });
  }

  help() {
    return "Kysele CoreMemorya. Käyttö: memory [hakusana]";
  }
}

export function createMemoryQuerySkill(options) {
  return new MemoryQuerySkill(options);
}

export default MemoryQuerySkill;