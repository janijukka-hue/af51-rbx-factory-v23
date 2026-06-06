// s4/oliot/rbx-skills/PreviewDirectorSkill.js
// KERROS: S4 – Olio · Skill #14: Preview Director
// Version: 1.0.0
//
// PreviewDirectorSkill: Understands HOW to frame a scene for preview.
//
// Responsibilities:
// - Camera positioning (hero-focused, not baseplate-focused)
// - Auto framing (fit hero objects in view)
// - Orbit focus (rotate around semantic center)
// - Group focus (vehicles, characters, buildings)
// - Vehicle-specific framing (show car from hero angle)
//
// Does NOT:
// - Render (that's canvas/WebGL)
// - Generate geometry (that's GeometrySkill)
// - Decide WHAT is hero (that's SemanticAnalysisSkill)
//
// Input: { graph, semanticAnalysis }
// Output: { cameraPosition, focusPoint, orbitRadius, heroObjects }

import { SkillBase } from './SkillBase.js';

export class PreviewDirectorSkill extends SkillBase {
  constructor() {
    super('PreviewDirectorSkill', '1.0.0');
    this.registerCapability('camera-framing');
    this.registerCapability('hero-focus');
    this.registerCapability('auto-orbit');
  }

  /**
   * Analyze scene and determine optimal camera framing
   */
  analyze(context) {
    this.validateContext(context);

    const graph = context.graph || {};
    const nodes = graph.nodes || [];
    const semantic = context.semanticAnalysis || {};

    // Find hero objects from semantic analysis
    const heroObjects = this._identifyHeroObjects(semantic, nodes);

    // Calculate bounding box for hero objects
    const heroBounds = this._calculateHeroBounds(heroObjects);

    // Determine camera position based on scene type
    const cameraSetup = this._determineCameraSetup(heroObjects, heroBounds, semantic);

    return {
      kind: 'PREVIEW_DIRECTOR_ANALYSIS',
      schemaVersion: '1.0.0',
      heroObjects: heroObjects.map(h => ({
        id: h.id,
        type: h.type,
        name: h.name,
        bounds: h.bounds
      })),
      focusPoint: cameraSetup.focusPoint,
      cameraPosition: cameraSetup.position,
      orbitRadius: cameraSetup.orbitRadius,
      viewMode: cameraSetup.viewMode, // 'vehicle' | 'character' | 'building' | 'scene'
      bounds: heroBounds,
      ignoreBaseplate: heroObjects.length > 0, // If we have heroes, ignore baseplate
    };
  }

  _identifyHeroObjects(semantic, nodes) {
    const heroes = [];

    // Vehicles are always heroes
    if (semantic.vehicles && semantic.vehicles.length > 0) {
      semantic.vehicles.forEach(v => {
        const vehicleNodes = nodes.filter(n => 
          n.parent === v.name || 
          (n.properties && n.properties.Name && n.properties.Name.toLowerCase().includes(v.name.toLowerCase()))
        );
        if (vehicleNodes.length > 0) {
          heroes.push({
            id: v.id || vehicleNodes[0].id,
            type: 'vehicle',
            name: v.name,
            nodes: vehicleNodes,
            bounds: this._nodeBounds(vehicleNodes)
          });
        }
      });
    }

    // Characters are heroes
    if (semantic.characters && semantic.characters.rigs && semantic.characters.rigs.length > 0) {
      semantic.characters.rigs.forEach(rig => {
        const rigNodes = nodes.filter(n => 
          (n.properties && n.properties.Name === rig.name) ||
          n.varName === rig.name
        );
        if (rigNodes.length > 0) {
          heroes.push({
            id: rigNodes[0].id,
            type: 'character',
            name: rig.name,
            nodes: rigNodes,
            bounds: this._nodeBounds(rigNodes)
          });
        }
      });
    }

    // Buildings are heroes
    if (semantic.buildings && semantic.buildings.length > 0) {
      semantic.buildings.forEach(b => {
        const buildingNodes = nodes.filter(n => n.id === b.id);
        if (buildingNodes.length > 0) {
          heroes.push({
            id: b.id,
            type: 'building',
            name: b.name || 'Building',
            nodes: buildingNodes,
            bounds: this._nodeBounds(buildingNodes)
          });
        }
      });
    }

    return heroes;
  }

  _nodeBounds(nodes) {
    if (nodes.length === 0) return null;
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    nodes.forEach(n => {
      const pos = n.properties && n.properties.Position || [0, 0, 0];
      const size = n.properties && n.properties.Size || [4, 1, 4];
      
      const [x, y, z] = pos;
      const [sx, sy, sz] = size;

      minX = Math.min(minX, x - sx/2);
      maxX = Math.max(maxX, x + sx/2);
      minY = Math.min(minY, y - sy/2);
      maxY = Math.max(maxY, y + sy/2);
      minZ = Math.min(minZ, z - sz/2);
      maxZ = Math.max(maxZ, z + sz/2);
    });

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      size: [maxX - minX, maxY - minY, maxZ - minZ]
    };
  }

  _calculateHeroBounds(heroes) {
    if (heroes.length === 0) return null;

    const allBounds = heroes.map(h => h.bounds).filter(b => b != null);
    if (allBounds.length === 0) return null;

    let minX = Math.min(...allBounds.map(b => b.min[0]));
    let minY = Math.min(...allBounds.map(b => b.min[1]));
    let minZ = Math.min(...allBounds.map(b => b.min[2]));
    let maxX = Math.max(...allBounds.map(b => b.max[0]));
    let maxY = Math.max(...allBounds.map(b => b.max[1]));
    let maxZ = Math.max(...allBounds.map(b => b.max[2]));

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      size: [maxX - minX, maxY - minY, maxZ - minZ]
    };
  }

  _determineCameraSetup(heroes, bounds, semantic) {
    if (!bounds) {
      // No heroes - default scene view
      return {
        focusPoint: [0, 2, 0],
        position: [10, 8, 10],
        orbitRadius: 15,
        viewMode: 'scene'
      };
    }

    const center = bounds.center;
    const size = bounds.size;
    const maxDim = Math.max(...size);

    // Vehicle-specific framing (show from hero angle)
    if (heroes.some(h => h.type === 'vehicle')) {
      return {
        focusPoint: center,
        position: [center[0] + maxDim * 1.5, center[1] + maxDim * 0.8, center[2] + maxDim * 1.2],
        orbitRadius: maxDim * 2,
        viewMode: 'vehicle'
      };
    }

    // Character framing (eye level)
    if (heroes.some(h => h.type === 'character')) {
      return {
        focusPoint: [center[0], center[1] + size[1] * 0.5, center[2]],
        position: [center[0] + maxDim * 2, center[1] + size[1] * 0.7, center[2] + maxDim * 1.5],
        orbitRadius: maxDim * 2.5,
        viewMode: 'character'
      };
    }

    // Building framing (architectural view)
    if (heroes.some(h => h.type === 'building')) {
      return {
        focusPoint: [center[0], center[1], center[2]],
        position: [center[0] + maxDim * 1.8, center[1] + maxDim * 1.2, center[2] + maxDim * 1.5],
        orbitRadius: maxDim * 2.5,
        viewMode: 'building'
      };
    }

    // Generic scene view
    return {
      focusPoint: center,
      position: [center[0] + maxDim * 1.5, center[1] + maxDim, center[2] + maxDim * 1.5],
      orbitRadius: maxDim * 2,
      viewMode: 'scene'
    };
  }
}

export default PreviewDirectorSkill;
