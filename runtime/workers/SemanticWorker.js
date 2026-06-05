export class SemanticWorker {
  async run({ ast, analyzer }) {
    const semantic = analyzer.analyze(ast);

    if (!semantic.valid) {
      throw new Error('SEMANTIC_WORKER_FAILED');
    }

    return semantic;
  }
}