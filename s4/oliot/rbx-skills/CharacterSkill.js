// s4/oliot/rbx-skills/CharacterSkill.js
// KERROS: S4 – Olio · Skill #5: Character
// Version: 1.0.0
//
// CharacterSkill: UNDERSTANDS humanoids, rigs, NPCs, and character structures.

import { SkillBase } from './SkillBase.js';

export class CharacterSkill extends SkillBase {
  constructor() {
    super('CharacterSkill', '1.0.0');
    this.registerCapability('character-analysis');
    this.registerCapability('humanoid-detection');
    this.registerCapability('rig-analysis');
  }

  analyze(context) {
    this.validateContext(context);
    const nodes = (context.graph && context.graph.nodes) || [];
    const semantic = context.semanticAnalysis || {};

    return {
      kind: 'CHARACTER_ANALYSIS',
      schemaVersion: '1.0.0',
      characters: this._analyzeCharacters(nodes, semantic),
      rigs: this._analyzeRigs(nodes),
      animations: this._detectAnimations(nodes),
      type: this._determineCharacterType(nodes),
    };
  }

  _analyzeCharacters(nodes, semantic) {
    const characters = semantic.characters || [];
    return characters.map(c => ({
      id: c.id,
      name: c.name,
      hasHumanoid: this._hasHumanoid(nodes, c),
      bodyParts: this._countBodyParts(nodes, c),
      accessories: this._countAccessories(nodes, c),
    }));
  }

  _analyzeRigs(nodes) {
    const humanoids = nodes.filter(n => n.className === 'Humanoid');
    return {
      count: humanoids.length,
      type: humanoids.length > 0 ? 'rigged' : 'static',
    };
  }

  _detectAnimations(nodes) {
    const animations = nodes.filter(n => n.className === 'Animation');
    return { count: animations.length, animated: animations.length > 0 };
  }

  _hasHumanoid(nodes, character) {
    return nodes.some(n => n.className === 'Humanoid' && n.parent === character.name);
  }

  _countBodyParts(nodes, character) {
    const parts = ['Head', 'Torso', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg'];
    let count = 0;
    parts.forEach(part => {
      if (nodes.some(n => (n.properties?.Name || '').includes(part))) count++;
    });
    return count;
  }

  _countAccessories(nodes, character) {
    const accessories = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('hat') || name.includes('accessory') || name.includes('tool');
    });
    return accessories.length;
  }

  _determineCharacterType(nodes) {
    if (nodes.some(n => n.className === 'Humanoid')) return 'humanoid';
    if (nodes.some(n => (n.properties?.Name || '').toLowerCase().includes('npc'))) return 'npc';
    return 'unknown';
  }
}

export default CharacterSkill;
