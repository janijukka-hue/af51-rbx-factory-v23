
export class ObjectGraphLayer {
  execute(context) {
    context.objectGraph = {
      nodes: [],
      edges: [],
      generated: true
    };

    return context;
  }
}
