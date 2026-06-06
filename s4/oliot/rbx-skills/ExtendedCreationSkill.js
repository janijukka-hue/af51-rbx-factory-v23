// s4/oliot/rbx-skills/ExtendedCreationSkill.js
// KERROS: S4 – Olio · Extended Creation Domain Skills
// Advanced creation capabilities

import { SkillBase } from './SkillBase.js';

// LightingSkill - Lighting analysis
export class LightingSkill extends SkillBase {
  constructor() {
    super('LightingSkill', '1.0.0');
    this.registerCapability('lighting-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const lights = nodes.filter(n => n.className && n.className.includes('Light'));
    return {
      kind: 'LIGHTING_ANALYSIS',
      lights: lights.length,
      types: new Set(lights.map(l => l.className)).size,
      quality: lights.length > 3 ? 'rich' : lights.length > 0 ? 'basic' : 'ambient-only'
    };
  }
}

// SoundSkill - Sound and audio analysis
export class SoundSkill extends SkillBase {
  constructor() {
    super('SoundSkill', '1.0.0');
    this.registerCapability('sound-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const sounds = nodes.filter(n => n.className === 'Sound');
    return {
      kind: 'SOUND_ANALYSIS',
      sounds: sounds.length,
      hasAudio: sounds.length > 0
    };
  }
}

// EffectsSkill - Visual effects analysis
export class EffectsSkill extends SkillBase {
  constructor() {
    super('EffectsSkill', '1.0.0');
    this.registerCapability('effects-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const particles = nodes.filter(n => n.className === 'ParticleEmitter');
    const beams = nodes.filter(n => n.className === 'Beam');
    return {
      kind: 'EFFECTS_ANALYSIS',
      particles: particles.length,
      beams: beams.length,
      total: particles.length + beams.length,
      level: particles.length + beams.length > 5 ? 'rich' : 'minimal'
    };
  }
}

// TerrainSkill - Terrain analysis
export class TerrainSkill extends SkillBase {
  constructor() {
    super('TerrainSkill', '1.0.0');
    this.registerCapability('terrain-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const terrain = nodes.filter(n => n.className === 'Terrain');
    return {
      kind: 'TERRAIN_ANALYSIS',
      hasTerrain: terrain.length > 0,
      count: terrain.length
    };
  }
}

// UISkill - UI/UX analysis
export class UISkill extends SkillBase {
  constructor() {
    super('UISkill', '1.0.0');
    this.registerCapability('ui-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const screenGuis = nodes.filter(n => n.className === 'ScreenGui');
    const surfaceGuis = nodes.filter(n => n.className === 'SurfaceGui');
    const billboards = nodes.filter(n => n.className === 'BillboardGui');
    return {
      kind: 'UI_ANALYSIS',
      screenGuis: screenGuis.length,
      surfaceGuis: surfaceGuis.length,
      billboards: billboards.length,
      total: screenGuis.length + surfaceGuis.length + billboards.length,
      hasUI: screenGuis.length + surfaceGuis.length + billboards.length > 0
    };
  }
}

// AnimationSkill - Animation analysis
export class AnimationSkill extends SkillBase {
  constructor() {
    super('AnimationSkill', '1.0.0');
    this.registerCapability('animation-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const animations = nodes.filter(n => n.className === 'Animation');
    const animControllers = nodes.filter(n => n.className === 'AnimationController');
    return {
      kind: 'ANIMATION_ANALYSIS',
      animations: animations.length,
      controllers: animControllers.length,
      hasAnimation: animations.length > 0 || animControllers.length > 0
    };
  }
}

// PhysicsSkill - Physics analysis
export class PhysicsSkill extends SkillBase {
  constructor() {
    super('PhysicsSkill', '1.0.0');
    this.registerCapability('physics-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const anchored = nodes.filter(n => n.properties && n.properties.Anchored === true).length;
    const total = nodes.filter(n => n.className === 'Part' || n.className === 'MeshPart').length;
    return {
      kind: 'PHYSICS_ANALYSIS',
      anchored,
      unanchored: total - anchored,
      anchoredRatio: total > 0 ? anchored / total : 1,
      complexity: total - anchored > 50 ? 'high' : 'low'
    };
  }
}

// MaterialSkill - Material usage analysis
export class MaterialSkill2 extends SkillBase {
  constructor() {
    super('MaterialSkill2', '1.0.0');
    this.registerCapability('material-analysis-extended');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const materials = new Set();
    nodes.forEach(n => {
      if (n.properties && n.properties.Material) materials.add(n.properties.Material);
    });
    return {
      kind: 'MATERIAL_ANALYSIS',
      uniqueMaterials: materials.size,
      variety: materials.size > 5 ? 'rich' : materials.size > 2 ? 'moderate' : 'simple'
    };
  }
}

export default {
  LightingSkill,
  SoundSkill,
  EffectsSkill,
  TerrainSkill,
  UISkill,
  AnimationSkill,
  PhysicsSkill,
  MaterialSkill2
};
