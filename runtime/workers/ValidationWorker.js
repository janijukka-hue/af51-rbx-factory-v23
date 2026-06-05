export class ValidationWorker {
  async run({ graph, validator }) {
    const result = validator.validate(graph);

    if (!result.valid) {
      throw new Error('VALIDATION_FAILED');
    }

    return result;
  }
}