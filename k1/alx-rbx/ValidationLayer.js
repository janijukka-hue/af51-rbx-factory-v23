
export class ValidationLayer {
  execute(context) {
    if (!context.luaSemantic) {
      throw new Error('VALIDATION_FAILED_NO_SEMANTIC_CONTEXT');
    }

    context.validation = {
      valid: true,
      failFast: true
    };

    return context;
  }
}
