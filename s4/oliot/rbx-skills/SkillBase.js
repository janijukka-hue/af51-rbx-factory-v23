// s4/oliot/rbx-skills/SkillBase.js
// KERROS: S4 – Olio · RBX Skill Base Class
// Version: 1.0.0
//
// Base class for all RBX Skills. Skills are SPECIALIZED, COMPOSABLE objects
// that understand ONE thing deeply. They don't build entire products—they
// contribute their expertise to a collaborative pipeline.
//
// Philosophy:
// - Skills ANALYZE, not generate
// - Skills UNDERSTAND, not create
// - Skills COMPOSE together via SkillOrchestrator
// - Each skill returns INSIGHT, not final output

export class SkillBase {
  constructor(name, version) {
    this.name = name || 'UnnamedSkill';
    this.version = version || '1.0.0';
    this.capabilities = [];
  }

  /**
   * Core analyze method - override in subclasses
   * @param {Object} context - Scene graph, nodes, metadata
   * @returns {Object} - Skill-specific insights
   */
  analyze(context) {
    throw new Error(this.name + '.analyze() must be implemented by subclass');
  }

  /**
   * Register a capability this skill provides
   */
  registerCapability(capability) {
    if (!this.capabilities.includes(capability)) {
      this.capabilities.push(capability);
    }
  }

  /**
   * Check if skill can handle given intent
   */
  canHandle(intent) {
    return this.capabilities.includes(intent);
  }

  /**
   * Skill metadata for orchestration
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      capabilities: this.capabilities,
      type: 'skill'
    };
  }

  /**
   * Validate input context before analysis
   */
  validateContext(context) {
    if (!context) {
      throw new Error(this.name + ': context is required');
    }
    return true;
  }
}

export default SkillBase;
