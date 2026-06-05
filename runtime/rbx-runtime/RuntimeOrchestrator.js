import { LuaParser } from './LuaParser.js';
import { RBXSemanticAnalyzer } from './RBXSemanticAnalyzer.js';
import { InstanceGraphBuilder } from './InstanceGraphBuilder.js';
import { RBXValidator } from './RBXValidator.js';
import { RBXSerializer } from './RBXSerializer.js';
import { DeterministicZipExporter } from './DeterministicZipExporter.js';

export class RuntimeOrchestrator {
  run(luaSource, snapshotId) {
    const parser = new LuaParser();
    const analyzer = new RBXSemanticAnalyzer();
    const builder = new InstanceGraphBuilder();
    const validator = new RBXValidator();
    const serializer = new RBXSerializer();
    const exporter = new DeterministicZipExporter();

    const ast = parser.parse(luaSource);

    const semantic = analyzer.analyze(ast);

    if (!semantic.valid) {
      throw new Error('SEMANTIC_ANALYSIS_FAILED');
    }

    const graph = builder.build(ast);

    validator.validate(graph);

    const serialized = serializer.serialize(graph);

    return exporter.export(serialized, snapshotId);
  }
}