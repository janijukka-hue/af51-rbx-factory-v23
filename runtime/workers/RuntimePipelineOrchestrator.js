import { LuaParseWorker } from './LuaParseWorker.js';
import { SemanticWorker } from './SemanticWorker.js';
import { ObjectGraphWorker } from './ObjectGraphWorker.js';
import { PreviewWorker } from './PreviewWorker.js';
import { AssetWorker } from './AssetWorker.js';
import { ValidationWorker } from './ValidationWorker.js';
import { SnapshotWorker } from './SnapshotWorker.js';
import { ManifestWorker } from './ManifestWorker.js';
import { VaultWorker } from './VaultWorker.js';
import { ZipWorker } from './ZipWorker.js';
import { PublishWorker } from './PublishWorker.js';

export class RuntimePipelineOrchestrator {
  async run(context) {
    const preview = await new PreviewWorker().run(context);

    const semantic = await new SemanticWorker().run(context);

    const graph = await new ObjectGraphWorker().run(context);

    const validation = await new ValidationWorker().run({
      graph: graph.graph,
      validator: context.validator
    });

    const snapshot = await new SnapshotWorker().run({
      graph: graph.graph,
      snapshotId: context.snapshotId
    });

    const manifest = await new ManifestWorker().run({
      snapshot
    });

    const vault = await new VaultWorker().run({
      manifest
    });

    const zip = await new ZipWorker().run({
      serialized: context.serialized,
      exporter: context.exporter,
      snapshotId: context.snapshotId
    });

    const publish = await new PublishWorker().run({
      validated: validation,
      zip
    });

    return {
      preview,
      semantic,
      graph,
      validation,
      snapshot,
      manifest,
      vault,
      zip,
      publish
    };
  }
}