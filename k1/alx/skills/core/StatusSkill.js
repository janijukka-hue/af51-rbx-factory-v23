// k1/alx/skills/core/StatusSkill.js
// Status Skill - Show system status

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class StatusSkill {
  constructor(options = {}) {
    this.name = "status";
    this.description = "Show system status";
    this.category = SKILL_CATEGORY.CORE;
    this.aliases = ["tila", "info"];
    this._alx = options.alx || null;
    this._factory = options.factory || null;
  }

  setALX(alx) {
    this._alx = alx;
  }

  setFactory(factory) {
    this._factory = factory;
  }

  async execute(ctx) {
    const alxStatus = this._alx?.getStatus() || { state: "UNKNOWN" };
    const factoryStatus = this._factory?.getStatus?.() || { state: "NOT_CONNECTED" };
    
    const uptimeFormatted = this._formatUptime(alxStatus.uptimeMs || 0);
    
    let output = `ALX Status:
- Tila: ${alxStatus.state}
- Sessio: ${alxStatus.sessionId || "-"}
- Uptime: ${uptimeFormatted}
- Suoritukset: ${alxStatus.executionCount || 0}
- Virheet: ${alxStatus.errorCount || 0}
- Lukittu: ${alxStatus.locked ? "Kyllä" : "Ei"}

Skills:
- Rekisteröity: ${alxStatus.skills?.totalSkills || 0}
- Aliakset: ${alxStatus.skills?.totalAliases || 0}

Memory:
- Merkintöjä: ${alxStatus.memory?.count || 0}
- Kapasiteetti: ${alxStatus.memory?.capacity || 0}
- Käyttöaste: ${Math.round((alxStatus.memory?.utilization || 0) * 100)}%

Sessions:
- Aktiivisia: ${alxStatus.sessions?.activeSessions || 0}`;

    if (this._factory) {
      output += `

Factory:
- Tila: ${factoryStatus.state || "-"}
- Artifacts: ${factoryStatus.memory?.vault?.count || 0}`;
    }
    
    return createSkillResult(true, {
      output,
      metadata: { alxStatus, factoryStatus }
    });
  }

  _formatUptime(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  }

  help() {
    return "Näyttää järjestelmän tilan. Käyttö: status";
  }
}

export function createStatusSkill(options) {
  return new StatusSkill(options);
}

export default StatusSkill;