export class RBXValidator {
  validate(graph) {
    if (!graph || !graph.nodes) {
      throw new Error('RBX_VALIDATION_FAILED');
    }

    const duplicateIds = new Set();

    for (const node of graph.nodes) {
      if (duplicateIds.has(node.id)) {
        throw new Error('DUPLICATE_NODE_ID');
      }

      duplicateIds.add(node.id);

      if (!node.className) {
        throw new Error('INVALID_CLASSNAME');
      }
    }

    return {
      valid: true,
      nodeCount: graph.nodes.length
    };
  }
}