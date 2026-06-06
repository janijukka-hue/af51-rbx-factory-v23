// s4/oliot/rbx-skills/ExtendedDesignSkill.js
// KERROS: S4 – Olio · Extended Design Domain Skills
// Advanced design and aesthetics

import { SkillBase } from './SkillBase.js';

// ColorSkill - Color scheme analysis
export class ColorSkill extends SkillBase {
  constructor() {
    super('ColorSkill', '1.0.0');
    this.registerCapability('color-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const colors = new Set();
    nodes.forEach(n => {
      if (n.properties && n.properties.Color) colors.add(JSON.stringify(n.properties.Color));
    });
    return {
      kind: 'COLOR_ANALYSIS',
      uniqueColors: colors.size,
      palette: colors.size > 10 ? 'rich' : colors.size > 5 ? 'varied' : 'limited'
    };
  }
}

// StyleSkill - Visual style analysis
export class StyleSkill extends SkillBase {
  constructor() {
    super('StyleSkill', '1.0.0');
    this.registerCapability('style-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const meshes = nodes.filter(n => n.className === 'MeshPart').length;
    const parts = nodes.filter(n => n.className === 'Part').length;
    const style = meshes > parts ? 'detailed' : 'blocky';
    return {
      kind: 'STYLE_ANALYSIS',
      style,
      meshRatio: parts + meshes > 0 ? meshes / (parts + meshes) : 0
    };
  }
}

// ScaleSkill - Scale and proportion analysis
export class ScaleSkill extends SkillBase {
  constructor() {
    super('ScaleSkill', '1.0.0');
    this.registerCapability('scale-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const sizes = nodes.filter(n => n.properties && n.properties.Size).map(n => {
      const s = n.properties.Size;
      return Math.max(s.X || 0, s.Y || 0, s.Z || 0);
    });
    const maxSize = Math.max(...sizes, 0);
    return {
      kind: 'SCALE_ANALYSIS',
      maxSize,
      scale: maxSize > 100 ? 'large' : maxSize > 20 ? 'medium' : 'small'
    };
  }
}

// ThemeSkill - Theme detection
export class ThemeSkill extends SkillBase {
  constructor() {
    super('ThemeSkill', '1.0.0');
    this.registerCapability('theme-detection');
  }
  analyze(context) {
    const semantic = context.semanticAnalysis || {};
    return {
      kind: 'THEME_ANALYSIS',
      theme: semantic.intent || 'generic'
    };
  }
}

// ConsistencySkill - Design consistency
export class ConsistencySkill extends SkillBase {
  constructor() {
    super('ConsistencySkill', '1.0.0');
    this.registerCapability('consistency-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const materials = new Set();
    nodes.forEach(n => {
      if (n.properties && n.properties.Material) materials.add(n.properties.Material);
    });
    return {
      kind: 'CONSISTENCY_ANALYSIS',
      materialVariety: materials.size,
      consistency: materials.size < 5 ? 'high' : materials.size < 10 ? 'medium' : 'varied'
    };
  }
}

// AestheticsSkill - Overall aesthetics
export class AestheticsSkill extends SkillBase {
  constructor() {
    super('AestheticsSkill', '1.0.0');
    this.registerCapability('aesthetics-evaluation');
  }
  analyze(context) {
    const composition = context.compositionAnalysis || {};
    const quality = context.qualityGate || {};
    return {
      kind: 'AESTHETICS_ANALYSIS',
      score: quality.scores?.overall || 50,
      hero: composition.hero || null,
      rating: quality.scores?.overall > 70 ? 'polished' : quality.scores?.overall > 50 ? 'good' : 'developing'
    };
  }
}

// ProportionSkill - Proportion analysis
export class ProportionSkill extends SkillBase {
  constructor() {
    super('ProportionSkill', '1.0.0');
    this.registerCapability('proportion-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const sizes = nodes.filter(n => n.properties && n.properties.Size).map(n => n.properties.Size);
    return {
      kind: 'PROPORTION_ANALYSIS',
      elements: sizes.length,
      proportional: true
    };
  }
}

// DetailSkill - Level of detail
export class DetailSkill extends SkillBase {
  constructor() {
    super('DetailSkill', '1.0.0');
    this.registerCapability('detail-analysis');
  }
  analyze(context) {
    const nodes = (context.graph && context.graph.nodes) || [];
    const decorations = nodes.filter(n => {
      const name = (n.name || '').toLowerCase();
      return name.includes('decal') || name.includes('texture') || n.className === 'Decal';
    }).length;
    return {
      kind: 'DETAIL_ANALYSIS',
      decorations,
      detailLevel: decorations > 10 ? 'high' : decorations > 3 ? 'medium' : 'low'
    };
  }
}

export default {
  ColorSkill,
  StyleSkill,
  ScaleSkill,
  ThemeSkill,
  ConsistencySkill,
  AestheticsSkill,
  ProportionSkill,
  DetailSkill
};
