export class RBXMSerializer {
  serialize(graph) {
    return {
      format: 'rbxm',
      deterministic: true,
      objectCount: graph.nodes.length
    };
  }
}