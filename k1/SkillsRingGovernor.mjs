// k1/SkillsRingGovernor.mjs
// KERROS: K1 – Core Ring · Skills Ring Governor v1.0
// Version: 1.0.0
//
// SkillsRingGovernor: Orchestrates skill execution with enterprise-grade control
//
// Responsibilities:
// - Intent → Capability Resolution
// - Skill Selection (best fit)
// - Skill Scheduling (dependencies + energy)
// - Energy Allocation
// - Execution Orchestration
// - Audit Trail
// - Learning & Feedback
//
// This is the BRAIN of Skills Ring.

export class SkillsRingGovernor {
  constructor(skillsRing) {
    this.ring = skillsRing;
    this.version = '1.0.0';
    this.kind = 'SKILLS_RING_GOVERNOR';

    // Execution history
    this.executionHistory = [];
    this.pipelineCache = new Map();
  }

  /**
   * Main orchestration: Intent → Skills → Result
   */
  async orchestrate(intent, context) {
    console.log('[SkillsRingGovernor] Intent:', intent);

    // 1. Capability Resolution
    const capabilities = this._resolveCapabilities(intent);
    console.log('[SkillsRingGovernor] Capabilities:', capabilities.join(', '));

    // 2. Skill Selection
    const skills = this._selectSkills(capabilities, context);
    console.log('[SkillsRingGovernor] Selected skills:', skills.map(s => s.id).join(' → '));

    // 3. Dependency Resolution
    const pipeline = this._resolveDependencies(skills);
    console.log('[SkillsRingGovernor] Pipeline:', pipeline.map(s => s.id).join(' → '));

    // 4. Energy Check
    const energyRequired = pipeline.reduce((sum, s) => sum + s.energyCost, 0);
    console.log('[SkillsRingGovernor] Energy required:', energyRequired);

    // TODO: Check with EnergyRing
    // if (energyRing.available() < energyRequired) throw Error

    // 5. Execute Pipeline
    const results = await this._executePipeline(pipeline, context);

    // 6. Audit
    this._audit(intent, pipeline, results);

    // 7. Learning
    this._learn(intent, pipeline, results);

    return {
      kind: 'SKILLS_RING_RESULT',
      schemaVersion: '1.0.0',
      intent,
      capabilities,
      pipeline: pipeline.map(s => s.id),
      results,
      energyUsed: energyRequired,
      timestamp: Date.now(),
    };
  }

  /**
   * Intent → Capabilities
   */
  _resolveCapabilities(intent) {
    // Simple mapping for now
    // In v2, this would be ALX-powered semantic resolution
    const intentMap = {
      'analyze-vehicle': ['vehicle-analysis', 'semantic-analysis', 'composition-analysis'],
      'analyze-building': ['building-analysis', 'semantic-analysis', 'architecture-analysis'],
      'analyze-scene': ['semantic-analysis', 'composition-analysis', 'quality-gate'],
      'preview': ['preview-direction', 'semantic-analysis', 'composition-analysis'],
      'quality-check': ['quality-gate', 'composition-analysis', 'semantic-analysis'],
    };

    return intentMap[intent] || ['semantic-analysis'];
  }

  /**
   * Capabilities → Skills
   */
  _selectSkills(capabilities, context) {
    const skills = [];

    capabilities.forEach(cap => {
      const matches = this.ring.findByCapability(cap);
      
      if (matches.length > 0) {
        // Select best skill (highest trust score)
        const bestId = matches.reduce((best, id) => {
          const skill = this.ring.getSkillInfo(id);
          const bestSkill = this.ring.getSkillInfo(best);
          return (skill.trustScore > bestSkill.trustScore) ? id : best;
        });

        const skill = this.ring.getSkillInfo(bestId);
        skills.push(skill);
      }
    });

    return skills;
  }

  /**
   * Resolve dependencies and order execution
   */
  _resolveDependencies(skills) {
    // Topological sort based on skill.dependencies
    const visited = new Set();
    const pipeline = [];

    const visit = (skillId) => {
      if (visited.has(skillId)) return;
      visited.add(skillId);

      const skill = this.ring.getSkillInfo(skillId);
      if (!skill) return;

      // Visit dependencies first
      if (skill.dependencies) {
        skill.dependencies.forEach(depId => {
          const depSkill = this.ring.getSkillInfo(depId);
          if (depSkill) visit(depId);
        });
      }

      pipeline.push(skill);
    };

    skills.forEach(s => visit(s.id));

    return pipeline;
  }

  /**
   * Execute pipeline
   */
  async _executePipeline(pipeline, context) {
    const results = {};
    let enrichedContext = { ...context };

    for (const skill of pipeline) {
      try {
        const result = await this.ring.executeSkill(skill.id, enrichedContext);
        results[skill.id] = result;

        // Enrich context for downstream skills
        enrichedContext[skill.id] = result;

        // Domain-specific enrichment
        if (skill.domain === 'analysis') {
          enrichedContext.analysis = enrichedContext.analysis || {};
          enrichedContext.analysis[skill.id] = result;
        }

      } catch (error) {
        console.error('[SkillsRingGovernor] Skill failed:', skill.id, error);
        results[skill.id] = { error: error.message };
      }
    }

    return results;
  }

  /**
   * Audit execution
   */
  _audit(intent, pipeline, results) {
    const audit = {
      timestamp: Date.now(),
      intent,
      pipeline: pipeline.map(s => s.id),
      results: Object.keys(results),
      success: !Object.values(results).some(r => r.error),
    };

    this.executionHistory.push(audit);

    // TODO: Send to AuditRing
    console.log('[SkillsRingGovernor] Audit:', audit.success ? 'SUCCESS' : 'FAILURE');
  }

  /**
   * Learn from execution
   */
  _learn(intent, pipeline, results) {
    // Update trust scores based on success/quality
    pipeline.forEach(skill => {
      const result = results[skill.id];
      
      if (result && !result.error) {
        // Success → increase trust
        skill.trustScore = Math.min(1.0, skill.trustScore + 0.01);
        skill.confidence = Math.min(1.0, skill.confidence + 0.01);
      } else {
        // Failure → decrease trust
        skill.trustScore = Math.max(0.0, skill.trustScore - 0.05);
        skill.confidence = Math.max(0.0, skill.confidence - 0.05);
      }
    });

    // Cache successful pipelines
    if (!Object.values(results).some(r => r.error)) {
      this.pipelineCache.set(intent, pipeline.map(s => s.id));
    }

    console.log('[SkillsRingGovernor] Learning complete');
  }
}

export default SkillsRingGovernor;
