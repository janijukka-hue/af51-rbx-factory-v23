// s4/oliot/rbx-skills/PerformanceSkill.js
// KERROS: S4 – Olio · Skill #9: Performance
// Version: 1.0.0
//
// PerformanceSkill: UNDERSTANDS performance metrics, draw calls, mobile readiness.

import { SkillBase } from './SkillBase.js';

export class PerformanceSkill extends SkillBase {
  constructor() {
    super('PerformanceSkill', '1.0.0');
    this.registerCapability('performance-analysis');
    this.registerCapability('draw-call-estimation');
    this.registerCapability('mobile-readiness');
  }

  analyze(context) {
    this.validateContext(context);
    const nodes = (context.graph && context.graph.nodes) || [];

    return {
      kind: 'PERFORMANCE_ANALYSIS',
      schemaVersion: '1.0.0',
      drawCalls: this._estimateDrawCalls(nodes),
      memory: this._estimateMemory(nodes),
      mobileReadiness: this._analyzeMobileReadiness(nodes),
      optimization: this._suggestOptimizations(nodes),
    };
  }

  _estimateDrawCalls(nodes) {
    // Rough estimate: 1 draw call per mesh/part
    const meshes = nodes.filter(n => n.className === 'MeshPart' || n.className === 'SpecialMesh');
    const parts = nodes.filter(n => n.className === 'Part');
    const estimated = meshes.length + parts.length;
    return {
      estimated,
      level: estimated > 1000 ? 'high' : estimated > 500 ? 'medium' : 'low',
    };
  }

  _estimateMemory(nodes) {
    const meshes = nodes.filter(n => n.className === 'MeshPart').length;
    const parts = nodes.length;
    const estimatedMB = (meshes * 0.5) + (parts * 0.1); // Rough estimate
    return {
      estimatedMB: Math.round(estimatedMB * 10) / 10,
      level: estimatedMB > 50 ? 'high' : estimatedMB > 20 ? 'medium' : 'low',
    };
  }

  _analyzeMobileReadiness(nodes) {
    const drawCalls = this._estimateDrawCalls(nodes);
    const memory = this._estimateMemory(nodes);
    let score = 100;
    if (drawCalls.estimated > 500) score -= 30;
    else if (drawCalls.estimated > 200) score -= 15;
    if (memory.estimatedMB > 20) score -= 20;
    else if (memory.estimatedMB > 10) score -= 10;
    return {
      score,
      ready: score >= 70,
      level: score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'poor',
    };
  }

  _suggestOptimizations(nodes) {
    const suggestions = [];
    const meshes = nodes.filter(n => n.className === 'MeshPart').length;
    const parts = nodes.length;
    if (parts > 500) suggestions.push('Reduce part count (current: ' + parts + ')');
    if (meshes > 100) suggestions.push('Consider mesh combining (current: ' + meshes + ')');
    if (nodes.filter(n => n.properties?.Material === 'Neon').length > 50) {
      suggestions.push('Reduce neon materials for mobile');
    }
    return suggestions;
  }
}

export default PerformanceSkill;
