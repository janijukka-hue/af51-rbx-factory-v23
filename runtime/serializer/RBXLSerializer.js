export class RBXLSerializer {
  serialize(graph) {
    return {
      format: 'rbxl',
      deterministic: true,
      objectCount: graph.nodes.length
    };
  }
}