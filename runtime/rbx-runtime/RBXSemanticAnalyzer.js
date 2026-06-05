export class RBXSemanticAnalyzer {
  analyze(ast) {
    const services = [
      'workspace',
      'ReplicatedStorage',
      'StarterGui',
      'ServerScriptService',
      'Lighting',
      'SoundService'
    ];

    return {
      valid: true,
      services,
      warnings: [],
      ast
    };
  }
}