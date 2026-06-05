// k1/alx/skills/core/HelpSkill.js
// Help Skill - Show available commands

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { SKILL_DEFINITIONS } from "../../config/skills.config.js";

export class HelpSkill {
  constructor(options = {}) {
    this.name = "help";
    this.description = "Show available commands and help";
    this.category = SKILL_CATEGORY.CORE;
    this.aliases = ["apua", "ohje", "?"];
    this._alx = options.alx || null;
  }

  setALX(alx) {
    this._alx = alx;
  }

  async execute(ctx) {
    const topic = ctx.intent?.params?._remaining?.[0];
    
    if (topic) {
      return this._getTopicHelp(topic);
    }
    
    return this._getGeneralHelp(ctx);
  }

  _getGeneralHelp(ctx) {
    const lang = ctx.intent?.params?.language || "fi";
    
    let output;
    
    if (lang === "fi") {
      output = `ALX - Factory Intelligence v3.0

PERUSKOMENNOT:
- status / tila - Näytä järjestelmän tila
- help / apua - Tämä ohje
- echo [teksti] - Toista teksti

KOODI:
- analyze / analysoi + \`\`\`koodi\`\`\` - Analysoi koodi
- structure [tiedosto] - Koodin rakenne
- risk [koodi] - Riskianalyysi

FACTORY:
- build / rakenna - Rakenna projekti
- publish / julkaise - Julkaise
- pipeline - Pipeline-tila

MUISTI:
- memory / muisti - Muistin tila
- history - Komentohistoria

Kirjoita 'help [aihe]' saadaksesi lisätietoa.`;
    } else {
      output = `ALX - Factory Intelligence v3.0

BASIC COMMANDS:
- status - Show system status
- help - This help
- echo [text] - Echo text

CODE:
- analyze + \`\`\`code\`\`\` - Analyze code
- structure [file] - Code structure
- risk [code] - Risk analysis

FACTORY:
- build - Build project
- publish - Publish
- pipeline - Pipeline status

MEMORY:
- memory - Memory status
- history - Command history

Type 'help [topic]' for more information.`;
    }
    
    return createSkillResult(true, { output });
  }

  _getTopicHelp(topic) {
    const topics = {
      build: "BUILD - Rakenna projekti\n\nKäyttö: build [nimi]\nAliakset: rakenna\n\nRakentaa projektin Factory-pipelinen läpi.",
      analyze: "ANALYZE - Analysoi koodi\n\nKäyttö: analyze + ```koodi```\nAliakset: analysoi\n\nAnalysoi koodin rakenteen, kompleksisuuden ja riskit.",
      status: "STATUS - Järjestelmän tila\n\nKäyttö: status\nAliakset: tila\n\nNäyttää ALX:n ja Factoryn tilan.",
      memory: "MEMORY - Muistijärjestelmä\n\nKäyttö: memory [query]\nAliakset: muisti\n\nKysele ja hallitse ALX:n muistia."
    };
    
    const help = topics[topic.toLowerCase()];
    
    if (help) {
      return createSkillResult(true, { output: help });
    }
    
    return createSkillResult(true, {
      output: `Tuntematon aihe: ${topic}\n\nKokeile: help build, help analyze, help status, help memory`
    });
  }

  help() {
    return "Näyttää käytettävissä olevat komennot. Käyttö: help [aihe]";
  }
}

export function createHelpSkill(options) {
  return new HelpSkill(options);
}

export default HelpSkill;