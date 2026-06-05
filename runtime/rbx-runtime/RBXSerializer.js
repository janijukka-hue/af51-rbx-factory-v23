export class RBXSerializer {
  serialize(graph) {
    const manifest = {
      exportType: 'roblox',
      objectCount: graph.nodes.length,
      deterministic: true
    };

    return {
      manifest,
      workspace: graph.nodes
    };
  }
}