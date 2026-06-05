// k1/alx/skills/core/EchoSkill.js
// Echo Skill - Echo input and handle greetings

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { RESPONSES, VOCABULARY } from "../../config/language.config.js";

export class EchoSkill {
  constructor(options = {}) {
    this.name = "echo";
    this.description = "Echo input or respond to greetings";
    this.category = SKILL_CATEGORY.CORE;
    this.aliases = ["toista", "sano"];
  }

  async execute(ctx) {
    const lang = ctx.intent?.params?.language || "fi";
    const tokens = ctx.tokens || [];
    
    if (this._isGreeting(tokens)) {
      return createSkillResult(true, {
        output: RESPONSES[lang]?.greeting || RESPONSES.fi.greeting
      });
    }
    
    if (this._isThanks(tokens)) {
      return createSkillResult(true, {
        output: RESPONSES[lang]?.thanks || RESPONSES.fi.thanks
      });
    }
    
    const remaining = ctx.intent?.params?._remaining;
    if (remaining && remaining.length > 0) {
      return createSkillResult(true, {
        output: remaining.join(" ")
      });
    }
    
    return createSkillResult(true, {
      output: ctx.input || "..."
    });
  }

  _isGreeting(tokens) {
    const greetings = [...VOCABULARY.greetings.fi, ...VOCABULARY.greetings.en];
    return tokens.some(t => greetings.includes(t));
  }

  _isThanks(tokens) {
    const thanks = [...VOCABULARY.thanks.fi, ...VOCABULARY.thanks.en];
    return tokens.some(t => thanks.includes(t));
  }

  help() {
    return "Toistaa syötteen tai vastaa tervehdyksiin. Käyttö: echo [teksti]";
  }
}

export function createEchoSkill(options) {
  return new EchoSkill(options);
}

export default EchoSkill;