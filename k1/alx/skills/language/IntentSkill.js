// k1/alx/skills/language/IntentSkill.js

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { tokenize } from "../../utils/tokenizer.js";
import { IntentMatcher } from "../../core/IntentMatcher.js";

export class IntentSkill {
  constructor(options = {}) {
    this.name = "intent";
    this.description = "Parse and show intent from input";
    this.category = SKILL_CATEGORY.LANGUAGE;
    this.aliases = ["tarkoitus", "parse"];
    this._matcher = options.matcher || new IntentMatcher();
  }

  async execute(ctx) {
    const text = ctx.intent?.params?._remaining?.join(" ") || ctx.input;
    const tokens = tokenize(text);
    const intent = this._matcher.match(tokens);
    
    return createSkillResult(true, {
      output: `Syöte: "${text}"
Tokenit: ${tokens.join(", ")}

Intent: ${intent.name}
Luottamus: ${Math.round(intent.confidence * 100)}%
Kieli: ${intent.params?.language || "-"}
Parametrit: ${JSON.stringify(intent.params || {})}`,
      metadata: { tokens, intent }
    });
  }

  help() {
    return "Näytä tunnistettu intent. Käyttö: intent [teksti]";
  }
}

export function createIntentSkill(options) {
  return new IntentSkill(options);
}

export default IntentSkill;