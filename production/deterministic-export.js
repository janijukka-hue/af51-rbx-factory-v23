export function createDeterministicArtifactId(projectId, snapshotId) {
  return `artifact_${projectId}_${snapshotId}`;
}

export function stableSortPaths(paths) {
  return [...paths].sort((a, b) => a.localeCompare(b));
}

export function deterministicTimestamp() {
  return new Date().toISOString();
}