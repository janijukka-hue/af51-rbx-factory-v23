// s4/oliot/rbx-skills/ExtendedAnalysisSkill.js
// KERROS: S4 – Olio · Extended Analysis Domain Skills
// Advanced game-type analysis

import { SkillBase } from './SkillBase.js';

// SimulatorSkill - Simulator game analysis
export class SimulatorSkill extends SkillBase {
  constructor() {
    super('SimulatorSkill', '1.0.0');
    this.registerCapability('simulator-analysis');
  }
  analyze(context) {
    const semantic = context.semanticAnalysis || {};
    const nodes = (context.graph && context.graph.nodes) || [];
    const hasClickDetector = nodes.some(n => n.className === 'ClickDetector');
    const hasTool = nodes.some(n => n.className === 'Tool');
    return {
      kind: 'SIMULATOR_ANALYSIS',
      isSimulator: semantic.intent === 'simulator' || (hasClickDetector && hasTool),
      clickDetectors: nodes.filter(n => n.className === 'ClickDetector').length,
      tools: nodes.filter(n => n.className === 'Tool').length
    };
  }
}

// FPSSkill - FPS game analysis
export class FPSSkill extends SkillBase {
  constructor() {
    super('FPSSkill', '1.0.0');
    this.registerCapability('fps-analysis');
  }
  analyze(context) {
    const semantic = context.semanticAnalysis || {};
    const nodes = (context.graph && context.graph.nodes) || [];
    const hasGun = nodes.some(n => (n.name || '').toLowerCase().includes('gun'));
    const hasWeapon = nodes.some(n => (n.name || '').toLowerCase().includes('weapon'));
    return {
      kind: 'FPS_ANALYSIS',
      isFPS: semantic.intent === 'fps' || hasGun || hasWeapon,
      weapons: nodes.filter(n => {
        const name = (n.name || '').toLowerCase();
        return name.includes('gun') || name.includes('weapon');
      }).length
    };
  }
}

// RacingSkill - Racing game analysis
export class RacingSkill extends SkillBase {
  constructor() {
    super('RacingSkill', '1.0.0');
    this.registerCapability('racing-analysis');
  }
  analyze(context) {
    const semantic = context.semanticAnalysis || {};
    const vehicle = context.vehicleAnalysis || {};
    const isRacing = semantic.intent === 'racing' || vehicle.type === 'racing';
    return {
      kind: 'RACING_ANALYSIS',
      isRacing,
      vehicleType: vehicle.type || 'none'
    };
  }
}

// HorrorSkill - Horror game analysis
export class HorrorSkill extends SkillBase {
  constructor() {
    super('HorrorSkill', '1.0.0');
    this.registerCapability('horror-analysis');
  }
  analyze(context) {
    const semantic = context.semanticAnalysis || {};
    const nodes = (context.graph && context.graph.nodes) || [];
    const darkLighting = nodes.filter(n => n.className && n.className.includes('Light')).length < 2;
    return {
      kind: 'HORROR_ANALYSIS',
      isHorror: semantic.intent === 'horror',
      atmosphere: darkLighting ? 'dark' : 'bright'
    };
  }
}

// PvPSkill - PvP combat analysis
export class PvPSkill extends SkillBase {
  constructor() {
    super('PvPSkill', '1.0.0');
    this.registerCapability('pvp-analysis');
  }
  analyze(context) {
    const semantic = context.semanticAnalysis || {};
    const nodes = (context.graph && context.graph.nodes) || [];
    const hasSpawn = nodes.some(n => (n.name || '').toLowerCase().includes('spawn'));
    return {
      kind: 'PVP_ANALYSIS',
      isPvP: semantic.intent === 'pvp' || semantic.intent === 'fps',
      spawns: nodes.filter(n => (n.name || '').toLowerCase().includes('spawn')).length
    };
  }
}

// SurvivalSkill - Survival game analysis
export class SurvivalSkill extends SkillBase {
  constructor() {
    super('SurvivalSkill', '1.0.0');
    this.registerCapability('survival-analysis');
  }
  analyze(context) {
    const semantic = context.semanticAnalysis || {};
    return {
      kind: 'SURVIVAL_ANALYSIS',
      isSurvival: semantic.intent === 'survival'
    };
  }
}

// TowerDefenseSkill - Tower Defense analysis
export class TowerDefenseSkill extends SkillBase {
  constructor() {
    super('TowerDefenseSkill', '1.0.0');
    this.registerCapability('tower-defense-analysis');
  }
  analyze(context) {
    const semantic = context.semanticAnalysis || {};
    const nodes = (context.graph && context.graph.nodes) || [];
    const hasTower = nodes.some(n => (n.name || '').toLowerCase().includes('tower'));
    return {
      kind: 'TOWER_DEFENSE_ANALYSIS',
      isTowerDefense: semantic.intent === 'tower-defense' || hasTower,
      towers: nodes.filter(n => (n.name || '').toLowerCase().includes('tower')).length
    };
  }
}

// SocialSkill - Social hangout analysis
export class SocialSkill extends SkillBase {
  constructor() {
    super('SocialSkill', '1.0.0');
    this.registerCapability('social-analysis');
  }
  analyze(context) {
    const semantic = context.semanticAnalysis || {};
    const nodes = (context.graph && context.graph.nodes) || [];
    const hasSeating = nodes.some(n => n.className === 'Seat');
    return {
      kind: 'SOCIAL_ANALYSIS',
      isSocial: semantic.intent === 'social' || hasSeating,
      seats: nodes.filter(n => n.className === 'Seat').length
    };
  }
}

export default {
  SimulatorSkill,
  FPSSkill,
  RacingSkill,
  HorrorSkill,
  PvPSkill,
  SurvivalSkill,
  TowerDefenseSkill,
  SocialSkill
};
