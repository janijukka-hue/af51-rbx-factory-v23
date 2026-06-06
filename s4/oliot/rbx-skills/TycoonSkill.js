// s4/oliot/rbx-skills/TycoonSkill.js
// KERROS: S4 – Olio · Skill #7: Tycoon
// Version: 1.0.0
//
// TycoonSkill: UNDERSTANDS tycoon games, income loops, and production chains.

import { SkillBase } from './SkillBase.js';

export class TycoonSkill extends SkillBase {
  constructor() {
    super('TycoonSkill', '1.0.0');
    this.registerCapability('tycoon-analysis');
    this.registerCapability('economy-detection');
    this.registerCapability('production-chain-analysis');
  }

  analyze(context) {
    this.validateContext(context);
    const nodes = (context.graph && context.graph.nodes) || [];

    return {
      kind: 'TYCOON_ANALYSIS',
      schemaVersion: '1.0.0',
      buttons: this._detectButtons(nodes),
      economy: this._analyzeEconomy(nodes),
      production: this._analyzeProduction(nodes),
      isTycoon: this._isTycoon(nodes),
    };
  }

  _detectButtons(nodes) {
    const buttons = nodes.filter(n => {
      const name = (n.properties?.Name || '').toLowerCase();
      return name.includes('button') || name.includes('buy');
    });
    return { count: buttons.length, detected: buttons.length > 0 };
  }

  _analyzeEconomy(nodes) {
    const droppers = nodes.filter(n => (n.properties?.Name || '').toLowerCase().includes('dropper'));
    const collectors = nodes.filter(n => (n.properties?.Name || '').toLowerCase().includes('collector'));
    return {
      droppers: droppers.length,
      collectors: collectors.length,
      hasIncomeLoop: droppers.length > 0 && collectors.length > 0,
    };
  }

  _analyzeProduction(nodes) {
    const conveyors = nodes.filter(n => (n.properties?.Name || '').toLowerCase().includes('conveyor'));
    const machines = nodes.filter(n => (n.properties?.Name || '').toLowerCase().includes('machine'));
    return {
      conveyors: conveyors.length,
      machines: machines.length,
      hasProductionChain: conveyors.length > 0 || machines.length > 0,
    };
  }

  _isTycoon(nodes) {
    const buttons = this._detectButtons(nodes);
    const economy = this._analyzeEconomy(nodes);
    return buttons.detected || economy.hasIncomeLoop;
  }
}

export default TycoonSkill;
