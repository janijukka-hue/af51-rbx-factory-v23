export class ManifestWorker {
  async run({ snapshot }) {
    return {
      artifactId: `artifact_${snapshot.snapshotId}`,
      snapshotId: snapshot.snapshotId,
      exportType: 'roblox'
    };
  }
}