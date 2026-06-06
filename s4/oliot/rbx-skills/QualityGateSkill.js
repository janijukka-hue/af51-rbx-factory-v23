// s4/oliot/rbx-skills/QualityGateSkill.js
// KERROS: S4 – Olio · Skill #16: Quality Gate
// Version: 1.0.0
//
// QualityGateSkill: EVALUATES production readiness.
//
// Responsibilities:
// - Blockiness score (primitive vs detailed)
// - Readability score (can player understand scene?)
// - Composition score (visual quality)
// - Gameplay score (is it playable?)
// - Production readiness (ship or iterate?)
//
// Does NOT:
// - Fix quality issues (that's user's job)
// - Generate content
// - Make subjective judgments (only measurable metrics)
//
// Input: { nodes, vehicleAnalysis, compositionAnalysis, semanticAnalysis }
// Output: { scores, verdict, blockers, recommendations }

import { SkillBase } from './SkillBase.js';

export class QualityGateSkill extends SkillBase {
  constructor() {
    super('QualityGateSkill', '1.0.0');
    this.registerCapability('quality-evaluation');
    this.registerCapability('production-readiness');
    this.registerCapability('blockiness-detection');
  }

  analyze(context) {
    this.validateContext(context);

    const nodes = (context.graph && context.graph.nodes) || [];
    const vehicleAnalysis = context.vehicleAnalysis || null;
    const composition = context.compositionAnalysis || null;
    const semantic = context.semanticAnalysis || null;

    // Calculate scores
    const blockinessScore = this._evaluateBlockiness(nodes, vehicleAnalysis);
    const readabilityScore = this._evaluateReadability(nodes, composition);
    const compositionScore = composition ? composition.quality.score : 50;
    const gameplayScore = this._evaluateGameplay(nodes, semantic);

    // Overall quality
    const overallScore = (
      blockinessScore * 0.25 +
      readabilityScore * 0.25 +
      compositionScore * 0.25 +
      gameplayScore * 0.25
    );

    // Determine verdict
    const verdict = this._determineVerdict(overallScore, {
      blockiness: blockinessScore,
      readability: readabilityScore,
      composition: compositionScore,
      gameplay: gameplayScore
    });

    // Find blockers
    const blockers = this._findBlockers({
      blockiness: blockinessScore,
      readability: readabilityScore,
      composition: compositionScore,
      gameplay: gameplayScore
    });

    // Generate recommendations
    const recommendations = this._generateRecommendations(blockers, nodes, vehicleAnalysis);

    return {
      kind: 'QUALITY_GATE_ANALYSIS',
      schemaVersion: '1.0.0',
      scores: {
        blockiness: Math.round(blockinessScore),
        readability: Math.round(readabilityScore),
        composition: Math.round(compositionScore),
        gameplay: Math.round(gameplayScore),
        overall: Math.round(overallScore)
      },
      verdict, // 'production-ready' | 'needs-improvement' | 'prototype'
      blockers,
      recommendations,
      tier: this._determineTier(overallScore),
      ready: verdict === 'production-ready'
    };
  }

  _evaluateBlockiness(nodes, vehicleAnalysis) {
    let score = 50; // Base

    // Part count: more parts = less blocky
    if (nodes.length >= 20) score += 20;
    else if (nodes.length >= 10) score += 10;
    else if (nodes.length < 3) score -= 20;

    // Shape variety: cylinders/balls = less blocky
    const shapes = nodes.map(n => n.properties && n.properties.Shape);
    const hasVariety = shapes.includes('Cylinder') || shapes.includes('Ball');
    if (hasVariety) score += 15;

    // Material variety: Neon/Glass = more detailed
    const materials = nodes.map(n => n.properties && n.properties.Material);
    const materialSet = new Set(materials.filter(m => m));
    if (materialSet.size >= 3) score += 10;

    // Vehicle quality (if applicable)
    if (vehicleAnalysis && vehicleAnalysis.vehicles) {
      const avgVehicleQuality = vehicleAnalysis.vehicles.reduce((sum, v) => 
        sum + v.quality.score, 0) / (vehicleAnalysis.vehicles.length || 1);
      score = (score + avgVehicleQuality) / 2; // Blend
    }

    return Math.max(0, Math.min(100, score));
  }

  _evaluateReadability(nodes, composition) {
    let score = 50;

    // Hero object = readable
    if (composition && composition.hero) score += 20;

    // Good hierarchy = readable
    if (composition && composition.hierarchy) {
      const fg = composition.hierarchy.foreground.count;
      const total = composition.hierarchy.total;
      if (fg > 0 && fg / total >= 0.1) score += 15;
    }

    // Focal points = readable
    if (composition && composition.focalPoints && composition.focalPoints.length > 0) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  _evaluateGameplay(nodes, semantic) {
    let score = 50;

    // Has gameplay intent?
    if (semantic && semantic.intent) {
      const intent = semantic.intent;
      
      // Specific gameplay types score higher
      if (intent === 'vehicle') score += 20;
      else if (intent === 'character') score += 20;
      else if (intent === 'obby') score += 25;
      else if (intent === 'tycoon') score += 25;
      else if (intent === 'rpg') score += 25;
      else if (intent === 'building') score += 10;
    }

    // Checkpoints/spawns = playable
    const hasCheckpoints = nodes.some(n => {
      const name = (n.properties && n.properties.Name || '').toLowerCase();
      return name.includes('checkpoint') || name.includes('spawn');
    });
    if (hasCheckpoints) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  _determineVerdict(overallScore, scores) {
    // All scores must pass thresholds
    const hasBlocker = Object.values(scores).some(s => s < 40);

    if (hasBlocker) return 'prototype';
    if (overallScore >= 75) return 'production-ready';
    if (overallScore >= 55) return 'needs-improvement';
    return 'prototype';
  }

  _findBlockers(scores) {
    const blockers = [];

    if (scores.blockiness < 40) {
      blockers.push({
        type: 'blockiness',
        severity: 'high',
        message: 'Scene is too blocky - add more parts, shapes, or details'
      });
    }

    if (scores.readability < 40) {
      blockers.push({
        type: 'readability',
        severity: 'high',
        message: 'Scene lacks clear focus - no hero object or visual hierarchy'
      });
    }

    if (scores.composition < 40) {
      blockers.push({
        type: 'composition',
        severity: 'medium',
        message: 'Poor composition - objects not well arranged'
      });
    }

    if (scores.gameplay < 40) {
      blockers.push({
        type: 'gameplay',
        severity: 'medium',
        message: 'No clear gameplay intent - add objectives or interactive elements'
      });
    }

    return blockers;
  }

  _generateRecommendations(blockers, nodes, vehicleAnalysis) {
    const recs = [];

    // Address blockers
    blockers.forEach(b => {
      if (b.type === 'blockiness') {
        recs.push('Add more parts (current: ' + nodes.length + ', target: 10+)');
        recs.push('Use Cylinder/Ball shapes for variety');
        recs.push('Apply Neon/Glass materials for visual interest');
      }

      if (b.type === 'readability') {
        recs.push('Define a clear hero object (vehicle, character, or building)');
        recs.push('Create visual hierarchy (foreground/background separation)');
      }

      if (b.type === 'composition') {
        recs.push('Group related objects together');
        recs.push('Balance object placement in scene');
      }

      if (b.type === 'gameplay') {
        recs.push('Add SpawnLocation for player entry point');
        recs.push('Create objectives (checkpoints, collectibles, enemies)');
      }
    });

    // Vehicle-specific recommendations
    if (vehicleAnalysis && vehicleAnalysis.vehicles) {
      vehicleAnalysis.vehicles.forEach(v => {
        if (v.quality.score < 60) {
          recs.push('Improve ' + v.name + ': add lights, spoiler, or more details');
        }
        if (!v.symmetry.isSymmetric) {
          recs.push('Fix ' + v.name + ' symmetry (left/right balance)');
        }
      });
    }

    return recs.slice(0, 5); // Top 5 recommendations
  }

  _determineTier(score) {
    if (score >= 85) return 'T1';
    if (score >= 70) return 'T2';
    if (score >= 55) return 'T3';
    if (score >= 40) return 'T4';
    return 'T5';
  }
}

export default QualityGateSkill;
