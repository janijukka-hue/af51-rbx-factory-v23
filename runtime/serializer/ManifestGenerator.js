export class ManifestGenerator {
  generate(snapshotId, structureHash) {
    return {
      snapshotId,
      structureHash,
      exportType: 'roblox',
      deterministic: true
    };
  }
}