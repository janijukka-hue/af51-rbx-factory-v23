// k1/alx/skills/adaptive/ProfileBuilder.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

export class ProfileBuilder {
  constructor(options = {}) {
    this.name = "profile-build";
    this.description = "Build user profile from usage";
    this.category = SKILL_CATEGORY.ADAPTIVE;
    this.aliases = ["profile", "profiili"];
    
    this._profiles = new Map();
    this._maxProfiles = options.maxProfiles || 100;
  }

  async execute(ctx) {
    const userId = ctx.userId || "anonymous";
    const profile = this._profiles.get(userId) || this._createProfile(userId);
    
    let output = `Käyttäjäprofiili: ${userId}

Kieli: ${profile.preferredLanguage}
Komennot: ${profile.commandCount}
Sessioita: ${profile.sessionCount}
Skill-käyttö:
`;
    
    const sortedSkills = Object.entries(profile.skillUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    if (sortedSkills.length === 0) {
      output += "  (ei vielä dataa)\n";
    } else {
      for (const [skill, count] of sortedSkills) {
        output += `  • ${skill}: ${count}\n`;
      }
    }
    
    output += `\nAktiivisin aika: ${profile.activeHours.join(", ") || "-"}`;
    
    return createSkillResult(true, {
      output,
      metadata: { profile }
    });
  }

  _createProfile(userId) {
    const profile = {
      userId,
      createdAt: Date.now(),
      preferredLanguage: "fi",
      commandCount: 0,
      sessionCount: 1,
      skillUsage: {},
      activeHours: [],
      lastSeen: Date.now()
    };
    
    this._profiles.set(userId, profile);
    return profile;
  }

  update(userId, data) {
    let profile = this._profiles.get(userId);
    if (!profile) {
      profile = this._createProfile(userId);
    }
    
    profile.commandCount++;
    profile.lastSeen = Date.now();
    
    if (data.skill) {
      profile.skillUsage[data.skill] = (profile.skillUsage[data.skill] || 0) + 1;
    }
    
    if (data.language) {
      profile.preferredLanguage = data.language;
    }
    
    const hour = new Date().getHours();
    if (!profile.activeHours.includes(hour)) {
      profile.activeHours.push(hour);
      profile.activeHours.sort((a, b) => a - b);
    }
  }

  help() {
    return "Näytä käyttäjäprofiili. Käyttö: profile";
  }
}

export function createProfileBuilder(options) {
  return new ProfileBuilder(options);
}

export default ProfileBuilder;