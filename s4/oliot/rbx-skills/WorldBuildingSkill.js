// s4/oliot/rbx-skills/WorldBuildingSkill.js
// KERROS: S4 – Olio · Skill #12: World Building
// Version: 1.0.0
//
// WorldBuildingSkill: UNDERSTANDS terrain, biomes, and world-scale structures.

import { SkillBase } from './SkillBase.js';

export class WorldBuildingSkill extends SkillBase {
  constructor() {
    super('WorldBuildingSkill', '1.0.0');
    this.registerCapability('world-analysis');
    this.registerCapability('terrain-detection');
    this.registerCapability('biome-detection');
  }

  analyze(context) {
    this.validateContext(context);
    const nodes = (context.graph && context.graph.nodes) || [];

    return {
      kind: 'WORLD_BUILDING_ANALYSIS',
      schemaVersion: '1.0.0',
      terrain: this._analyzeTerrain(nodes),
      biomes: this._detectBiomes(nodes),
      scale: this._analyzeScale(nodes),
      landmarks: this._detectLandmarks(nodes),
    };
  }

  _analyzeTerrain(nodes) {
    const terrain = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('terrain') || name.includes('ground') || name.includes('baseplate');
    });
    return {
      count: terrain.length,
      hasBaseplate: terrain.some(n => (n.properties?.Name || '').toLowerCase().includes('baseplate')),
    };
  }

  _detectBiomes(nodes) {
    const biomes = new Set();
    nodes.forEach(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      if (name.includes('forest') || name.includes('tree')) biomes.add('forest');
      if (name.includes('desert') || name.includes('sand')) biomes.add('desert');
      if (name.includes('snow') || name.includes('ice')) biomes.add('snow');
      if (name.includes('lava') || name.includes('volcano')) biomes.add('volcanic');
      if (name.includes('water') || name.includes('ocean')) biomes.add('aquatic');
    });
    return { count: biomes.size, types: Array.from(biomes) };
  }

  _analyzeScale(nodes) {
    const bounds = this._calculateBounds(nodes);
    const volume = bounds.width * bounds.height * bounds.depth;
    return {
      bounds,
      volume,
      scale: volume > 100000 ? 'massive' : volume > 10000 ? 'large' : volume > 1000 ? 'medium' : 'small',
    };
  }

  _detectLandmarks(nodes) {
    const landmarks = nodes.filter(n => {
      const size = n.properties?.Size || [1, 1, 1];
      return size[1] > 50; // Tall structures
    });
    return { count: landmarks.length, detected: landmarks.length > 0 };
  }

  _calculateBounds(nodes) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    nodes.forEach(n => {
      const pos = n.properties?.Position || [0, 0, 0];
      const size = n.properties?.Size || [1, 1, 1];
      minX = Math.min(minX, pos[0] - size[0] / 2);
      maxX = Math.max(maxX, pos[0] + size[0] / 2);
      minY = Math.min(minY, pos[1] - size[1] / 2);
      maxY = Math.max(maxY, pos[1] + size[1] / 2);
      minZ = Math.min(minZ, pos[2] - size[2] / 2);
      maxZ = Math.max(maxZ, pos[2] + size[2] / 2);
    });
    return {
      width: maxX - minX,
      height: maxY - minY,
      depth: maxZ - minZ,
    };
  }
}

export default WorldBuildingSkill;
