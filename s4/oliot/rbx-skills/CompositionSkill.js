// s4/oliot/rbx-skills/CompositionSkill.js
// KERROS: S4 – Olio · Skill #2: Composition
// Version: 1.0.0
//
// CompositionSkill: UNDERSTANDS visual hierarchy and composition.
//
// Responsibilities:
// - Identify hero object (main focus)
// - Analyze visual hierarchy (foreground/midground/background)
// - Detect focal points (where eye should go)
// - Find landmarks (navigation aids)
// - Evaluate scene balance (composition quality)
// - Group related objects (spatial/semantic clustering)
//
// Does NOT:
// - Generate objects
// - Render scene
// - Position camera (that's PreviewDirectorSkill)
//
// Input: { nodes, semanticAnalysis }
// Output: { hero, hierarchy, focalPoints, landmarks, balance }

import { SkillBase } from './SkillBase.js';

export class CompositionSkill extends SkillBase {
  constructor() {
    super('CompositionSkill', '1.0.0');
    this.registerCapability('hero-detection');
    this.registerCapability('visual-hierarchy');
    this.registerCapability('composition-quality');
  }

  analyze(context) {
    this.validateContext(context);

    const nodes = (context.graph && context.graph.nodes) || [];
    const semantic = context.semanticAnalysis || {};

    // Identify hero object
    const hero = this._identifyHero(nodes, semantic);

    // Build visual hierarchy
    const hierarchy = this._buildHierarchy(nodes, hero);

    // Find focal points
    const focalPoints = this._findFocalPoints(nodes, hero);

    // Detect landmarks
    const landmarks = this._detectLandmarks(nodes);

    // Evaluate composition balance
    const balance = this._evaluateBalance(nodes, hero, hierarchy);

    return {
      kind: 'COMPOSITION_ANALYSIS',
      schemaVersion: '1.0.0',
      hero,
      hierarchy,
      focalPoints,
      landmarks,
      balance,
      quality: this._overallQuality(hero, hierarchy, balance),
    };
  }

  _identifyHero(nodes, semantic) {
    // Priority: vehicles > characters > buildings > largest object

    // Vehicles are always heroes
    if (semantic.vehicles && semantic.vehicles.length > 0) {
      const vehicle = semantic.vehicles[0];
      return {
        id: vehicle.id,
        name: vehicle.name,
        type: 'vehicle',
        priority: 'high',
        reason: 'semantic-vehicle'
      };
    }

    // Characters are heroes
    if (semantic.characters && semantic.characters.length > 0) {
      const character = semantic.characters[0];
      return {
        id: character.id,
        name: character.name,
        type: 'character',
        priority: 'high',
        reason: 'semantic-character'
      };
    }

    // Buildings
    if (semantic.buildings && semantic.buildings.length > 0) {
      const building = semantic.buildings[0];
      return {
        id: building.id,
        name: building.name,
        type: 'building',
        priority: 'medium',
        reason: 'semantic-building'
      };
    }

    // Fallback: largest non-baseplate object
    const nonBaseplates = nodes.filter(n => {
      const name = (n.properties && n.properties.Name || '').toLowerCase();
      return !name.includes('baseplate') && !name.includes('ground');
    });

    if (nonBaseplates.length > 0) {
      const largest = nonBaseplates.reduce((biggest, n) => {
        const size = n.properties && n.properties.Size || [1, 1, 1];
        const volume = size[0] * size[1] * size[2];
        const biggestSize = biggest.properties && biggest.properties.Size || [1, 1, 1];
        const biggestVolume = biggestSize[0] * biggestSize[1] * biggestSize[2];
        return volume > biggestVolume ? n : biggest;
      });

      return {
        id: largest.id,
        name: (largest.properties && largest.properties.Name) || 'Object',
        type: 'generic',
        priority: 'low',
        reason: 'largest-object'
      };
    }

    return null;
  }

  _buildHierarchy(nodes, hero) {
    const foreground = [];
    const midground = [];
    const background = [];

    const heroPos = hero ? this._getNodePosition(nodes.find(n => n.id === hero.id)) : null;

    nodes.forEach(n => {
      const name = (n.properties && n.properties.Name || '').toLowerCase();
      
      // Skip baseplates/terrain - they're always background
      if (name.includes('baseplate') || name.includes('ground') || name.includes('terrain')) {
        background.push(n.id);
        return;
      }

      // Hero is always foreground
      if (hero && n.id === hero.id) {
        foreground.push(n.id);
        return;
      }

      // Distance from hero determines layer
      if (heroPos) {
        const nodePos = this._getNodePosition(n);
        const distance = this._distance(heroPos, nodePos);
        const size = n.properties && n.properties.Size || [1, 1, 1];
        const avgSize = (size[0] + size[1] + size[2]) / 3;

        if (distance < avgSize * 3) {
          foreground.push(n.id);
        } else if (distance < avgSize * 10) {
          midground.push(n.id);
        } else {
          background.push(n.id);
        }
      } else {
        midground.push(n.id);
      }
    });

    return {
      foreground: { ids: foreground, count: foreground.length },
      midground: { ids: midground, count: midground.length },
      background: { ids: background, count: background.length },
      total: nodes.length
    };
  }

  _findFocalPoints(nodes, hero) {
    const points = [];

    // Hero is primary focal point
    if (hero) {
      points.push({
        id: hero.id,
        type: 'hero',
        priority: 1,
        reason: 'main-subject'
      });
    }

    // Neon/bright materials are focal points
    nodes.forEach(n => {
      if (n.properties && n.properties.Material === 'Neon') {
        points.push({
          id: n.id,
          type: 'visual-accent',
          priority: 2,
          reason: 'neon-material'
        });
      }
    });

    return points;
  }

  _detectLandmarks(nodes) {
    const landmarks = [];

    // Large vertical structures = landmarks
    nodes.forEach(n => {
      const size = n.properties && n.properties.Size || [1, 1, 1];
      if (size[1] > size[0] * 2 && size[1] > size[2] * 2 && size[1] > 10) {
        landmarks.push({
          id: n.id,
          name: (n.properties && n.properties.Name) || 'Tall Structure',
          type: 'vertical-landmark',
          height: size[1]
        });
      }
    });

    return landmarks;
  }

  _evaluateBalance(nodes, hero, hierarchy) {
    // Simple balance check: distribution of objects in 3D space
    const positions = nodes.map(n => this._getNodePosition(n));

    const avgX = positions.reduce((sum, p) => sum + p[0], 0) / positions.length;
    const avgY = positions.reduce((sum, p) => sum + p[1], 0) / positions.length;
    const avgZ = positions.reduce((sum, p) => sum + p[2], 0) / positions.length;

    // Check if hero is near center
    const heroNearCenter = hero ? (() => {
      const heroNode = nodes.find(n => n.id === hero.id);
      if (!heroNode) return false;
      const heroPos = this._getNodePosition(heroNode);
      const distance = this._distance(heroPos, [avgX, avgY, avgZ]);
      return distance < 20; // Within 20 studs of center
    })() : false;

    const score = heroNearCenter ? 80 : 60;

    return {
      score,
      centerOfMass: [avgX, avgY, avgZ],
      heroNearCenter,
      quality: score >= 70 ? 'balanced' : 'unbalanced',
      foregroundRatio: hierarchy.foreground.count / (hierarchy.total || 1)
    };
  }

  _overallQuality(hero, hierarchy, balance) {
    let score = 50;

    if (hero) score += 25;
    if (balance.score >= 70) score += 15;
    if (hierarchy.foreground.count > 0) score += 10;

    const rating = score >= 80 ? 'excellent' : 
                   score >= 60 ? 'good' : 'basic';

    return { score, rating };
  }

  _getNodePosition(node) {
    if (!node || !node.properties) return [0, 0, 0];
    return node.properties.Position || [0, 0, 0];
  }

  _distance(pos1, pos2) {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }
}

export default CompositionSkill;
