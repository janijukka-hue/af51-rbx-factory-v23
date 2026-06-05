// k1/alx/skills/adaptive/PatternLearner.js
// Heuristic pattern learning - NOT ML

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { FrequencyTracker, SequenceDetector } from "../../utils/heuristics.js";

export class PatternLearner {
  constructor(options = {}) {
    this.name = "pattern-learn";
    this.description = "Learn usage patterns (heuristic)";
    this.category = SKILL_CATEGORY.ADAPTIVE;
    this.aliases = ["patterns", "kaavat"];
    
    this._frequencyTracker = new FrequencyTracker(500);
    this._sequenceDetector = new SequenceDetector(5);
  }

  async execute(ctx) {
    const command = ctx.intent?.params?._remaining?.[0];
    
    if (command === "reset") {
      this._frequencyTracker = new FrequencyTracker(500);
      this._sequenceDetector = new SequenceDetector(5);
      return createSkillResult(true, {
        output: "Kaavat nollattu."
      });
    }
    
    const topCommands = this._frequencyTracker.getTop(10);
    const patterns = this._sequenceDetector.getPatterns(2);
    const prediction = this._sequenceDetector.predict();
    
    let output = `Opitut kaavat:

TOP KOMENNOT:
`;
    
    if (topCommands.length === 0) {
      output += "  (ei vielä dataa)\n";
    } else {
      for (const { key, count } of topCommands) {
        output += `  • ${key}: ${count}×\n`;
      }
    }
    
    output += `\nSEKVENSSIT:
`;
    
    if (patterns.length === 0) {
      output += "  (ei vielä kaavoja)\n";
    } else {
      for (const { pattern, count } of patterns.slice(0, 5)) {
        output += `  • ${pattern}: ${count}×\n`;
      }
    }
    
    if (prediction) {
      output += `\n💡 Ehdotus: ${prediction.next} (${Math.round(prediction.confidence * 100)}%)`;
    }
    
    return createSkillResult(true, {
      output,
      metadata: { topCommands, patterns, prediction }
    });
  }

  observe(intent) {
    this._frequencyTracker.track(intent);
    this._sequenceDetector.observe(intent);
  }

  help() {
    return "Näytä opitut käyttökaavat. Käyttö: patterns [reset]";
  }
}

export function createPatternLearner() {
  return new PatternLearner();
}

export default PatternLearner;