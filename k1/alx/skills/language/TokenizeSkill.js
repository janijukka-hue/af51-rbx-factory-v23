// k1/alx/skills/language/TokenizeSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { tokenize, tokenizeClean, stem, ngrams } from "../../utils/tokenizer.js";

export class TokenizeSkill {
  constructor() {
    this.name = "tokenize";
    this.description = "Tokenize input text";
    this.category = SKILL_CATEGORY.LANGUAGE;
    this.aliases = ["tokens", "tokenisoi"];
  }

  async execute(ctx) {
    const text = ctx.intent?.params?._remaining?.join(" ") || ctx.input;
    
    const tokens = tokenize(text);
    const clean = tokenizeClean(text);
    const stems = clean.map(t => stem(t));
    const bigrams = ngrams(clean, 2);
    
    return createSkillResult(true, {
      output: `Tokenit (${tokens.length}): ${tokens.join(", ")}
Puhdistetut (${clean.length}): ${clean.join(", ")}
Stemmatut: ${stems.join(", ")}
Bigrammit: ${bigrams.join(", ")}`,
      metadata: { tokens, clean, stems, bigrams }
    });
  }

  help() {
    return "Tokenisoi teksti. Käyttö: tokenize [teksti]";
  }
}

export function createTokenizeSkill() {
  return new TokenizeSkill();
}

export default TokenizeSkill;