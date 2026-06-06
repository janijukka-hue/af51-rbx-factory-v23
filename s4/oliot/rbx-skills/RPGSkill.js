// s4/oliot/rbx-skills/RPGSkill.js
// KERROS: S4 – Olio · Skill #8: RPG
// Version: 1.0.0
//
// RPGSkill: UNDERSTANDS RPG games, quests, NPCs, and dungeons.

import { SkillBase } from './SkillBase.js';

export class RPGSkill extends SkillBase {
  constructor() {
    super('RPGSkill', '1.0.0');
    this.registerCapability('rpg-analysis');
    this.registerCapability('quest-detection');
    this.registerCapability('npc-detection');
  }

  analyze(context) {
    this.validateContext(context);
    const nodes = (context.graph && context.graph.nodes) || [];

    return {
      kind: 'RPG_ANALYSIS',
      schemaVersion: '1.0.0',
      npcs: this._detectNPCs(nodes),
      quests: this._detectQuests(nodes),
      dungeons: this._detectDungeons(nodes),
      isRPG: this._isRPG(nodes),
    };
  }

  _detectNPCs(nodes) {
    const npcs = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('npc') || name.includes('vendor') || name.includes('quest');
    });
    return { count: npcs.length, detected: npcs.length > 0 };
  }

  _detectQuests(nodes) {
    const quests = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('quest') || name.includes('objective');
    });
    return { count: quests.length, detected: quests.length > 0 };
  }

  _detectDungeons(nodes) {
    const dungeons = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('dungeon') || name.includes('boss') || name.includes('raid');
    });
    return { count: dungeons.length, detected: dungeons.length > 0 };
  }

  _isRPG(nodes) {
    const npcs = this._detectNPCs(nodes);
    const quests = this._detectQuests(nodes);
    return npcs.detected || quests.detected;
  }
}

export default RPGSkill;
