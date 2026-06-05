export class DeterministicZipExporter {
  createArtifactName(snapshotId) {
    return `artifact_${snapshotId}.zip`;
  }

  stableSort(items) {
    return [...items].sort((a, b) => {
      return JSON.stringify(a).localeCompare(JSON.stringify(b));
    });
  }

  export(serialized, snapshotId) {
    return {
      artifact: this.createArtifactName(snapshotId),
      deterministic: true,
      contents: this.stableSort(serialized.workspace || [])
    };
  }
}