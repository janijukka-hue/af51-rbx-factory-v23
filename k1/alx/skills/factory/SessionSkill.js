// k1/alx/skills/factory/SessionSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class SessionSkill {
  constructor(options = {}) {
    this.name = "session";
    this.description = "Manage ALX sessions";
    this.category = SKILL_CATEGORY.FACTORY;
    this.aliases = ["sessio", "clear", "tyhjennä"];
    this._alx = options.alx || null;
  }

  setALX(alx) {
    this._alx = alx;
  }

  async execute(ctx) {
    const command = ctx.intent?.params?._remaining?.[0];
    
    if (command === "clear" || ctx.tokens.includes("clear") || ctx.tokens.includes("tyhjennä")) {
      return createSkillResult(true, {
        output: "Sessio nollattu.",
        metadata: { cleared: true }
      });
    }
    
    if (!this._alx) {
      return createSkillResult(false, {
        output: "ALX ei ole yhdistetty."
      });
    }
    
    const sessions = this._alx.getSessions?.();
    const stats = sessions?.getStats?.() || {};
    
    return createSkillResult(true, {
      output: `Sessiot:
Aktiivisia: ${stats.activeSessions || 0}
Max: ${stats.maxSessions || 0}
Timeout: ${stats.timeoutMs || 0}ms`
    });
  }

  help() {
    return "Hallitse sessioita. Käyttö: session [clear]";
  }
}

export function createSessionSkill(options) {
  return new SessionSkill(options);
}

export default SessionSkill;