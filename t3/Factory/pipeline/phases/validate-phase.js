// t3/Factory/pipeline/phases/validate-phase.js
// Validate Phase - Code inspection, tests, security

import { BasePhase } from "../base-phase.js";
import { PIPELINE_PHASE } from "../../core/factory-types.js";

export class ValidatePhase extends BasePhase {
  constructor(options = {}) {
    super(PIPELINE_PHASE.VALIDATE, options);
    this._codeInspector = options.codeInspector || null;
    this._testRunner = options.testRunner || null;
    this._securityScanner = options.securityScanner || null;
  }

  canSkip(context) {
    return context.isIncrementalHit();
  }

  async execute(context) {
    const buildOutput = context.getBuildOutput() || [];
    
    const results = {
      inspection: { passed: true, issues: [] },
      tests: { passed: true, results: [] },
      security: { passed: true, findings: [] }
    };
    
    if (this._codeInspector) {
      results.inspection = await this._codeInspector.inspect(buildOutput);
    }
    
    if (this._testRunner) {
      results.tests = await this._testRunner.runTests(buildOutput);
    }
    
    if (this._securityScanner) {
      results.security = await this._securityScanner.scan(buildOutput);
    }
    
    const allPassed = results.inspection.passed && results.tests.passed && results.security.passed;
    
    context.setValidationResults(results);
    
    return {
      passed: allPassed,
      inspection: results.inspection,
      tests: results.tests,
      security: results.security
    };
  }
}

export function createValidatePhase(options) {
  return new ValidatePhase(options);
}

export default ValidatePhase;