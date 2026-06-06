// s4/oliot/rbx-skills/GameplaySkill.js
// KERROS: S4 – Olio · Skill #13: Gameplay
// Version: 1.0.0
//
// GameplaySkill: UNDERSTANDS game objectives, progression, and playability.

import { SkillBase } from './SkillBase.js';

export class GameplaySkill extends SkillBase {
  constructor() {
    super('GameplaySkill', '1.0.0');
    this.registerCapability('gameplay-analysis');
    this.registerCapability('objective-detection');
    this.registerCapability('progression-analysis');
  }

  analyze(context) {
    this.validateContext(context);
    const nodes = (context.graph && context.graph.nodes) || [];
    const semantic = context.semanticAnalysis || {};

    return {
      kind: 'GAMEPLAY_ANALYSIS',
      schemaVersion: '1.0.0',
      objectives: this._detectObjectives(nodes),
      progression: this._analyzeProgression(nodes),
      mechanics: this._analyzeMechanics(nodes, semantic),
      playability: this._assessPlayability(nodes, semantic),
    };
  }

  _detectObjectives(nodes) {
    const spawns = nodes.filter(n => (n.properties?.Name || '').toLowerCase().includes('spawn'));
    const goals = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('goal') || name.includes('finish') || name.includes('win');
    });
    return {
      spawns: spawns.length,
      goals: goals.length,
      hasObjectives: spawns.length > 0 || goals.length > 0,
    };
  }

  _analyzeProgression(nodes) {
    const checkpoints = nodes.filter(n => (n.properties?.Name || '').toLowerCase().includes('checkpoint'));
    const levels = nodes.filter(n => (n.properties?.Name || '').toLowerCase().includes('level'));
    return {
      checkpoints: checkpoints.length,
      levels: levels.length,
      hasProgression: checkpoints.length > 1 || levels.length > 1,
    };
  }

  _analyzeMechanics(nodes, semantic) {
    const mechanics = [];
    if (semantic.intent === 'vehicle') mechanics.push('driving');
    if (semantic.intent === 'obby') mechanics.push('platforming');
    if (semantic.intent === 'tycoon') mechanics.push('economy');
    if (semantic.intent === 'rpg') mechanics.push('questing');
    if (nodes.some(n => (n.properties?.Name || '').toLowerCase().includes('weapon'))) {
      mechanics.push('combat');
    }
    return { count: mechanics.length, types: mechanics };
  }

  _assessPlayability(nodes, semantic) {
    const objectives = this._detectObjectives(nodes);
    const progression = this._analyzeProgression(nodes);
    const mechanics = this._analyzeMechanics(nodes, semantic);
    let score = 50;
    if (objectives.hasObjectives) score += 20;
    if (progression.hasProgression) score += 15;
    if (mechanics.count > 0) score += 15;
    return {
      score,
      level: score >= 80 ? 'highly-playable' : score >= 60 ? 'playable' : 'prototype',
      ready: score >= 60,
    };
  }
}

export default GameplaySkill;
