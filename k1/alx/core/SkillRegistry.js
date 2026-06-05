// k1/alx/core/SkillRegistry.js
// Skill Registry - Manages all ALX skills

import { SKILL_CATEGORY } from "./types.js";

export class SkillRegistry {
  constructor(options = {}) {
    this._clock = options.clock;
    this._skills = new Map();
    this._categories = new Map();
    this._aliases = new Map();
  }

  register(skill) {
    if (!skill || !skill.name) {
      throw new Error("Invalid skill: must have name");
    }
    
    if (!skill.execute || typeof skill.execute !== "function") {
      throw new Error(`Invalid skill ${skill.name}: must have execute function`);
    }
    
    this._skills.set(skill.name, skill);
    
    const category = skill.category || SKILL_CATEGORY.CORE;
    if (!this._categories.has(category)) {
      this._categories.set(category, new Set());
    }
    this._categories.get(category).add(skill.name);
    
    if (skill.aliases) {
      for (const alias of skill.aliases) {
        this._aliases.set(alias, skill.name);
      }
    }
    
    return { ok: true, skillName: skill.name };
  }

  unregister(name) {
    const skill = this._skills.get(name);
    if (!skill) return { ok: false, error: "Skill not found" };
    
    this._skills.delete(name);
    
    for (const [category, skills] of this._categories) {
      skills.delete(name);
    }
    
    for (const [alias, skillName] of this._aliases) {
      if (skillName === name) {
        this._aliases.delete(alias);
      }
    }
    
    return { ok: true };
  }

  get(name) {
    const resolved = this._aliases.get(name) || name;
    return this._skills.get(resolved) || null;
  }

  has(name) {
    const resolved = this._aliases.get(name) || name;
    return this._skills.has(resolved);
  }

  getByCategory(category) {
    const skillNames = this._categories.get(category);
    if (!skillNames) return [];
    
    return Array.from(skillNames).map(name => this._skills.get(name)).filter(Boolean);
  }

  getAll() {
    return Array.from(this._skills.values());
  }

  getAllNames() {
    return Array.from(this._skills.keys());
  }

  getCategories() {
    const result = {};
    for (const [category, skills] of this._categories) {
      result[category] = Array.from(skills);
    }
    return result;
  }

  getStats() {
    return {
      totalSkills: this._skills.size,
      totalAliases: this._aliases.size,
      categories: this.getCategories()
    };
  }
}

export function createSkillRegistry(options) {
  return new SkillRegistry(options);
}

export default SkillRegistry;