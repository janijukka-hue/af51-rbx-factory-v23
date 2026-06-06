// s4/oliot/rbx-skills/ObbySkill.js
// KERROS: S4 – Olio · Skill #6: Obby
// Version: 1.0.0
//
// ObbySkill: UNDERSTANDS obstacle courses, jump paths, and checkpoints.

import { SkillBase } from './SkillBase.js';

export class ObbySkill extends SkillBase {
  constructor() {
    super('ObbySkill', '1.0.0');
    this.registerCapability('obby-analysis');
    this.registerCapability('checkpoint-detection');
    this.registerCapability('difficulty-estimation');
  }

  analyze(context) {
    this.validateContext(context);
    const nodes = (context.graph && context.graph.nodes) || [];

    return {
      kind: 'OBBY_ANALYSIS',
      schemaVersion: '1.0.0',
      checkpoints: this._detectCheckpoints(nodes),
      obstacles: this._detectObstacles(nodes),
      path: this._analyzePath(nodes),
      difficulty: this._estimateDifficulty(nodes),
      isObby: this._isObby(nodes),
    };
  }

  _detectCheckpoints(nodes) {
    const checkpoints = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('checkpoint') || name.includes('stage');
    });
    return { count: checkpoints.length, detected: checkpoints.length > 0 };
  }

  _detectObstacles(nodes) {
    const obstacles = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('kill') || name.includes('lava') || name.includes('spike');
    });
    return { count: obstacles.length, types: this._classifyObstacles(obstacles) };
  }

  _analyzePath(nodes) {
    // Simple heuristic: linear progression
    const platforms = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('platform') || name.includes('stage');
    });
    return {
      platforms: platforms.length,
      layout: platforms.length > 5 ? 'long' : platforms.length > 2 ? 'medium' : 'short',
    };
  }

  _estimateDifficulty(nodes) {
    const obstacles = this._detectObstacles(nodes);
    const checkpoints = this._detectCheckpoints(nodes);
    let score = 0;
    if (obstacles.count > 10) score += 50;
    else if (obstacles.count > 5) score += 30;
    else if (obstacles.count > 0) score += 10;
    if (checkpoints.count < 3) score += 20; // Fewer checkpoints = harder
    return { score, level: score >= 50 ? 'hard' : score >= 30 ? 'medium' : 'easy' };
  }

  _classifyObstacles(obstacles) {
    const types = new Set();
    obstacles.forEach(o => {
      const name = (o.properties?.Name || '').toLowerCase();
      if (name.includes('kill') || name.includes('lava')) types.add('deadly');
      if (name.includes('spike')) types.add('spike');
      if (name.includes('moving')) types.add('moving');
    });
    return Array.from(types);
  }

  _isObby(nodes) {
    const checkpoints = this._detectCheckpoints(nodes);
    const obstacles = this._detectObstacles(nodes);
    return checkpoints.detected || obstacles.count > 0;
  }
}

export default ObbySkill;
