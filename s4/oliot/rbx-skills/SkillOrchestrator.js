// s4/oliot/rbx-skills/SkillOrchestrator.js
// KERROS: S4 – Olio · Skill #20: Orchestrator
// Version: 1.0.0
//
// SkillOrchestrator: Coordinates ALL skills to produce intelligent output.
//
// Pipeline:
// Intent → SemanticAnalysisSkill → domain skills → composition → preview
//
// Example flow:
// 1. SemanticAnalysisSkill detects "vehicle"
// 2. VehicleSkill analyzes vehicle structure
// 3. CompositionSkill groups components
// 4. PreviewDirectorSkill frames camera
// 5. QualityGateSkill evaluates result
//
// This is the BRAIN of AF51 RBX Factory.

import { SemanticAnalysisSkill } from './SemanticAnalysisSkill.js';
import { PreviewDirectorSkill } from './PreviewDirectorSkill.js';
import { VehicleSkill } from './VehicleSkill.js';
import { CompositionSkill } from './CompositionSkill.js';
import { QualityGateSkill } from './QualityGateSkill.js';

export class SkillOrchestrator {
  constructor() {
    this.skills = new Map();
    this.pipeline = [];

    // Register core skills
    this.registerSkill('semantic', new SemanticAnalysisSkill());
    this.registerSkill('vehicle', new VehicleSkill());
    this.registerSkill('composition', new CompositionSkill());
    this.registerSkill('preview-director', new PreviewDirectorSkill());
    this.registerSkill('quality-gate', new QualityGateSkill());

    // Default full pipeline
    this.setPipeline(['semantic', 'vehicle', 'composition', 'preview-director', 'quality-gate']);
  }

  /**
   * Register a skill by name
   */
  registerSkill(name, skill) {
    this.skills.set(name, skill);
  }

  /**
   * Set execution pipeline order
   */
  setPipeline(skillNames) {
    // Validate all skills exist
    skillNames.forEach(name => {
      if (!this.skills.has(name)) {
        throw new Error('Skill not registered: ' + name);
      }
    });
    this.pipeline = skillNames;
  }

  /**
   * Execute full skill pipeline
   * @param {Object} initialContext - { graph, nodes, ... }
   * @returns {Object} - Enriched context with all skill outputs
   */
  async orchestrate(initialContext) {
    let context = { ...initialContext };
    const results = {};

    console.log('[SkillOrchestrator] Starting pipeline:', this.pipeline.join(' → '));

    // Execute each skill in pipeline
    for (const skillName of this.pipeline) {
      const skill = this.skills.get(skillName);
      
      try {
        console.log('[SkillOrchestrator] Executing:', skillName);
        const startTime = performance.now();
        
        // Run skill analysis
        const skillOutput = skill.analyze(context);
        
        const duration = (performance.now() - startTime).toFixed(2);
        console.log('[SkillOrchestrator] ' + skillName + ' completed in ' + duration + 'ms');
        
        // Store result
        results[skillName] = skillOutput;
        
        // Enrich context for next skill
        // Each skill's output becomes available to downstream skills
        if (skillName === 'semantic') {
          context.semanticAnalysis = skillOutput;
        }

        if (skillName === 'vehicle') {
          context.vehicleAnalysis = skillOutput;
        }

        if (skillName === 'composition') {
          context.compositionAnalysis = skillOutput;
        }

        if (skillName === 'preview-director') {
          context.cameraSetup = skillOutput;
        }

        if (skillName === 'quality-gate') {
          context.qualityGate = skillOutput;
        }
        
      } catch (error) {
        console.error('[SkillOrchestrator] Skill failed:', skillName, error);
        results[skillName] = { error: error.message };
      }
    }

    console.log('[SkillOrchestrator] Pipeline complete');

    return {
      kind: 'SKILL_ORCHESTRATION_RESULT',
      schemaVersion: '1.0.0',
      pipeline: this.pipeline,
      skills: results,
      context: {
        semantic: results.semantic || null,
        vehicle: results.vehicle || null,
        composition: results.composition || null,
        cameraSetup: results['preview-director'] || null,
        qualityGate: results['quality-gate'] || null,
      },
      // Backward compatibility with existing Director API
      semantic: results.semantic,
      vehicleAnalysis: results.vehicle,
      compositionAnalysis: results.composition,
      previewDirector: results['preview-director'],
      qualityGate: results['quality-gate'],
    };
  }

  /**
   * Quick analyze - runs semantic + preview director (default pipeline)
   */
  async quickAnalyze(graph) {
    return this.orchestrate({ graph });
  }

  /**
   * Get registered skills metadata
   */
  getSkillsInfo() {
    const info = [];
    this.skills.forEach((skill, name) => {
      info.push({
        name,
        metadata: skill.getMetadata()
      });
    });
    return info;
  }

  /**
   * Check if orchestrator can handle intent
   */
  canHandle(intent) {
    for (const [name, skill] of this.skills) {
      if (skill.canHandle(intent)) {
        return true;
      }
    }
    return false;
  }
}

export default SkillOrchestrator;
