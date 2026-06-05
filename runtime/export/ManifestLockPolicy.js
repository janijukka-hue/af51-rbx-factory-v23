export class ManifestLockPolicy {
  lock(snapshotId, structureHash) {
    return {
      locked: true,
      snapshotId,
      structureHash
    };
  }
}