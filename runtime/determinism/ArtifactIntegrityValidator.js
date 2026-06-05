export class ArtifactIntegrityValidator {
  validate(manifest, structureHash) {
    if (!manifest.structureHash) {
      throw new Error('MISSING_STRUCTURE_HASH');
    }

    if (manifest.structureHash !== structureHash) {
      throw new Error('STRUCTURE_HASH_MISMATCH');
    }

    return {
      valid: true
    };
  }
}