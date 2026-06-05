// k1/alx/skills/security/LockdownSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class LockdownSkill {
  constructor(options = {}) {
    this.name = "lockdown";
    this.description = "Emergency lockdown";
    this.category = SKILL_CATEGORY.SECURITY;
    this.aliases = ["lukitse", "lock"];
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
    
    const command = ctx.intent?.params?._remaining?.[0];
    
    if (command === "off" || command === "unlock" || command === "avaa") {
      this._alx.unlock();
      return createSkillResult(true, {
        output: "🔓 ALX avattu."
      });
    }
    
    const reason = ctx.intent?.params?._remaining?.join(" ") || "Manual lockdown";
    this._alx.lock(reason);
    
    return createSkillResult(true, {
      output: `🔒 ALX lukittu.\nSyy: ${reason}\n\nAvaa komennolla: lockdown off`
    });
  }

  help() {
    return "Lukitse tai avaa ALX. Käyttö: lockdown [syy] | lockdown off";
  }
}

export function createLockdownSkill(options) {
  return new LockdownSkill(options);
}

export default LockdownSkill;