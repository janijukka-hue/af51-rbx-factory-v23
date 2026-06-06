// k1/SkillsRingBootstrap.mjs
// KERROS: K1 – Core Ring · Skills Ring Bootstrap v1.0
// Version: 1.0.0
//
// SkillsRingBootstrap: Registers all AF51 skills into the Skills Ring
//
// Current Skills (6/150):
// - SemanticAnalysisSkill (analysis domain)
// - VehicleSkill (creation domain)
// - CompositionSkill (design domain)
// - PreviewDirectorSkill (design domain)
// - QualityGateSkill (production domain)
//
// Future: 144 more skills across 12 domains

import { SkillsRing } from './SkillsRing.mjs';
import { SkillsRingGovernor } from './SkillsRingGovernor.mjs';

// Import existing skills
import { SemanticAnalysisSkill } from '../s4/oliot/rbx-skills/SemanticAnalysisSkill.js';
import { VehicleSkill } from '../s4/oliot/rbx-skills/VehicleSkill.js';
import { CompositionSkill } from '../s4/oliot/rbx-skills/CompositionSkill.js';
import { PreviewDirectorSkill } from '../s4/oliot/rbx-skills/PreviewDirectorSkill.js';
import { QualityGateSkill } from '../s4/oliot/rbx-skills/QualityGateSkill.js';
import { GeometrySkill } from '../s4/oliot/rbx-skills/GeometrySkill.js';
import { ArchitectureSkill } from '../s4/oliot/rbx-skills/ArchitectureSkill.js';
import { CharacterSkill } from '../s4/oliot/rbx-skills/CharacterSkill.js';
import { ObbySkill } from '../s4/oliot/rbx-skills/ObbySkill.js';
import { TycoonSkill } from '../s4/oliot/rbx-skills/TycoonSkill.js';
import { RPGSkill } from '../s4/oliot/rbx-skills/RPGSkill.js';
import { PerformanceSkill } from '../s4/oliot/rbx-skills/PerformanceSkill.js';
import { WorldBuildingSkill } from '../s4/oliot/rbx-skills/WorldBuildingSkill.js';
import { GameplaySkill } from '../s4/oliot/rbx-skills/GameplaySkill.js';

/**
 * Bootstrap Skills Ring with all AF51 skills
 */
export function bootstrapSkillsRing() {
  console.log('[SkillsRingBootstrap] Initializing Skills Ring v1.0...');

  const ring = new SkillsRing();
  const governor = new SkillsRingGovernor(ring);

  // Register Analysis Domain Skills
  ring.registerSkill({
    id: 'semantic-analysis',
    domain: 'analysis',
    name: 'SemanticAnalysisSkill',
    version: '1.0.0',
    capabilities: ['semantic-analysis', 'intent-detection', 'grouping'],
    dependencies: [],
    implementation: new SemanticAnalysisSkill(),
  });

  // Register Creation Domain Skills
  ring.registerSkill({
    id: 'vehicle-analysis',
    domain: 'creation',
    name: 'VehicleSkill',
    version: '1.0.0',
    capabilities: ['vehicle-analysis', 'vehicle-classification', 'vehicle-quality'],
    dependencies: ['semantic-analysis'],
    implementation: new VehicleSkill(),
  });

  // Register Design Domain Skills
  ring.registerSkill({
    id: 'composition-analysis',
    domain: 'design',
    name: 'CompositionSkill',
    version: '1.0.0',
    capabilities: ['composition-analysis', 'hero-detection', 'visual-hierarchy'],
    dependencies: ['semantic-analysis'],
    implementation: new CompositionSkill(),
  });

  ring.registerSkill({
    id: 'preview-direction',
    domain: 'design',
    name: 'PreviewDirectorSkill',
    version: '1.0.0',
    capabilities: ['preview-direction', 'camera-framing', 'view-modes'],
    dependencies: ['semantic-analysis', 'composition-analysis'],
    implementation: new PreviewDirectorSkill(),
  });

  // Register Production Domain Skills
  ring.registerSkill({
    id: 'quality-gate',
    domain: 'production',
    name: 'QualityGateSkill',
    version: '1.0.0',
    capabilities: ['quality-gate', 'production-readiness', 'blockiness-detection'],
    dependencies: ['semantic-analysis', 'vehicle-analysis', 'composition-analysis'],
    implementation: new QualityGateSkill(),
  });

  // Register Creation Domain Skills (continued)
  ring.registerSkill({
    id: 'geometry-analysis',
    domain: 'creation',
    name: 'GeometrySkill',
    version: '1.0.0',
    capabilities: ['geometry-analysis', 'primitive-detection', 'symmetry-detection'],
    dependencies: [],
    implementation: new GeometrySkill(),
  });

  ring.registerSkill({
    id: 'architecture-analysis',
    domain: 'creation',
    name: 'ArchitectureSkill',
    version: '1.0.0',
    capabilities: ['architecture-analysis', 'building-detection', 'room-detection'],
    dependencies: ['semantic-analysis'],
    implementation: new ArchitectureSkill(),
  });

  ring.registerSkill({
    id: 'character-analysis',
    domain: 'creation',
    name: 'CharacterSkill',
    version: '1.0.0',
    capabilities: ['character-analysis', 'humanoid-detection', 'rig-analysis'],
    dependencies: ['semantic-analysis'],
    implementation: new CharacterSkill(),
  });

  ring.registerSkill({
    id: 'world-building',
    domain: 'creation',
    name: 'WorldBuildingSkill',
    version: '1.0.0',
    capabilities: ['world-analysis', 'terrain-detection', 'biome-detection'],
    dependencies: [],
    implementation: new WorldBuildingSkill(),
  });

  // Register Analysis Domain Skills (game types)
  ring.registerSkill({
    id: 'obby-analysis',
    domain: 'analysis',
    name: 'ObbySkill',
    version: '1.0.0',
    capabilities: ['obby-analysis', 'checkpoint-detection', 'difficulty-estimation'],
    dependencies: [],
    implementation: new ObbySkill(),
  });

  ring.registerSkill({
    id: 'tycoon-analysis',
    domain: 'analysis',
    name: 'TycoonSkill',
    version: '1.0.0',
    capabilities: ['tycoon-analysis', 'economy-detection', 'production-chain-analysis'],
    dependencies: [],
    implementation: new TycoonSkill(),
  });

  ring.registerSkill({
    id: 'rpg-analysis',
    domain: 'analysis',
    name: 'RPGSkill',
    version: '1.0.0',
    capabilities: ['rpg-analysis', 'quest-detection', 'npc-detection'],
    dependencies: [],
    implementation: new RPGSkill(),
  });

  ring.registerSkill({
    id: 'performance-analysis',
    domain: 'analysis',
    name: 'PerformanceSkill',
    version: '1.0.0',
    capabilities: ['performance-analysis', 'draw-call-estimation', 'mobile-readiness'],
    dependencies: [],
    implementation: new PerformanceSkill(),
  });

  ring.registerSkill({
    id: 'gameplay-analysis',
    domain: 'analysis',
    name: 'GameplaySkill',
    version: '1.0.0',
    capabilities: ['gameplay-analysis', 'objective-detection', 'progression-analysis'],
    dependencies: ['semantic-analysis'],
    implementation: new GameplaySkill(),
  });

  const skillCount = ring.getStatistics().totalSkills;
  const domainCount = ring.getStatistics().domains.filter(d => d.skillCount > 0).length;

  console.log('[SkillsRingBootstrap] Registered ' + skillCount + ' skills across ' + domainCount + ' domains');
  console.log('[SkillsRingBootstrap] Skills Ring ready!');

  return { ring, governor };
}

/**
 * Quick analysis using Skills Ring
 */
export async function quickAnalyze(graph, intent = 'analyze-scene') {
  const { ring, governor } = bootstrapSkillsRing();
  
  const context = { graph };
  const result = await governor.orchestrate(intent, context);
  
  return result;
}

export default { bootstrapSkillsRing, quickAnalyze };
