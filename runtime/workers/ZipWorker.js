export class ZipWorker {
  async run({ serialized, exporter, snapshotId }) {
    return exporter.export(serialized, snapshotId);
  }
}