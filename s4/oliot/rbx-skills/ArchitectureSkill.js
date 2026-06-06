// s4/oliot/rbx-skills/ArchitectureSkill.js
// KERROS: S4 – Olio · Skill #3: Architecture
// Version: 1.0.0
//
// ArchitectureSkill: UNDERSTANDS buildings, rooms, and structural patterns.

import { SkillBase } from './SkillBase.js';

export class ArchitectureSkill extends SkillBase {
  constructor() {
    super('ArchitectureSkill', '1.0.0');
    this.registerCapability('architecture-analysis');
    this.registerCapability('building-detection');
    this.registerCapability('room-detection');
  }

  analyze(context) {
    this.validateContext(context);
    const nodes = (context.graph && context.graph.nodes) || [];
    const semantic = context.semanticAnalysis || {};

    return {
      kind: 'ARCHITECTURE_ANALYSIS',
      schemaVersion: '1.0.0',
      buildings: this._analyzeBuildings(nodes, semantic),
      rooms: this._detectRooms(nodes),
      structural: this._analyzeStructural(nodes),
      type: this._determineBuildingType(nodes),
    };
  }

  _analyzeBuildings(nodes, semantic) {
    const buildings = semantic.buildings || [];
    return buildings.map(b => ({
      id: b.id,
      name: b.name,
      floors: this._estimateFloors(nodes, b),
      rooms: this._estimateRooms(nodes, b),
      style: this._detectStyle(nodes, b),
    }));
  }

  _detectRooms(nodes) {
    // Simple heuristic: groups of walls/floors
    const walls = nodes.filter(n => (n.properties?.Name || '').toLowerCase().includes('wall'));
    const floors = nodes.filter(n => (n.properties?.Name || '').toLowerCase().includes('floor'));
    return { walls: walls.length, floors: floors.length, estimated: Math.max(1, Math.floor(walls.length / 4)) };
  }

  _analyzeStructural(nodes) {
    const pillars = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('pillar') || name.includes('column');
    });
    return { pillars: pillars.length, stability: pillars.length > 0 ? 'supported' : 'unsupported' };
  }

  _estimateFloors(nodes, building) {
    // Estimate based on height distribution
    return 1; // TODO: Implement vertical clustering
  }

  _estimateRooms(nodes, building) {
    return 1; // TODO: Implement spatial clustering
  }

  _detectStyle(nodes, building) {
    const materials = new Set(nodes.map(n => n.properties?.Material).filter(Boolean));
    if (materials.has('Neon')) return 'modern';
    if (materials.has('Wood')) return 'rustic';
    if (materials.has('Marble')) return 'classical';
    return 'basic';
  }

  _determineBuildingType(nodes) {
    const names = nodes.map(n => (n.properties?.Name || '').toLowerCase()).join(' ');
    if (names.includes('house')) return 'house';
    if (names.includes('tower')) return 'tower';
    if (names.includes('castle')) return 'castle';
    if (names.includes('shop') || names.includes('store')) return 'commercial';
    return 'generic';
  }
}

export default ArchitectureSkill;
