// k1/alx/skills/core/TimeSkill.js
// Time Skill - Show current time

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class TimeSkill {
  constructor(options = {}) {
    this.name = "time";
    this.description = "Show current time";
    this.category = SKILL_CATEGORY.CORE;
    this.aliases = ["aika", "kello"];
    this._clock = options.clock;
  }

  async execute(ctx) {
    const now = this._clock?.now() || Date.now();
    const date = new Date(now);
    
    const lang = ctx.intent?.params?.language || "fi";
    
    const formatted = date.toLocaleString(lang === "fi" ? "fi-FI" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    
    return createSkillResult(true, {
      output: formatted,
      metadata: { timestamp: now, iso: date.toISOString() }
    });
  }

  help() {
    return "Näyttää nykyisen ajan. Käyttö: time";
  }
}

export function createTimeSkill(options) {
  return new TimeSkill(options);
}

export default TimeSkill;