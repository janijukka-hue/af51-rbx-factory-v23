export class RBXDependencyGraph {
  build(ast) {
    return {
      dependencies: ast.nodes
        .filter(n => n.type === 'ModuleDependency')
        .map((n, i) => ({
          id: `dep_${i}`,
          raw: n.raw
        }))
    };
  }
}