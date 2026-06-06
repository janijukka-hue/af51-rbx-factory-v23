// s4/oliot/rbx-skills/SemanticAnalysisSkill.js
// KERROS: S4 – Olio · Skill #15: Semantic Analysis
// Version: 1.0.0
//
// SemanticAnalysisSkill: Understands WHAT the user built.
//
// Responsibilities:
// - Detect intent (vehicle, building, character, weapon, city, obby, tycoon, rpg)
// - Identify semantic groups (car = body + wheels, character = humanoid + parts)
// - Recognize patterns (obby = checkpoints + jumps, tycoon = droppers + collectors)
//
// Does NOT:
// - Build anything
// - Render anything
// - Decide camera position (that's PreviewDirectorSkill)
//
// Input: { graph }
// Output: { intent, vehicles, buildings, characters, obbys, tycoons, rpgs }

import { SkillBase } from './SkillBase.js';

export class SemanticAnalysisSkill extends SkillBase {
  constructor() {
    super('SemanticAnalysisSkill', '1.0.0');
    this.registerCapability('intent-detection');
    this.registerCapability('semantic-grouping');
    this.registerCapability('pattern-recognition');
  }

  analyze(context) {
    this.validateContext(context);

    const graph = context.graph || {};
    const nodes = graph.nodes || [];

    // Detect all semantic categories
    const vehicles = this._detectVehicles(nodes);
    const buildings = this._detectBuildings(nodes);
    const characters = this._detectCharacters(nodes);
    const obbys = this._detectObbys(nodes);
    const tycoons = this._detectTycoons(nodes);
    const rpgs = this._detectRPGs(nodes);

    // Determine primary intent
    const intent = this._determineIntent(vehicles, buildings, characters, obbys, tycoons, rpgs);

    return {
      kind: 'SEMANTIC_ANALYSIS',
      schemaVersion: '1.0.0',
      intent,
      vehicles,
      buildings,
      characters,
      obbys,
      tycoons,
      rpgs,
      confidence: this._calculateConfidence(intent, nodes)
    };
  }

  _detectVehicles(nodes) {
    const vehicles = [];

    // Look for Model + wheel patterns
    const models = nodes.filter(n => n.className === 'Model');
    
    models.forEach(model => {
      const children = nodes.filter(n => n.parent === (model.properties && model.properties.Name) || model.varName);
      const wheels = children.filter(c => 
        (c.className === 'Part' && c.properties && c.properties.Shape === 'Cylinder') ||
        (c.properties && c.properties.Name && c.properties.Name.toLowerCase().includes('wheel'))
      );

      if (wheels.length >= 2) {
        vehicles.push({
          id: model.id,
          name: (model.properties && model.properties.Name) || model.varName || 'Vehicle',
          type: 'vehicle',
          wheels: wheels.length,
          parts: children.length
        });
      }
    });

    // Also detect standalone vehicle keywords
    nodes.forEach(n => {
      const name = (n.properties && n.properties.Name || '').toLowerCase();
      if (name.includes('car') || name.includes('vehicle') || name.includes('auto')) {
        if (!vehicles.some(v => v.id === n.id)) {
          vehicles.push({
            id: n.id,
            name: n.properties.Name,
            type: 'vehicle',
            wheels: 0,
            parts: 1
          });
        }
      }
    });

    return vehicles;
  }

  _detectBuildings(nodes) {
    const buildings = [];

    // Look for Models with "building" keywords or structural patterns
    const models = nodes.filter(n => n.className === 'Model');
    
    models.forEach(model => {
      const name = (model.properties && model.properties.Name || '').toLowerCase();
      const children = nodes.filter(n => n.parent === (model.properties && model.properties.Name) || model.varName);
      
      // Building keywords
      if (name.includes('house') || name.includes('building') || name.includes('shop') || name.includes('tower')) {
        buildings.push({
          id: model.id,
          name: model.properties.Name,
          type: 'building',
          parts: children.length
        });
      }
      
      // Structural pattern: many vertical parts
      const verticalParts = children.filter(c => {
        const size = c.properties && c.properties.Size || [1, 1, 1];
        return size[1] > size[0] && size[1] > size[2]; // Height > width/depth
      });
      
      if (verticalParts.length >= 3 && children.length >= 5) {
        buildings.push({
          id: model.id,
          name: (model.properties && model.properties.Name) || 'Building',
          type: 'building',
          parts: children.length
        });
      }
    });

    return buildings;
  }

  _detectCharacters(nodes) {
    const characters = [];

    // Look for Humanoid or Model with body parts
    const humanoids = nodes.filter(n => n.className === 'Humanoid');
    const models = nodes.filter(n => n.className === 'Model');

    humanoids.forEach(h => {
      const parent = nodes.find(n => (n.properties && n.properties.Name) === h.parent || n.varName === h.parent);
      if (parent) {
        characters.push({
          id: parent.id,
          name: (parent.properties && parent.properties.Name) || 'Character',
          type: 'humanoid',
          hasHumanoid: true
        });
      }
    });

    // NPC-like models
    models.forEach(m => {
      const name = (m.properties && m.properties.Name || '').toLowerCase();
      if (name.includes('npc') || name.includes('character') || name.includes('player')) {
        if (!characters.some(c => c.id === m.id)) {
          characters.push({
            id: m.id,
            name: m.properties.Name,
            type: 'npc',
            hasHumanoid: false
          });
        }
      }
    });

    return characters;
  }

  _detectObbys(nodes) {
    // Look for checkpoint patterns, spawn locations, jump sequences
    const checkpoints = nodes.filter(n => {
      const name = (n.properties && n.properties.Name || '').toLowerCase();
      return name.includes('checkpoint') || name.includes('spawn');
    });

    if (checkpoints.length >= 2) {
      return [{
        type: 'obby',
        checkpoints: checkpoints.length,
        confidence: 'medium'
      }];
    }

    return [];
  }

  _detectTycoons(nodes) {
    // Look for dropper/collector patterns
    const droppers = nodes.filter(n => {
      const name = (n.properties && n.properties.Name || '').toLowerCase();
      return name.includes('dropper') || name.includes('conveyor');
    });

    const collectors = nodes.filter(n => {
      const name = (n.properties && n.properties.Name || '').toLowerCase();
      return name.includes('collector') || name.includes('hopper');
    });

    if (droppers.length > 0 && collectors.length > 0) {
      return [{
        type: 'tycoon',
        droppers: droppers.length,
        collectors: collectors.length,
        confidence: 'medium'
      }];
    }

    return [];
  }

  _detectRPGs(nodes) {
    // Look for quest/NPC/enemy patterns
    const npcs = nodes.filter(n => {
      const name = (n.properties && n.properties.Name || '').toLowerCase();
      return name.includes('quest') || name.includes('shop') || name.includes('merchant');
    });

    if (npcs.length >= 2) {
      return [{
        type: 'rpg',
        npcs: npcs.length,
        confidence: 'low'
      }];
    }

    return [];
  }

  _determineIntent(vehicles, buildings, characters, obbys, tycoons, rpgs) {
    // Priority order: specific > general
    if (tycoons.length > 0) return 'tycoon';
    if (obbys.length > 0) return 'obby';
    if (rpgs.length > 0) return 'rpg';
    if (vehicles.length > 0 && vehicles.length > buildings.length) return 'vehicle';
    if (buildings.length > 0) return 'building';
    if (characters.length > 0) return 'character';
    return 'scene';
  }

  _calculateConfidence(intent, nodes) {
    // Simple heuristic: more nodes = lower confidence (too generic)
    if (nodes.length < 5) return 'low';
    if (nodes.length < 15) return 'medium';
    if (nodes.length < 50) return 'high';
    return 'medium'; // Very large scenes are uncertain
  }
}

export default SemanticAnalysisSkill;
