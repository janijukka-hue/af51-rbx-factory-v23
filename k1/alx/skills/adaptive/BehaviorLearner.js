// k1/alx/skills/adaptive/BehaviorLearner.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { TimingTracker, AnomalyDetector } from "../../utils/heuristics.js";

export class BehaviorLearner {
  constructor(options = {}) {
    this.name = "behavior-learn";
    this.description = "Learn user behavior patterns";
    this.category = SKILL_CATEGORY.ADAPTIVE;
    this.aliases = ["behavior", "käyttäytyminen"];
    
    this._timingTracker = new TimingTracker(50);
    this._anomalyDetector = new AnomalyDetector(30);
  }

  async execute(ctx) {
    const timingStats = this._timingTracker.getAllStats();
    const anomalyStats = this._anomalyDetector.getStats();
    
    let output = `Käyttäytymisanalyysi:

AJOITUKSET:
`;
    
    const timingEntries = Object.entries(timingStats);
    if (timingEntries.length === 0) {
      output += "  (ei vielä dataa)\n";
    } else {
      for (const [key, stats] of timingEntries) {
        output += `  • ${key}: avg ${stats.avg}ms (${stats.min}-${stats.max}ms)\n`;
      }
    }
    
    output += `
ANOMALIAT:
  Näytteitä: ${anomalyStats.count}
  Keskiarvo: ${anomalyStats.mean}
  Keskihajonta: ${anomalyStats.stdDev}
`;
    
    return createSkillResult(true, {
      output,
      metadata: { timingStats, anomalyStats }
    });
  }

  recordTiming(skill, durationMs) {
    this._timingTracker.record(skill, durationMs);
    this._anomalyDetector.observe(durationMs);
  }

  isAnomaly(durationMs) {
    return this._anomalyDetector.isAnomaly(durationMs);
  }

  help() {
    return "Näytä käyttäytymisanalyysi. Käyttö: behavior";
  }
}

export function createBehaviorLearner() {
  return new BehaviorLearner();
}

export default BehaviorLearner;