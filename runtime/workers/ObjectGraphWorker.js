export class ObjectGraphWorker {
  async run({ ast, builder }) {
    const graph = builder.build(ast);

    return {
      success: true,
      graph
    };
  }
}