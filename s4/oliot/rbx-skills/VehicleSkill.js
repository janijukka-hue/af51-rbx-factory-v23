// s4/oliot/rbx-skills/VehicleSkill.js
// KERROS: S4 – Olio · Skill #4: Vehicle
// Version: 1.0.0
//
// VehicleSkill: UNDERSTANDS vehicles, doesn't BUILD them.
//
// Responsibilities:
// - Analyze vehicle structure (body, wheels, chassis, lights, spoilers)
// - Classify vehicle type (car, truck, ship, aircraft, hover)
// - Detect racing layouts vs transport vs combat vehicles
// - Validate wheel count, symmetry, proportions
// - Identify vehicle quality (blocky, detailed, production-ready)
//
// Does NOT:
// - Generate vehicles (that's user's Lua)
// - Render vehicles (that's canvas)
// - Frame camera (that's PreviewDirectorSkill)
//
// Input: { nodes, semanticVehicles }
// Output: { vehicles: [{ type, parts, quality, symmetry, wheelConfig }] }

import { SkillBase } from './SkillBase.js';

export class VehicleSkill extends SkillBase {
  constructor() {
    super('VehicleSkill', '1.0.0');
    this.registerCapability('vehicle-analysis');
    this.registerCapability('vehicle-classification');
    this.registerCapability('vehicle-quality');
  }

  analyze(context) {
    this.validateContext(context);

    const nodes = (context.graph && context.graph.nodes) || [];
    const semanticVehicles = (context.semanticAnalysis && context.semanticAnalysis.vehicles) || [];

    const analyzedVehicles = semanticVehicles.map(v => this._analyzeVehicle(v, nodes));

    return {
      kind: 'VEHICLE_ANALYSIS',
      schemaVersion: '1.0.0',
      vehicles: analyzedVehicles,
      totalVehicles: analyzedVehicles.length,
      bestQuality: this._findBestQuality(analyzedVehicles),
    };
  }

  _analyzeVehicle(semanticVehicle, nodes) {
    // Find all parts belonging to this vehicle
    const vehicleParts = nodes.filter(n => 
      n.parent === semanticVehicle.name || 
      (n.properties && n.properties.Name && n.properties.Name.includes(semanticVehicle.name))
    );

    // Classify components
    const components = this._classifyComponents(vehicleParts);

    // Determine vehicle type
    const vehicleType = this._determineVehicleType(components, vehicleParts);

    // Analyze wheel configuration
    const wheelConfig = this._analyzeWheelConfig(components.wheels);

    // Check symmetry
    const symmetry = this._checkSymmetry(vehicleParts);

    // Evaluate quality
    const quality = this._evaluateQuality(vehicleParts, components, symmetry);

    return {
      id: semanticVehicle.id,
      name: semanticVehicle.name,
      type: vehicleType, // 'car' | 'truck' | 'ship' | 'aircraft' | 'hover' | 'racing'
      components: {
        body: components.body.length,
        wheels: components.wheels.length,
        lights: components.lights.length,
        spoilers: components.spoilers.length,
        chassis: components.chassis.length,
        total: vehicleParts.length
      },
      wheelConfig,
      symmetry,
      quality,
      partCount: vehicleParts.length,
    };
  }

  _classifyComponents(parts) {
    const components = {
      body: [],
      wheels: [],
      lights: [],
      spoilers: [],
      chassis: [],
      other: []
    };

    parts.forEach(part => {
      const name = (part.properties && part.properties.Name || '').toLowerCase();
      const shape = part.properties && part.properties.Shape;
      const material = part.properties && part.properties.Material;

      // Wheels: cylindrical or named "wheel"
      if (shape === 'Cylinder' || name.includes('wheel')) {
        components.wheels.push(part);
      }
      // Lights: neon material or named "light"
      else if (material === 'Neon' || name.includes('light') || name.includes('headlight')) {
        components.lights.push(part);
      }
      // Spoilers: thin vertical parts at back
      else if (name.includes('spoiler') || name.includes('wing')) {
        components.spoilers.push(part);
      }
      // Body: large parts
      else if (name.includes('body') || name.includes('cabin') || name.includes('hood')) {
        components.body.push(part);
      }
      // Chassis: bottom structural parts
      else if (name.includes('chassis') || name.includes('frame')) {
        components.chassis.push(part);
      }
      else {
        components.other.push(part);
      }
    });

    return components;
  }

  _determineVehicleType(components, parts) {
    const hasWings = parts.some(p => 
      (p.properties && p.properties.Name || '').toLowerCase().includes('wing')
    );
    const hasPropeller = parts.some(p => 
      (p.properties && p.properties.Name || '').toLowerCase().includes('propeller')
    );

    // Aircraft: wings or propellers
    if (hasWings || hasPropeller) {
      return 'aircraft';
    }

    // Racing: spoilers + 4 wheels + low body
    if (components.spoilers.length > 0 && components.wheels.length === 4) {
      return 'racing';
    }

    // Truck: 6+ wheels or large body
    if (components.wheels.length >= 6) {
      return 'truck';
    }

    // Hover: no wheels but has body
    if (components.wheels.length === 0 && components.body.length > 0) {
      return 'hover';
    }

    // Default: car
    return 'car';
  }

  _analyzeWheelConfig(wheels) {
    if (wheels.length === 0) {
      return { count: 0, layout: 'none', valid: false };
    }

    const count = wheels.length;
    let layout = 'unknown';
    let valid = false;

    // Common configurations
    if (count === 2) {
      layout = 'motorcycle';
      valid = true;
    } else if (count === 3) {
      layout = 'trike';
      valid = true;
    } else if (count === 4) {
      layout = '4-wheel';
      valid = true;
    } else if (count === 6) {
      layout = 'truck-6';
      valid = true;
    } else if (count % 2 === 0) {
      layout = 'multi-axle';
      valid = true;
    } else {
      layout = 'asymmetric';
      valid = false;
    }

    return { count, layout, valid };
  }

  _checkSymmetry(parts) {
    // Simple symmetry check: count parts on left vs right side
    const leftParts = parts.filter(p => {
      const pos = p.properties && p.properties.Position || [0, 0, 0];
      return pos[0] < 0; // Negative X = left
    });

    const rightParts = parts.filter(p => {
      const pos = p.properties && p.properties.Position || [0, 0, 0];
      return pos[0] > 0; // Positive X = right
    });

    const centerParts = parts.length - leftParts.length - rightParts.length;

    const isSymmetric = Math.abs(leftParts.length - rightParts.length) <= 1;

    return {
      isSymmetric,
      leftParts: leftParts.length,
      rightParts: rightParts.length,
      centerParts,
      balance: isSymmetric ? 'balanced' : 'unbalanced'
    };
  }

  _evaluateQuality(parts, components, symmetry) {
    let score = 50; // Base score

    // Part count: more parts = more detailed
    if (parts.length >= 10) score += 20;
    else if (parts.length >= 5) score += 10;

    // Components variety: wheels + body + lights = better
    if (components.wheels.length > 0) score += 10;
    if (components.lights.length > 0) score += 10;
    if (components.spoilers.length > 0) score += 5;

    // Symmetry: balanced = better
    if (symmetry.isSymmetric) score += 15;

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    let rating = 'blocky';
    if (score >= 80) rating = 'production-ready';
    else if (score >= 60) rating = 'detailed';
    else if (score >= 40) rating = 'basic';

    return {
      score,
      rating,
      factors: {
        partCount: parts.length,
        variety: Object.keys(components).filter(k => components[k].length > 0).length,
        symmetric: symmetry.isSymmetric
      }
    };
  }

  _findBestQuality(vehicles) {
    if (vehicles.length === 0) return null;
    return vehicles.reduce((best, v) => 
      v.quality.score > (best.quality.score || 0) ? v : best
    );
  }
}

export default VehicleSkill;
