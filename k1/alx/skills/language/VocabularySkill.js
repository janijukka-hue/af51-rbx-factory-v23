// k1/alx/skills/language/VocabularySkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { VOCABULARY, SYNONYMS } from "../../config/language.config.js";

export class VocabularySkill {
  constructor() {
    this.name = "vocabulary";
    this.description = "Vocabulary lookup and synonyms";
    this.category = SKILL_CATEGORY.LANGUAGE;
    this.aliases = ["sanasto", "synonym"];
  }

  async execute(ctx) {
    const word = ctx.intent?.params?._remaining?.[0];
    
    if (!word) {
      const categories = Object.keys(VOCABULARY);
      const synonymGroups = Object.keys(SYNONYMS);
      
      return createSkillResult(true, {
        output: `Sanasto:
Kategoriat: ${categories.join(", ")}
Synonyymiryhmiä: ${synonymGroups.length}

Käyttö: vocabulary [sana]`
      });
    }
    
    const lower = word.toLowerCase();
    const results = [];
    
    for (const [category, langs] of Object.entries(VOCABULARY)) {
      for (const [lang, words] of Object.entries(langs)) {
        if (words.includes(lower)) {
          results.push(`${category} (${lang}): ${words.join(", ")}`);
        }
      }
    }
    
    for (const [canonical, syns] of Object.entries(SYNONYMS)) {
      if (canonical === lower || syns.includes(lower)) {
        results.push(`Synonyymit [${canonical}]: ${syns.join(", ")}`);
      }
    }
    
    if (results.length === 0) {
      return createSkillResult(true, {
        output: `Sanaa "${word}" ei löytynyt sanastosta.`
      });
    }
    
    return createSkillResult(true, {
      output: `Sana: ${word}\n\n${results.join("\n")}`
    });
  }

  help() {
    return "Hae sanastosta ja synonyymeistä. Käyttö: vocabulary [sana]";
  }
}

export function createVocabularySkill() {
  return new VocabularySkill();
}

export default VocabularySkill;