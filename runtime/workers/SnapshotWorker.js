export class SnapshotWorker {
  async run({ graph, snapshotId }) {
    return {
      snapshotId,
      locked: true,
      objectCount: graph.nodes.length
    };
  }
}