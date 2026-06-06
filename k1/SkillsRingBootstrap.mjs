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

  console.log('[SkillsRingBootstrap] Registered 6 skills across 4 domains');
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
