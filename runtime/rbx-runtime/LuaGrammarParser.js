export class LuaGrammarParser {
  parse(source) {
    const lines = source.split('\n');
    const ast = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('local')) {
        ast.push({
          type: 'VariableDeclaration',
          raw: trimmed
        });
      }

      if (trimmed.includes('Instance.new')) {
        const match = trimmed.match(/Instance\.new\("(.+?)"\)/);

        ast.push({
          type: 'InstanceCreation',
          className: match?.[1] || 'Unknown'
        });
      }

      if (trimmed.includes('require(')) {
        ast.push({
          type: 'ModuleDependency',
          raw: trimmed
        });
      }
    }

    return {
      type: 'LuaAST',
      nodes: ast
    };
  }
}