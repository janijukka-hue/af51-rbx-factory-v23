// s4/oliot/rbx-skills/GeometrySkill.js
// KERROS: S4 – Olio · Skill #1: Geometry
// Version: 1.0.0
//
// GeometrySkill: UNDERSTANDS geometric primitives, symmetry, and composition.

import { SkillBase } from './SkillBase.js';

export class GeometrySkill extends SkillBase {
  constructor() {
    super('GeometrySkill', '1.0.0');
    this.registerCapability('geometry-analysis');
    this.registerCapability('primitive-detection');
    this.registerCapability('symmetry-detection');
  }

  analyze(context) {
    this.validateContext(context);
    const nodes = (context.graph && context.graph.nodes) || [];

    return {
      kind: 'GEOMETRY_ANALYSIS',
      schemaVersion: '1.0.0',
      primitives: this._analyzePrimitives(nodes),
      symmetry: this._analyzeSymmetry(nodes),
      complexity: this._analyzeComplexity(nodes),
      shapes: this._analyzeShapes(nodes),
    };
  }

  _analyzePrimitives(nodes) {
    const primitives = { blocks: 0, cylinders: 0, balls: 0, wedges: 0, total: nodes.length };
    nodes.forEach(n => {
      const shape = n.properties && n.properties.Shape;
      if (shape === 'Cylinder') primitives.cylinders++;
      else if (shape === 'Ball') primitives.balls++;
      else if (shape === 'Wedge') primitives.wedges++;
      else primitives.blocks++;
    });
    return primitives;
  }

  _analyzeSymmetry(nodes) {
    const left = nodes.filter(n => (n.properties?.Position?.[0] || 0) < 0).length;
    const right = nodes.filter(n => (n.properties?.Position?.[0] || 0) > 0).length;
    const isSymmetric = Math.abs(left - right) <= 1;
    return { isSymmetric, left, right, balance: isSymmetric ? 'balanced' : 'unbalanced' };
  }

  _analyzeComplexity(nodes) {
    let score = 0;
    if (nodes.length >= 20) score = 100;
    else if (nodes.length >= 10) score = 70;
    else if (nodes.length >= 5) score = 40;
    else score = 20;
    return { score, level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low' };
  }

  _analyzeShapes(nodes) {
    const shapes = new Set();
    nodes.forEach(n => shapes.add(n.properties?.Shape || 'Block'));
    return { count: shapes.size, variety: shapes.size >= 3 ? 'high' : shapes.size === 2 ? 'medium' : 'low' };
  }
}

export default GeometrySkill;
